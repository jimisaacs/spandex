/**
 * ASCII Snapshot Testing for Spatial Indexes
 *
 * Provides utilities to render spatial indexes as ASCII art (like the diagrams
 * in docs/diagrams/) and use them as snapshot tests.
 *
 * Example:
 * ```
 *     A   B   C   D
 *   +---+---+---+---+
 * 0 |   |   |   |   |
 *   +---+---+---+---+
 * 1 | R | R | R |   |
 *   +---+---+---+---+
 * 2 | R | R | R |   |
 *   +---+---+---+---+
 *
 * R = RED
 * ```
 */

import type { Rectangle, SpatialIndex } from '../types.ts';

// ASCII rendering constants
const CELL_WIDTH = 3; // Width of each cell in the grid (e.g., " x ")
const CELL_SEPARATOR = '|'; // Character separating cells
const BORDER_CHAR = '+'; // Corner/junction character
const BORDER_LINE = '---'; // Horizontal border segment
const COLUMN_SEPARATOR = ' '; // Space between column headers

/**
 * Options for ASCII rendering
 */
export interface RenderOptions {
	/** Width of viewport (number of columns) */
	width: number;
	/** Height of viewport (number of rows) */
	height: number;
	/** Starting column (default: 0) */
	startCol?: number;
	/** Starting row (default: 0) */
	startRow?: number;
	/** Value formatter (default: first char) */
	valueFormatter?: (value: unknown) => string;
}

/**
 * Parsed ASCII snapshot structure
 */
export interface ParsedSnapshot {
	/** Grid of cell values (row, col) */
	grid: string[][];
	/** Legend mapping (symbol → description) */
	legend: Map<string, string>;
	/** Viewport bounds */
	bounds: Rectangle;
}

/**
 * Convert column index to letter (0='A', 1='B', etc.)
 */
function colToLetter(col: number): string {
	if (col < 26) return String.fromCharCode(65 + col);
	// For columns beyond Z, use AA, AB, etc.
	return colToLetter(Math.floor(col / 26) - 1) + colToLetter(col % 26);
}

/**
 * Render a spatial index to ASCII art
 */
export function renderToAscii<T>(index: SpatialIndex<T>, options: RenderOptions): string {
	const { width, height, startCol = 0, startRow = 0, valueFormatter = (v) => String(v)[0] } = options;
	const viewport: Rectangle = [startCol, startRow, startCol + width - 1, startRow + height - 1];

	// Build grid of symbols and legend
	const { grid, legend } = buildGridFromResults(index.query(viewport), {
		width,
		height,
		startCol,
		startRow,
		valueFormatter,
	});

	// Render grid to ASCII lines
	return renderGridToAscii(grid, legend, { width, height, startCol, startRow });
}

/**
 * Build grid and legend from query results
 */
function buildGridFromResults<T>(
	results: IterableIterator<readonly [Rectangle, T]>,
	options: { width: number; height: number; startCol: number; startRow: number; valueFormatter: (v: T) => string },
): { grid: string[][]; legend: Map<string, Set<T>> } {
	const { width, height, startCol, startRow, valueFormatter } = options;

	// Initialize empty grid
	const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));
	const legend = new Map<string, Set<T>>();

	// Fill grid from query results
	for (const [bounds, value] of results) {
		const [x1, y1, x2, y2] = bounds;
		const symbol = valueFormatter(value);

		// Track symbol → values mapping for legend
		if (!legend.has(symbol)) {
			legend.set(symbol, new Set());
		}
		legend.get(symbol)!.add(value);

		// Fill cells that intersect viewport
		const viewportStartRow = startRow;
		const viewportEndRow = startRow + height - 1;
		const viewportStartCol = startCol;
		const viewportEndCol = startCol + width - 1;

		for (let row = Math.max(y1, viewportStartRow); row <= Math.min(y2, viewportEndRow); row++) {
			for (let col = Math.max(x1, viewportStartCol); col <= Math.min(x2, viewportEndCol); col++) {
				grid[row - startRow][col - startCol] = symbol;
			}
		}
	}

	return { grid, legend };
}

/**
 * Render grid to ASCII art with borders and row/column labels
 */
function renderGridToAscii<T>(
	grid: string[][],
	legend: Map<string, Set<T>>,
	viewport: { width: number; height: number; startCol: number; startRow: number },
): string {
	const { width, height, startCol, startRow } = viewport;
	const lines: string[] = [];

	// Calculate width needed for row number labels (number of digits)
	const maxRowNumber = startRow + height - 1;
	const rowLabelWidth = String(maxRowNumber).length;

	// Render column header (e.g., "   A   B   C")
	lines.push(renderColumnHeader(width, startCol, rowLabelWidth));

	// Render top border
	const border = renderBorder(width, rowLabelWidth);
	lines.push(border);

	// Render grid rows with borders
	for (let rowIdx = 0; rowIdx < height; rowIdx++) {
		const rowNumber = startRow + rowIdx;
		lines.push(renderDataRow(grid[rowIdx], rowNumber, rowLabelWidth));
		lines.push(border);
	}

	// Render legend
	if (legend.size > 0) {
		lines.push('');
		lines.push(...renderLegend(legend));
	}

	return lines.join('\n');
}

/**
 * Render column header row (e.g., "     A   B   C")
 * Column letters are centered above cell contents, not aligned with border edge
 */
function renderColumnHeader(width: number, startCol: number, rowLabelWidth: number): string {
	// Extra 2 spaces to center column letters above cell contents ("|" + " ")
	const padding = ' '.repeat(rowLabelWidth + 1 + 2);
	const columns = Array.from({ length: width }, (_, i) => {
		return colToLetter(startCol + i).padEnd(CELL_WIDTH, ' ');
	}).join(COLUMN_SEPARATOR);
	return padding + columns;
}

/**
 * Render horizontal border (e.g., "   +---+---+")
 */
function renderBorder(width: number, rowLabelWidth: number): string {
	const padding = ' '.repeat(rowLabelWidth);
	const borderSegment = BORDER_LINE + BORDER_CHAR;
	return padding + ' ' + BORDER_CHAR + borderSegment.repeat(width);
}

/**
 * Render data row with row number label (e.g., " 0 | x | y | z |")
 */
function renderDataRow(rowCells: string[], rowNumber: number, rowLabelWidth: number): string {
	const rowLabel = String(rowNumber).padStart(rowLabelWidth, ' ');
	const cells = rowCells.map((cell) => ` ${cell} `).join(CELL_SEPARATOR);
	return `${rowLabel} ${CELL_SEPARATOR}${cells}${CELL_SEPARATOR}`;
}

/**
 * Render legend lines (e.g., "R = "RED"")
 */
function renderLegend<T>(legend: Map<string, Set<T>>): string[] {
	const entries = [...legend.entries()].sort();
	return entries.map(([symbol, values]) => {
		const descriptions = [...values].map((v) => JSON.stringify(v)).join(', ');
		return `${symbol} = ${descriptions}`;
	});
}

/**
 * Parse ASCII snapshot back to structured data
 */
export function parseAscii(ascii: string): ParsedSnapshot {
	const lines = ascii.split('\n').map((line) => line.trimEnd());

	// Find header row (column letters)
	const headerIdx = lines.findIndex((line) => /^[\s]*[A-Z]/.test(line));
	if (headerIdx === -1) throw new Error('No header row found');

	// Parse column letters
	const header = lines[headerIdx];
	const colMatches = [...header.matchAll(/([A-Z]+)/g)];
	const startCol = colMatches.length > 0 ? letterToCol(colMatches[0][1]) : 0;
	const width = colMatches.length;

	// Find first data row (has row number)
	const firstDataIdx = lines.findIndex((line, i) => i > headerIdx && /^\s*\d+\s*\|/.test(line));
	if (firstDataIdx === -1) throw new Error('No data rows found');

	// Parse row number
	const firstDataLine = lines[firstDataIdx];
	const rowMatch = firstDataLine.match(/^\s*(\d+)/);
	if (!rowMatch) throw new Error('Invalid row format');
	const startRow = parseInt(rowMatch[1], 10);

	// Parse grid
	const grid: string[][] = [];
	let currentIdx = firstDataIdx;

	while (currentIdx < lines.length) {
		const line = lines[currentIdx];
		if (!/^\s*\d+\s*\|/.test(line)) break;

		// Extract cells between | delimiters
		const cellsMatch = line.match(/\|(.*)\|$/);
		if (!cellsMatch) break;

		const cellsStr = cellsMatch[1];
		const cells = cellsStr.split('|').map((cell) => cell.trim()[0] || ' ');
		grid.push(cells);

		currentIdx += 2; // Skip data line + border line
	}

	const height = grid.length;

	// Parse legend (lines like "R = RED" or "B = \"BLUE\"")
	const legend = new Map<string, string>();
	for (let i = currentIdx; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const match = line.match(/^([A-Z\d+])\s*=\s*(.+)$/);
		if (match) {
			let value = match[2].trim();
			// Try to parse as JSON if it looks like JSON (quoted or object/array)
			if (value.startsWith('"') || value.startsWith('{') || value.startsWith('[')) {
				try {
					value = JSON.parse(value);
				} catch {
					// Keep as-is if JSON parse fails
				}
			}
			legend.set(match[1], value);
		}
	}

	return {
		grid,
		legend,
		bounds: [startCol, startRow, startCol + width - 1, startRow + height - 1],
	};
}

/**
 * Convert column letter to index ('A'=0, 'B'=1, etc.)
 */
function letterToCol(letter: string): number {
	let col = 0;
	for (let i = 0; i < letter.length; i++) {
		col = col * 26 + (letter.charCodeAt(i) - 65 + 1);
	}
	return col - 1;
}

/**
 * Assert that rendered output matches expected ASCII snapshot
 */
export function assertSnapshot(actual: string, expected: string): void {
	// Normalize whitespace for comparison
	const normalizeLines = (s: string) =>
		s
			.split('\n')
			.map((line) => line.trimEnd())
			.filter((line) => line.length > 0);

	const actualLines = normalizeLines(actual);
	const expectedLines = normalizeLines(expected);

	if (actualLines.length !== expectedLines.length) {
		throw new Error(
			`Snapshot mismatch: Different number of lines\nExpected ${expectedLines.length} lines, got ${actualLines.length}\n\n` +
				`Expected:\n${expected}\n\nActual:\n${actual}`,
		);
	}

	for (let i = 0; i < actualLines.length; i++) {
		if (actualLines[i] !== expectedLines[i]) {
			throw new Error(
				`Snapshot mismatch at line ${i + 1}:\nExpected: "${expectedLines[i]}"\nActual:   "${
					actualLines[i]
				}"\n\n` +
					`Full expected:\n${expected}\n\nFull actual:\n${actual}`,
			);
		}
	}
}

/**
 * Extract non-empty regions from parsed snapshot
 * Returns array of {bounds, value} matching SpatialIndex query result format
 */
export function snapshotToRegions(snapshot: ParsedSnapshot): Array<{ bounds: Rectangle; value: string }> {
	const { grid, legend, bounds } = snapshot;
	const [startCol, startRow] = bounds;

	// Group contiguous cells with same symbol into rectangles
	const regions: Array<{ bounds: Rectangle; value: string }> = [];
	const visited = new Set<string>();

	for (let row = 0; row < grid.length; row++) {
		for (let col = 0; col < grid[row].length; col++) {
			const key = `${row},${col}`;
			if (visited.has(key)) continue;

			const symbol = grid[row][col];
			if (symbol === ' ') continue;

			// Find maximal rectangle starting at (row, col)
			let maxCol = col;
			while (maxCol + 1 < grid[row].length && grid[row][maxCol + 1] === symbol) {
				maxCol++;
			}

			let maxRow = row;
			let canExtend = true;
			while (canExtend && maxRow + 1 < grid.length) {
				for (let c = col; c <= maxCol; c++) {
					if (grid[maxRow + 1][c] !== symbol) {
						canExtend = false;
						break;
					}
				}
				if (canExtend) maxRow++;
			}

			// Mark visited
			for (let r = row; r <= maxRow; r++) {
				for (let c = col; c <= maxCol; c++) {
					visited.add(`${r},${c}`);
				}
			}

			// Add region
			const value = legend.get(symbol) || symbol;
			regions.push({
				bounds: [startCol + col, startRow + row, startCol + maxCol, startRow + maxRow],
				value,
			});
		}
	}

	return regions;
}

/**
 * Fixture extracted from markdown documentation
 */
export interface MarkdownFixture {
	/** Test name (from "## Test: Name" header) */
	name: string;
	/** ASCII snapshot text */
	snapshot: string;
}

/**
 * Parse markdown file to extract test fixtures
 *
 * Extracts fixtures from markdown documentation where each test case is:
 * 1. A section starting with "## Test: <name>"
 * 2. ASCII grid in ```ascii code fence
 * 3. Optional legend entries
 *
 * @param markdownContent - Raw markdown file content
 * @returns Array of fixtures with names and snapshot text
 */
export function parseMarkdownFixtures(markdownContent: string): MarkdownFixture[] {
	const fixtures: MarkdownFixture[] = [];
	const lines = markdownContent.split('\n');

	let i = 0;
	while (i < lines.length) {
		// Find "## Test: " header
		const line = lines[i];
		if (line.startsWith('## Test: ')) {
			const name = line.substring(9).trim();

			// Find the ```ascii code fence
			let asciiStart = -1;
			let asciiEnd = -1;

			for (let j = i + 1; j < lines.length; j++) {
				if (lines[j].trim() === '```ascii') {
					asciiStart = j + 1;
				} else if (asciiStart !== -1 && lines[j].trim() === '```') {
					asciiEnd = j;
					break;
				}
			}

			if (asciiStart !== -1 && asciiEnd !== -1) {
				// Extract snapshot (everything inside code fence)
				const snapshot = lines.slice(asciiStart, asciiEnd).join('\n');
				fixtures.push({ name, snapshot });

				// Move past this section
				i = asciiEnd + 1;
			} else {
				i++;
			}
		} else {
			i++;
		}
	}

	return fixtures;
}
