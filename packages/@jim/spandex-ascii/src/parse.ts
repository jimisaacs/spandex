/**
 * ASCII grid parser - inverse of render()
 *
 * Pipeline: ASCII text → Extract sections (grids + legend) → Parse grids
 */

import type { QueryResult, Rectangle } from '@jim/spandex';
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

/** Matches grid top-left corner: `*---` (absolute), `+---` (viewport finite), `---` (viewport infinite) */
const GRID_TOP_LEFT = new RegExp(`^\\s+[${ABSOLUTE_ORIGIN_MARKER}${BORDER_CHAR}]?${BORDER_LINE}`);

/** Matches data row line starting with row label: number or ∞ (e.g., "0 | R |" or "∞ | R |" or "1   H | ...") */
const DATA_ROW_LINE = new RegExp(`^\\s*(-?\\d+|${INFINITY_SYMBOL})\\s`);

/** Extracts cell content between pipe delimiters (with optional trailing |) */
const CELL_CONTENT = new RegExp(`\\${CELL_SEPARATOR}(.+?)(?:\\${CELL_SEPARATOR}|\\s*)$`);

/** Extracts row label (number, negative number, or ∞) from data line */
const ROW_LABEL = new RegExp(`^\\s*(-?\\d+|${INFINITY_SYMBOL})`);

/** Matches legend entry line: single character, " = ", value (e.g., "R = "RED"") */
const LEGEND_ENTRY = /^(.) = (.+)$/;

/** Matches column header characters: letters, infinity symbol, or negative prefix */
const COLUMN_HEADER_CHARS = new RegExp(`[A-Z${INFINITY_SYMBOL}-]`);

//#endregion

//#region Semantic Analysis

/**
 * Parse rendered ASCII grid(s) back to query results.
 *
 * Handles both single grids and progressions (multiple grids side-by-side).
 * A single grid is just a progression with one state.
 *
 * Pipeline: ASCII text → Extract sections → Parse structure → Parse individual grids
 */
export function parse<T = unknown>(ascii: string): {
	grids: Array<{
		name?: string;
		results: QueryResult<T>[];
	}>;
	legend: Record<string, T>;
	coordinateSystem: CoordinateSystem;
} {
	const lines = ascii.split('\n').map((line) => line.trimEnd());

	// Extract grids and legend (unified path for N grids)
	const sections = extractSections(lines);

	// If no grids found, invalid input
	if (sections.grids.length === 0) {
		throw new Error('Parse error: No grids found in input');
	}

	// Parse shared legend
	const legend = parseLegend<T>(sections.legendLines);

	// Detect coordinate system from first grid's top border
	const firstGridBorder = sections.grids[0].gridLines.find((line) => GRID_TOP_LEFT.test(line)) ?? '';
	const coordinateSystem = firstGridBorder.trimStart()[0] === ABSOLUTE_ORIGIN_MARKER ? 'absolute' : 'viewport';

	// Parse each grid directly from structural content
	const grids: Array<{ name?: string; results: QueryResult<T>[] }> = [];

	for (const grid of sections.grids) {
		// Parse grid cells directly (no pattern matching, just structural positions)
		const results = parseGridFromLines<T>(grid.gridLines, legend);

		grids.push({
			name: grid.name,
			results,
		});
	}

	return {
		grids,
		legend: Object.fromEntries(legend),
		coordinateSystem,
	};
}

//#region Section Extraction

/**
 * Extract grids and legend from input using structural markers.
 *
 * Strategy: Find border lines (markers), then scan up/down to find full grid extent.
 * Border line marks a structural point - headers are above, data rows above/below.
 */
function extractSections(lines: string[]): {
	grids: Array<{ name?: string; gridLines: string[] }>;
	legendLines: string[];
} {
	// Find all border markers (these divide grids or separate ∞ rows from finite rows)
	const gridBoundaries = findGridBoundaries(lines);

	if (gridBoundaries.length === 0) {
		return { grids: [], legendLines: [] };
	}

	// Legend is everything below the bottommost grid
	const bottommost = Math.max(...gridBoundaries.map((g) => g.bottom));
	const legendLines = lines.slice(bottommost + 1).filter((line) => line.trim());

	// Extract each grid (boundaries already include full extent)
	const grids: Array<{ name?: string; gridLines: string[] }> = [];

	for (const boundary of gridBoundaries) {
		// Grid lines from top (header) to bottom (last data row)
		const gridLines = lines.slice(boundary.top, boundary.bottom + 1);

		// TODO: Extract optional name (lines above boundary.top for progressions)
		grids.push({ name: undefined, gridLines });
	}

	return {
		grids,
		legendLines,
	};
}

/**
 * Find all grid boundaries using structural markers (* or + or ---).
 * Uses a 2D cursor [row, col] approach: find border marker, then scan to find full extent.
 * Returns each grid's bounding box: left, right, top (header), bottom (last data row).
 */
export function findGridBoundaries(lines: string[]): Array<{
	left: number;
	right: number;
	top: number;
	bottom: number;
}> {
	// Position trackers: x = col, y = row
	let posX = 0;
	let posY = 0;

	// Scan for border marker (the key structural reference)
	let borderRow = -1;
	for (posY = 0; posY < lines.length; posY++) {
		if (GRID_TOP_LEFT.test(lines[posY])) {
			borderRow = posY;
			break;
		}
	}

	// No border found - check if we have a grid with only infinity edges
	if (borderRow === -1) {
		// Look for data rows (infinity-only grids have data rows but no borders)
		for (posY = 0; posY < lines.length; posY++) {
			const line = lines[posY];
			if (DATA_ROW_LINE.test(line) && line.includes(CELL_SEPARATOR)) {
				borderRow = posY;
				break;
			}
		}
	}

	if (borderRow === -1) return [];

	// From border marker, find horizontal extent (left, right)
	const borderLine = lines[borderRow];
	const left = borderLine.search(/[*+\-|]/);
	if (left === -1) return [];

	let right = left;
	for (posX = left; posX < borderLine.length; posX++) {
		const char = borderLine[posX];
		if (char === ' ' || !char) break;
		right = posX;
	}

	// From border marker, scan UP to find top (column headers)
	// Scan within grid horizontal boundaries [left, right]
	let top = borderRow;
	for (posY = borderRow - 1; posY >= 0; posY--) {
		const line = lines[posY];
		const gridSection = line.substring(left, right + 1);

		// Found column headers (letters/∞ but no pipes)
		if (COLUMN_HEADER_CHARS.test(gridSection) && !gridSection.includes(CELL_SEPARATOR)) {
			top = posY;
			break;
		}

		// Found data row (has pipes) - update top and keep scanning for headers
		if (gridSection.includes(CELL_SEPARATOR)) {
			top = posY;
			continue;
		}

		// Blank line or border - keep scanning
		if (!gridSection.trim() || gridSection.trim().startsWith('---')) {
			continue;
		}

		// Hit non-grid content - stop
		break;
	}

	// From border marker, scan DOWN to find bottom (last data row)
	let bottom = borderRow;
	for (posY = borderRow; posY < lines.length; posY++) {
		const line = lines[posY];

		// Data row - update bottom and continue
		if (DATA_ROW_LINE.test(line)) {
			bottom = posY;
			continue;
		}

		// Border line - keep scanning
		if (GRID_TOP_LEFT.test(line)) {
			continue;
		}

		// Hit non-grid content - stop
		break;
	}

	return [{
		left,
		right,
		top,
		bottom,
	}];
}

/**
 * Calculate grid column ranges based on grid positions and spacing.
 *
 * Range = grid boundary expanded left/right by half the spacing.
 * This accounts for centered grid names.
 */
function calculateGridRanges(
	lines: string[],
	gridBoundaries: Array<{ left: number; right: number; top: number; bottom: number }>,
): Array<{ left: number; right: number }> {
	if (gridBoundaries.length === 0) return [];

	const gridRanges: Array<{ left: number; right: number }> = [];
	const maxLen = Math.max(...lines.map((line) => line.length));

	for (let i = 0; i < gridBoundaries.length; i++) {
		const grid = gridBoundaries[i];
		const prevGrid = gridBoundaries[i - 1];
		const nextGrid = gridBoundaries[i + 1];

		// Calculate spacing to previous grid
		const leftSpacing = prevGrid ? grid.left - prevGrid.right - 1 : 0;

		// Calculate spacing to next grid
		const rightSpacing = nextGrid ? nextGrid.left - grid.right - 1 : 0;

		// Grid range extends left by half the left spacing
		const left = prevGrid ? grid.left - Math.floor(leftSpacing / 2) : 0;

		// Grid range extends right by half the right spacing
		const right = nextGrid ? grid.right + Math.floor(rightSpacing / 2) : maxLen - 1;

		gridRanges.push({ left, right });
	}

	return gridRanges;
}

//#endregion

/**
 * Viewport IR - reconstructed from parsed grid structure.
 * Mirrors the Viewport structure in render.ts.
 */
interface ParsedViewport {
	minX: number;
	minY: number;
	columnLabels: string[]; // Includes ∞ symbols
	rowLabels: string[]; // Includes ∞ symbols
	infinityEdges: {
		left: boolean;
		top: boolean;
		right: boolean;
		bottom: boolean;
	};
}

/**
 * Parse grid cells from lines, handling infinity edges.
 * Pipeline: Parse structure → Reconstruct viewport → Map cells to world coordinates
 */
function parseGridFromLines<T>(
	gridLines: string[],
	legend: Map<string, T>,
): QueryResult<T>[] {
	// Find column header line (first line with letters, ∞, or negative prefix -)
	const headerIdx = gridLines.findIndex((line) => COLUMN_HEADER_CHARS.test(line));
	if (headerIdx === -1) throw new Error('Parse error: No column headers found');

	// Parse column labels from header
	const headerLine = gridLines[headerIdx];
	const columnLabels = headerLine
		.trim()
		.split(/\s+/)
		.filter((s) => s && s !== CELL_SEPARATOR);

	// Parse row labels from data rows
	const rowLabels: string[] = [];
	for (let lineIdx = headerIdx + 1; lineIdx < gridLines.length; lineIdx++) {
		const line = gridLines[lineIdx];
		if (!DATA_ROW_LINE.test(line)) continue;

		const rowMatch = line.match(ROW_LABEL);
		if (rowMatch) {
			rowLabels.push(rowMatch[1]);
		}
	}

	// Reconstruct viewport (the IR)
	const viewport = reconstructViewport(columnLabels, rowLabels);

	// Parse cells using viewport mapping
	const results: QueryResult<T>[] = [];

	let rowIdx = 0;
	for (let lineIdx = headerIdx + 1; lineIdx < gridLines.length; lineIdx++) {
		const line = gridLines[lineIdx];
		if (!DATA_ROW_LINE.test(line)) continue;

		// Extract all cells: first cell is before the first |, rest are between | delimiters
		const cells: string[] = [];

		// Find first | to separate first cell from the rest
		const firstPipeIdx = line.indexOf(CELL_SEPARATOR);
		if (firstPipeIdx === -1) {
			// No pipes - skip this line
			rowIdx++;
			continue;
		}

		// Extract first cell (between row label and first |)
		const beforeFirstPipe = line.substring(0, firstPipeIdx);
		const rowLabelMatch = beforeFirstPipe.match(ROW_LABEL);
		if (rowLabelMatch) {
			const firstCell = beforeFirstPipe.substring(rowLabelMatch[0].length).trim();
			if (firstCell) { // Only add non-empty first cell
				cells.push(firstCell);
			}
		}

		// Extract remaining cells (between | delimiters)
		const afterFirstPipe = line.substring(firstPipeIdx + 1); // Skip the first |
		const remainingCells = afterFirstPipe
			.split(CELL_SEPARATOR)
			.map((c) => c.trim())
			.filter((c) => c); // Remove empty cells (from trailing |)
		cells.push(...remainingCells);

		// Process all cells
		for (let colIdx = 0; colIdx < cells.length; colIdx++) {
			const cell = cells[colIdx];
			if (!cell || cell === EMPTY_CELL) continue;

			const symbol = cell[0]; // First character is the symbol
			const value = legend.get(symbol);
			if (value === undefined) {
				throw new Error(`Parse error: No legend entry for symbol '${symbol}'`);
			}

			// Map grid position to world coordinate
			const worldX = gridToWorldX(colIdx, viewport);
			const worldY = gridToWorldY(rowIdx, viewport);

			// Single-cell rectangle
			const bounds: Rectangle = [worldX, worldY, worldX, worldY];

			results.push([bounds, value]);
		}

		rowIdx++;
	}

	return results;
}

/**
 * Reconstruct viewport from parsed column and row labels.
 * This is the inverse of buildColumnLabels/buildRowLabels in render.ts.
 */
function reconstructViewport(columnLabels: string[], rowLabels: string[]): ParsedViewport {
	// Detect infinity edges
	const infinityEdges = {
		left: columnLabels[0] === INFINITY_SYMBOL,
		right: columnLabels[columnLabels.length - 1] === INFINITY_SYMBOL,
		top: rowLabels[0] === INFINITY_SYMBOL,
		bottom: rowLabels[rowLabels.length - 1] === INFINITY_SYMBOL,
	};

	// Find min finite coordinates
	const finiteColumns = columnLabels.filter((l) => l !== INFINITY_SYMBOL);
	const finiteRows = rowLabels.filter((l) => l !== INFINITY_SYMBOL);

	const minX = finiteColumns.length > 0 ? letterToCol(finiteColumns[0]) : 0;
	const minY = finiteRows.length > 0 ? parseInt(finiteRows[0], 10) : 0;

	return {
		minX,
		minY,
		columnLabels,
		rowLabels,
		infinityEdges,
	};
}

/**
 * Map grid column index to world X coordinate.
 * Inverse of worldToGrid in render.ts.
 */
function gridToWorldX(gridX: number, viewport: ParsedViewport): number {
	if (gridX >= viewport.columnLabels.length) {
		throw new Error(
			`Parse error: Grid column ${gridX} out of bounds (have ${viewport.columnLabels.length} columns)`,
		);
	}
	const colLabel = viewport.columnLabels[gridX];
	if (colLabel === INFINITY_SYMBOL) return gridX === 0 ? -Infinity : Infinity;
	return letterToCol(colLabel);
}

/**
 * Map grid row index to world Y coordinate.
 * Inverse of worldToGrid in render.ts.
 */
function gridToWorldY(gridY: number, viewport: ParsedViewport): number {
	const rowLabel = viewport.rowLabels[gridY];
	if (rowLabel === INFINITY_SYMBOL) return gridY === 0 ? -Infinity : Infinity;
	return parseInt(rowLabel, 10);
}

//#endregion

//#region Utilities

/**
 * Convert spreadsheet-style letter to column number ('A' → 0, 'Z' → 25, 'AA' → 26, ...).
 * Handles negative columns: '-A' → -1, '-B' → -2, etc.
 *
 * Inverse of columnToLetter() from render.ts
 */
function letterToCol(letter: string): number {
	// Handle negative columns
	if (letter.startsWith('-')) {
		const positiveCol = letterToCol(letter.substring(1));
		return -(positiveCol + 1);
	}

	let col = 0;
	for (let i = 0; i < letter.length; i++) {
		col = col * 26 + (letter.charCodeAt(i) - 65 + 1);
	}
	return col - 1;
}

function parseLegend<T>(lines: string[]): Map<string, T> {
	const legend = new Map<string, T>();

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const match = trimmed.match(LEGEND_ENTRY);
		if (!match) continue;

		const symbol = match[1];
		const rawValue = match[2].trim();

		legend.set(symbol, parseValue<T>(rawValue));
	}

	return legend;
}

/**
 * Parse a legend value - supports objects, arrays, strings, numbers, booleans.
 *
 * Inverse of serializeValue() from render.ts
 */
function parseValue<T>(rawValue: string): T {
	try {
		return JSON.parse(rawValue) as T;
	} catch {
		return rawValue as T;
	}
}

//#endregion
