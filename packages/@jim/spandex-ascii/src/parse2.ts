/**
 * ASCII grid parser - inverse of render()
 *
 * Clean rewrite applying structural parsing lessons learned.
 *
 * Parsing strategy:
 * Phase 1: Split input into sections (gridNames, gridContent, legendAndMeta)
 * Phase 2: Parse gridContent to find grid boundaries, calculate center lines, associate names
 */

import type { QueryResult } from '@jim/spandex';
import {
	ABSOLUTE_ORIGIN_MARKER,
	BORDER_CHAR,
	BORDER_LINE,
	CELL_SEPARATOR,
	EMPTY_CELL,
	INFINITY_SYMBOL,
} from './constants.ts';
import type { CoordinateSystem } from './types.ts';

//#region Lexical Patterns

/** Matches column header line (only A-Z letters, infinity symbol, and whitespace) */
const COLUMN_HEADER_LINE = new RegExp(`^[A-Z${INFINITY_SYMBOL}\\s]+$`);

/** Matches border line (only whitespace and border characters: +, *, -, |) */
const BORDER_LINE_PATTERN = new RegExp(`^[\\s\\${BORDER_CHAR}\\${ABSOLUTE_ORIGIN_MARKER}\\${CELL_SEPARATOR}\\-]+$`);

/** Matches whitespace for splitting column labels */
const WHITESPACE_SPLITTER = /\s+/;

/** Matches data row line: row label (number or ∞), whitespace, then must contain pipe separator */
const DATA_ROW_LINE = new RegExp(`^\\s*(\\d+|${INFINITY_SYMBOL})\\s.*\\${CELL_SEPARATOR}`);

/** Extracts row label (number or ∞) from data line */
const ROW_LABEL = new RegExp(`^\\s*(\\d+|${INFINITY_SYMBOL})`);

/** Matches legend entry line: single character, " = ", value */
const LEGEND_ENTRY = /^(.) = (.+)$/;

/** Matches absolute coordinate marker at grid top border: `*---` */
const ABSOLUTE_MARKER_LINE = new RegExp(`^\\s+\\${ABSOLUTE_ORIGIN_MARKER}${BORDER_LINE}`);

//#endregion

/**
 * Phase 1: Vertical sections of the input
 */
interface Sections {
	linesAbove: string[];
	gridContent: string[];
	linesBelow: string[];
	coordinateSystem: CoordinateSystem;
}

/**
 * Phase 2: Grid boundary information
 */
interface GridBoundary {
	top: number; // Relative to gridContent.lines
	bottom: number;
	left: number;
	right: number;
}

/**
 * Parse rendered ASCII grid(s) back to query results.
 *
 * @returns Parsed grids with optional names, legend, and coordinate system
 */
export function parse<T = unknown>(ascii: string): {
	grids: Array<{ name?: string; results: QueryResult<T>[] }>;
	legend: Record<string, T>;
	coordinateSystem: CoordinateSystem;
} {
	// PHASE 1: Split into sections (also detects coordinate system)
	const { linesAbove, gridContent, linesBelow, coordinateSystem } = extractSections(ascii);

	// Parse legend from linesBelow
	const legend = parseLegend<T>(linesBelow);

	// PHASE 2: Find grid boundaries in gridContent
	const boundaries = findGridBoundaries(gridContent);
	if (boundaries.length === 0) {
		throw new Error('Parse error: No grids found in input');
	}

	// Calculate center lines from boundaries
	const centerLines = calculateCenterLines(boundaries);

	// Parse grid names using center lines (if linesAbove exists)
	const gridNames = linesAbove.length > 0
		? parseGridNames(linesAbove, centerLines)
		: Array(boundaries.length).fill(undefined);

	// Parse each grid
	const grids = boundaries.map((boundary, idx) => {
		const gridLines = gridContent.slice(boundary.top, boundary.bottom + 1);
		const results = parseGrid<T>(gridLines, legend);
		return { name: gridNames[idx], results };
	});

	return { grids, legend: Object.fromEntries(legend), coordinateSystem };
}

/**
 * PHASE 1: Extract vertical sections from input text.
 *
 * Strategy:
 * 1. Find the column header line (with high confidence heuristics)
 * 2. From header, scan forward to find grid end
 * 3. Extract sections based on grid boundaries
 */
function extractSections(ascii: string): Sections {
	const lines = ascii.split('\n').map((line) => line.trimEnd());

	// Find the column header line and detect coordinate system
	const headerInfo = findColumnHeaderLine(lines);
	if (headerInfo == null) {
		throw new Error('Parse error: No column header found');
	}

	const { headerIdx, coordinateSystem } = headerInfo;

	// Find the end of the grid by scanning forward (skip header + border/blank line)
	const bottommostEndIdx = findLastLineBeforeBlank(lines, headerIdx + 2);
	if (bottommostEndIdx == null) {
		throw new Error('Parse error: Grid has no content after header');
	}

	// Extract sections
	const linesAbove = lines.slice(0, headerIdx);
	const gridContent = lines.slice(headerIdx, bottommostEndIdx + 1);
	const linesBelow = lines.slice(bottommostEndIdx + 1);

	// Validate we have content below grid (for legend)
	if (linesBelow.length === 0) {
		throw new Error('Parse error: No legend section found (expected content below grid)');
	}

	return { linesAbove, gridContent, linesBelow, coordinateSystem };
}

/**
 * Find the column header line with high confidence and detect coordinate system.
 *
 * Heuristics:
 * - Line matches COLUMN_HEADER_LINE (only A-Z, ∞, whitespace)
 * - Next non-blank line is either:
 *   - A border line (finite top edge) - also determines coordinate system
 *   - A data row (infinity top edge) - viewport coordinates
 */
function findColumnHeaderLine(
	lines: string[],
): { headerIdx: number; coordinateSystem: CoordinateSystem } | undefined {
	for (let i = lines.length - 1; i >= 0; i--) {
		if (!COLUMN_HEADER_LINE.test(lines[i])) continue;

		// Find next non-blank line
		let nextIdx = i + 1;
		while (nextIdx < lines.length && !lines[nextIdx].trim()) {
			nextIdx++;
		}

		if (nextIdx >= lines.length) continue; // No next line

		const nextLine = lines[nextIdx];

		// Check if next line is border line
		if (BORDER_LINE_PATTERN.test(nextLine)) {
			// Detect coordinate system from border marker
			const coordinateSystem = ABSOLUTE_MARKER_LINE.test(nextLine) ? 'absolute' : 'viewport';
			return { headerIdx: i, coordinateSystem };
		}

		// Check if next line is data row (infinity top edge = viewport)
		if (DATA_ROW_LINE.test(nextLine)) {
			return { headerIdx: i, coordinateSystem: 'viewport' };
		}
	}
}

/**
 * Find the last non-blank line before a blank line, starting from startIdx.
 *
 * Returns the index of the last non-blank line before:
 * - A blank line (section separator)
 * - End of file
 */
function findLastLineBeforeBlank(lines: string[], startIdx: number): number | undefined {
	for (let i = startIdx; i < lines.length; i++) {
		if (!lines[i].trim()) {
			// Found blank line - return previous line if valid
			const prevIdx = i - 1;
			if (prevIdx < startIdx) return;
			return prevIdx;
		}
	}
	return lines.length - 1; // Reached EOF
}

/**
 * PHASE 2: Find all grid boundaries in gridContent using column headers.
 *
 * Strategy:
 * - Parse column header line (line 0) to find groups of labels separated by whitespace
 * - Each label group indicates one grid's horizontal position
 * - Scan each grid region to find actual left/right bounds (including row labels/borders)
 * - All grids share the same top (0) and bottom (last non-blank line)
 */
function findGridBoundaries(gridContent: string[]): GridBoundary[] {
	if (gridContent.length === 0) return [];

	const headerLine = gridContent[0];
	const top = 0;

	// Find bottom (last non-blank line)
	let bottom = gridContent.length - 1;
	while (bottom > top && !gridContent[bottom].trim()) {
		bottom--;
	}

	// Parse column header line to find label groups
	const labelGroups: Array<{ start: number; end: number }> = [];
	let inLabel = false;
	let groupStart = -1;

	for (let i = 0; i < headerLine.length; i++) {
		const char = headerLine[i];
		const isWhitespace = char === ' ' || char === '\t';

		if (!isWhitespace && !inLabel) {
			// Start of new label group
			inLabel = true;
			groupStart = i;
		} else if (isWhitespace && inLabel) {
			// End of label group
			labelGroups.push({ start: groupStart, end: i - 1 });
			inLabel = false;
		}
	}

	// Handle last group if line ends with label
	if (inLabel) {
		labelGroups.push({ start: groupStart, end: headerLine.length - 1 });
	}

	// For each label group, find the actual grid bounds by scanning all rows
	const boundaries: GridBoundary[] = [];

	for (const group of labelGroups) {
		// Scan all rows in this region to find leftmost/rightmost non-whitespace
		let left = group.start;
		let right = group.end;

		for (let y = 0; y <= bottom; y++) {
			const line = gridContent[y];

			// Scan left from group.start
			for (let x = group.start - 1; x >= 0; x--) {
				if (line[x] && line[x] !== ' ' && line[x] !== '\t') {
					left = Math.min(left, x);
				} else {
					break; // Hit whitespace, stop scanning left
				}
			}

			// Scan right from group.end
			for (let x = group.end + 1; x < line.length; x++) {
				if (line[x] && line[x] !== ' ' && line[x] !== '\t') {
					right = Math.max(right, x);
				} else {
					break; // Hit whitespace, stop scanning right
				}
			}
		}

		boundaries.push({ top, bottom, left, right });
	}

	return boundaries;
}

/**
 * Calculate center X position for each grid (for associating names).
 */
function calculateCenterLines(boundaries: GridBoundary[]): number[] {
	return boundaries.map((b) => Math.floor((b.left + b.right) / 2));
}

/**
 * Parse grid names from linesAbove using center lines.
 *
 * Strategy:
 * - Find the character at each centerLine X position
 * - Expand left/right to capture the full name
 */
function parseGridNames(linesAbove: string[], centerLines: number[]): Array<string | undefined> {
	if (linesAbove.length === 0) return centerLines.map(() => undefined);

	// Concatenate all lines (names might span multiple lines, though typically one)
	const fullText = linesAbove.join(' ');

	return centerLines.map((centerX) => {
		// Find the word containing centerX position
		// Expand left to find start of word
		let left = centerX;
		while (left > 0 && fullText[left - 1] && fullText[left - 1].trim()) {
			left--;
		}

		// Expand right to find end of word
		let right = centerX;
		while (right < fullText.length - 1 && fullText[right + 1] && fullText[right + 1].trim()) {
			right++;
		}

		const name = fullText.substring(left, right + 1).trim();
		return name || undefined;
	});
}

/**
 * Parse a single grid from its lines.
 */
function parseGrid<T>(gridLines: string[], legend: Map<string, T>): QueryResult<T>[] {
	// Find header line (only letters/∞/whitespace)
	const headerIdx = gridLines.findIndex((line) => COLUMN_HEADER_LINE.test(line));
	if (headerIdx === -1) {
		// Empty grid
		return [];
	}

	// Extract column labels from header
	const columnLabels = gridLines[headerIdx]
		.trim()
		.split(WHITESPACE_SPLITTER)
		.filter((s) => s && s !== CELL_SEPARATOR);

	// Extract row labels and parse cells
	const results: QueryResult<T>[] = [];
	const rowLabels: string[] = [];

	for (let lineIdx = headerIdx + 1; lineIdx < gridLines.length; lineIdx++) {
		const line = gridLines[lineIdx];

		// Skip non-data rows
		if (!DATA_ROW_LINE.test(line)) {
			continue;
		}

		// Extract row label
		const rowMatch = line.match(ROW_LABEL);
		if (!rowMatch) continue;

		const rowLabel = rowMatch[1];
		rowLabels.push(rowLabel);
		const rowIdx = rowLabels.length - 1;

		// Extract cells
		const cells = extractCells(line);

		// Process each cell
		for (let colIdx = 0; colIdx < cells.length; colIdx++) {
			const cell = cells[colIdx];
			if (!cell || cell === EMPTY_CELL) continue;

			const symbol = cell[0];
			const value = legend.get(symbol);
			if (value === undefined) {
				throw new Error(`Parse error: No legend entry for symbol '${symbol}'`);
			}

			// Map to world coordinates
			const worldX = mapToWorldX(colIdx, columnLabels);
			const worldY = mapToWorldY(rowIdx, rowLabels);

			results.push([[worldX, worldY, worldX, worldY], value]);
		}
	}

	return results;
}

/**
 * Extract cells from a data row.
 *
 * Two formats:
 * - Finite: `0 | R | R |` (no cell before first |)
 * - Infinity: `∞  R | R | R |` (cell before first |)
 */
function extractCells(line: string): string[] {
	const firstPipe = line.indexOf(CELL_SEPARATOR);
	if (firstPipe === -1) return [];

	const cells: string[] = [];

	// Check for cell before first pipe (infinity edge format)
	// Row label is at the start, so remove it with the regex match
	const beforePipe = line.substring(0, firstPipe);
	const rowLabelMatch = beforePipe.match(ROW_LABEL);
	if (rowLabelMatch) {
		const afterLabel = beforePipe.substring(rowLabelMatch[0].length).trim();
		if (afterLabel) {
			cells.push(afterLabel);
		}
	}

	// Extract remaining cells (after first pipe)
	const afterPipe = line.substring(firstPipe + 1);
	const remaining = afterPipe
		.split(CELL_SEPARATOR)
		.map((c) => c.trim())
		.filter((c) => c); // Remove empty (from trailing |)

	cells.push(...remaining);
	return cells;
}

/**
 * Map grid column index to world X coordinate.
 */
function mapToWorldX(colIdx: number, columnLabels: string[]): number {
	if (colIdx >= columnLabels.length) {
		throw new Error(`Parse error: Column ${colIdx} out of bounds (have ${columnLabels.length} columns)`);
	}

	const label = columnLabels[colIdx];
	if (label === INFINITY_SYMBOL) {
		return colIdx === 0 ? -Infinity : Infinity;
	}

	// Convert letter to number: A=0, B=1, ..., Z=25, AA=26, ...
	let col = 0;
	for (let i = 0; i < label.length; i++) {
		col = col * 26 + (label.charCodeAt(i) - 65 + 1);
	}
	return col - 1;
}

/**
 * Map grid row index to world Y coordinate.
 */
function mapToWorldY(rowIdx: number, rowLabels: string[]): number {
	if (rowIdx >= rowLabels.length) {
		throw new Error(`Parse error: Row ${rowIdx} out of bounds (have ${rowLabels.length} rows)`);
	}

	const label = rowLabels[rowIdx];
	if (label === INFINITY_SYMBOL) {
		return rowIdx === 0 ? -Infinity : Infinity;
	}

	return parseInt(label, 10);
}

/**
 * Parse legend from linesBelow.
 */
function parseLegend<T>(linesBelow: string[]): Map<string, T> {
	const legend = new Map<string, T>();

	for (const line of linesBelow) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Match: `<symbol> = <value>`
		const match = trimmed.match(LEGEND_ENTRY);
		if (!match) continue;

		const symbol = match[1];
		const rawValue = match[2].trim();

		// Parse value as JSON, fall back to string
		let value: T;
		try {
			value = JSON.parse(rawValue) as T;
		} catch {
			value = rawValue as T;
		}

		legend.set(symbol, value);
	}

	return legend;
}
