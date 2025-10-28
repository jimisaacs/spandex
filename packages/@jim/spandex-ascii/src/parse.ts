/**
 * ASCII grid parser - inverse of render()
 *
 * Pipeline: ASCII text → Find grid boundaries → Extract sections → Parse grids via stride-based extraction
 *
 * Parsing strategy:
 * - Uses GRID_TOP_LEFT pattern to find grid boundaries
 * - Uses deterministic grid structure (column labels, border, data rows at even indices)
 * - All label and cell extraction uses calculated positions (stride-based)
 */

import type { ExtentResult, QueryResult } from '@jim/spandex';
import { computeExtent } from '@jim/spandex/extent';
import * as r from '@jim/spandex/r';
import { CELL_WIDTH, EMPTY_CELL, JUNCTIONS, LABELS, LINES } from './constants.ts';
import { letterToColumn, parseRowLabel } from './coordinates.ts';

//#region Lexical Patterns

const STRIDE = CELL_WIDTH + 1; // Cell width + separator
const DATA_ROW_STRIDE = 2; // Border line (1) + data row (1)

function buildGridTopLeftPattern(): string {
	const junctions = Object.values(JUNCTIONS).map((j) => `\\${typeof j === 'string' ? j : j.cornerTopLeft}`).join('|');
	const lines = Object.values(LINES).map((j) => `\\${j.horizontal}`).join('|');
	return `(?:${junctions})(?:${lines}){${CELL_WIDTH}}`;
}

/**
 * Matches grid top-left corner patterns.
 *
 * Matches row label column (optional whitespace + SEPARATORS.row) followed by
 * top-left junction + horizontal line pattern for each grid type:
 * - Bounded: `┏━━━` or `*━━━` (with origin)
 * - Semi: `+───` or `*───` (with origin)
 * - Unbounded: `·   ` or `*   ` (with origin)
 */
const CELLS_TOP_LEFT_CANDIDATE = new RegExp(buildGridTopLeftPattern());

/** Matches legend entry: single character, " = ", value (e.g., "R = "RED"") */
const LEGEND_ENTRY = /^(.) = (.+)$/;

//#endregion

//#region Section Extraction

/**
 * Extract grids and legend sections from input lines.
 * Returns grid sections with boundaries (including labels) and legend lines.
 */
function extractSections(lines: string[]): {
	grids: Array<{ name: string | undefined; lines: string[]; boundary: GridBoundaryWithLabels }>;
	legendLines: string[];
} {
	const gridBoundaries = findGridBoundaries(lines);
	if (gridBoundaries.length === 0) return { grids: [], legendLines: [] };

	// Single pass: find extent
	let topmost = Infinity;
	let bottommost = -Infinity;

	for (const boundary of gridBoundaries) {
		if (boundary.topLine < topmost) topmost = boundary.topLine;
		if (boundary.bottomLine > bottommost) bottommost = boundary.bottomLine;
	}

	const linesAbove = lines.slice(0, topmost);
	const legendLines = lines.slice(bottommost + 1).filter((line) => line.trim());
	const gridNames = parseGridNames(linesAbove, gridBoundaries.length);

	const grids = gridBoundaries.map((boundary, i) => ({
		name: gridNames[i],
		lines: lines.slice(boundary.topLine, boundary.bottomLine + 1),
		boundary,
	}));

	return { grids, legendLines };
}

/**
 * Parse grid names by finding content regions separated by spacing (2+ spaces).
 * Grid names are rendered with spacing between them (default 3 spaces).
 */
function parseGridNames(linesAbove: string[], gridCount: number): Array<string | undefined> {
	if (linesAbove.length === 0) return Array(gridCount).fill(undefined);

	const nameLine = linesAbove.find((line) => line.trim()) || '';
	if (!nameLine.trim()) return Array(gridCount).fill(undefined);

	// Find content regions separated by 2+ consecutive spaces
	const regions: Array<{ start: number; end: number }> = [];
	let inContent = false;
	let start = 0;

	for (let i = 0; i <= nameLine.length; i++) {
		const isSpace = i === nameLine.length || nameLine[i] === ' ';

		if (!isSpace && !inContent) {
			start = i;
			inContent = true;
		} else if (isSpace && inContent) {
			// Look ahead for spacing gap (2+ consecutive spaces)
			let spaceCount = 0;
			let j = i;
			while (j < nameLine.length && nameLine[j] === ' ') {
				spaceCount++;
				j++;
			}

			if (spaceCount >= 2 || j === nameLine.length) {
				regions.push({ start, end: i });
				inContent = false;
			}
		}
	}

	return regions.slice(0, gridCount).map((r) => nameLine.substring(r.start, r.end).trim() || undefined);
}

interface GridBoundaryWithLabels {
	// Line range for this grid (including labels)
	topLine: number;
	bottomLine: number;
	// X position where cells start (first junction)
	cellsXStart: number;
	// Labels
	columnLabels: string[];
	rowLabels: string[];
}

/**
 * Find all grid boundaries and labels using column label analysis.
 *
 * Algorithm (see .temp/grid-parsing-algorithm.md):
 * 1. Find border line with CELLS_TOP_CANDIDATE pattern
 * 2. Parse column labels (stride-based) to find grid cells xmin/xmax
 * 3. Scan down for grid cells ymax and parse row labels
 * 4. Return boundaries with all labels included
 */
function findGridBoundaries(lines: string[]): GridBoundaryWithLabels[] {
	// Step 1: Find border line containing cell top border pattern
	let borderLine = -1;
	for (let y = 0; y < lines.length; y++) {
		if (CELLS_TOP_LEFT_CANDIDATE.test(lines[y]!)) {
			borderLine = y;
			break;
		}
	}
	// Border line must be at least 1 to have any labels
	if (borderLine < 1) return [];

	const columnLabelLineIndex = borderLine - 1;
	const columnLabelLine = lines[columnLabelLineIndex]!;
	const borderLineText = lines[borderLine]!;

	// Step 2: Find all grid cell boundaries using CELLS_TOP_CANDIDATE pattern
	// Each match gives us a cell's top border (left junction to right junction)
	interface GridInfo {
		cellsXmin: number; // Left junction position
		cellsXmax: number; // Right junction position
		columnLabels: string[];
	}

	const grids: GridInfo[] = [];
	const leftPattern = new RegExp(CELLS_TOP_LEFT_CANDIDATE.source, 'g');

	// Find all grid starts in the border line
	matchLoop: for (let match: RegExpExecArray | null; (match = leftPattern.exec(borderLineText)) !== null;) {
		const cellsXmin = match.index;
		const columnLabels: string[] = [];

		// Parse column labels starting from first cell (1 char after left junction)
		for (let x = cellsXmin + 1; x < columnLabelLine.length; x += STRIDE) {
			const label = columnLabelLine.substring(x, x + CELL_WIDTH).trim();
			// Empty - end of this grid's labels
			if (!label) break;
			columnLabels.push(label);
		}

		if (columnLabels.length > 0) {
			// cellsXmax is the position of the rightmost junction
			// From left junction, each cell takes STRIDE (CELL_WIDTH + 1 for junction)
			const cellsXmax = cellsXmin + columnLabels.length * STRIDE;
			grids.push({ cellsXmin, cellsXmax, columnLabels });
			// Continue searching after this grid's right edge
			leftPattern.lastIndex = cellsXmax + 1;
		} else {
			// No column labels means end of parsing
			break matchLoop;
		}
	}

	if (!grids.length) return [];

	// Step 3: For each grid, scan down to find cellsYmax and collect row labels
	const boundaries: GridBoundaryWithLabels[] = [];

	for (let gridIdx = 0; gridIdx < grids.length; gridIdx++) {
		const grid = grids[gridIdx];
		const ymin = columnLabelLineIndex;
		let cellsYmax = borderLine;
		const rowLabels: string[] = [];

		// Determine row label extraction range
		// For first grid: from start of line to grid's cellsXmin
		// For subsequent grids: from previous grid's cellsXmax+1 to current grid's cellsXmin
		const rowLabelStart = gridIdx === 0 ? 0 : grids[gridIdx - 1]!.cellsXmax + 1;
		const rowLabelEnd = grid!.cellsXmin;

		// Scan down from border to find last row with label and collect all row labels
		// Data rows are at: borderLine + 1, borderLine + 3, borderLine + 5, ...
		// (border at line N, then data at N+1, then interior border at N+2, then data at N+3, etc.)
		for (let y = borderLine + 1; y < lines.length; y += DATA_ROW_STRIDE) {
			const rowLine = lines[y]!;
			if (!rowLine || !rowLine.trim()) break; // Empty line signals end

			// Row label area: between previous grid's end and current grid's start
			const rowLabel = rowLine.substring(rowLabelStart, rowLabelEnd).trim();

			if (rowLabel) {
				rowLabels.push(rowLabel);
				cellsYmax = y;
			} else {
				break; // No row label means end of grid
			}
		}

		boundaries.push({
			topLine: ymin,
			bottomLine: cellsYmax + 1, // Include bottom border line
			cellsXStart: grid!.cellsXmin,
			columnLabels: grid!.columnLabels,
			rowLabels,
		});
	}

	return boundaries;
}

//#endregion

//#region Grid Parsing

/**
 * Parse grid from lines - extract cells and detect origin marker.
 */
function parseGridFromLines<T>(
	gridLines: string[],
	columnLabels: string[],
	rowLabels: string[],
	legend: Map<string, T>,
	boundary: GridBoundaryWithLabels,
): { results: QueryResult<T>[]; extent: ExtentResult; includeOrigin: boolean } {
	// Detect origin marker
	let includeOrigin = false;
	for (let lineIdx = 1; lineIdx < gridLines.length; lineIdx += 2) {
		const line = gridLines[lineIdx]!;
		for (let col = 0; col <= columnLabels.length; col++) {
			const junctionX = boundary.cellsXStart + col * STRIDE;
			if (line[junctionX] === '*') {
				includeOrigin = true;
				break;
			}
		}
		if (includeOrigin) break;
	}

	// Extract cell symbols
	const cellsByRow: string[][] = [];
	// Data rows start at line 2 (0=column labels, 1=top border), then every DATA_ROW_STRIDE lines
	for (
		let lineIdx = DATA_ROW_STRIDE;
		lineIdx < gridLines.length && cellsByRow.length < rowLabels.length;
		lineIdx += DATA_ROW_STRIDE
	) {
		const line = gridLines[lineIdx]!;
		const cells: string[] = [];
		for (let col = 0; col < columnLabels.length; col++) {
			const cellX = boundary.cellsXStart + col * STRIDE + 1;
			cells.push(line.substring(cellX, cellX + CELL_WIDTH).trim());
		}
		cellsByRow.push(cells);
	}

	const { results, extent } = cellsToQueryResults(columnLabels, rowLabels, cellsByRow, legend, gridLines, boundary);
	return { results, extent, includeOrigin };
}

/**
 * Convert cells to query results.
 *
 * Simple approach:
 * 1. Map labels to coordinates (finite labels = their coordinate, infinity = null for now)
 * 2. For each cell, inspect its 4 borders
 * 3. Use label coordinates + border inspection to determine bounds
 */
function cellsToQueryResults<T>(
	columnLabels: string[],
	rowLabels: string[],
	cellsByRow: string[][],
	legend: Map<string, T>,
	gridLines: string[],
	boundary: GridBoundaryWithLabels,
): { results: QueryResult<T>[]; extent: ExtentResult } {
	if (columnLabels.length === 0 || rowLabels.length === 0) {
		throw new Error('Parse error: Grid must have at least one column and one row');
	}

	// Empty grid check
	if (
		columnLabels.length === 1 && columnLabels[0] === LABELS.emptySet &&
		rowLabels.length === 1 && rowLabels[0] === LABELS.emptySet
	) {
		return { results: [], extent: { mbr: r.ZERO, edges: r.ALL_EDGES, empty: true } };
	}

	const results: QueryResult<T>[] = [];

	// Map labels to coordinates
	// For finite labels: direct coordinate
	// For infinity labels: we need to infer from adjacent finite labels
	const colCoords: Map<number, number> = new Map();
	const rowCoords: Map<number, number> = new Map();

	// First pass: map all finite labels
	for (let i = 0; i < columnLabels.length; i++) {
		if (columnLabels[i] !== LABELS.infinity) {
			colCoords.set(i, letterToColumn(columnLabels[i]!));
		}
	}
	for (let i = 0; i < rowLabels.length; i++) {
		if (rowLabels[i] !== LABELS.infinity) {
			rowCoords.set(i, parseRowLabel(rowLabels[i]!));
		}
	}

	// Process each cell
	for (let rowIdx = 0; rowIdx < rowLabels.length; rowIdx++) {
		const cells = cellsByRow[rowIdx]!;
		for (let colIdx = 0; colIdx < columnLabels.length; colIdx++) {
			const cell = cells[colIdx];
			if (!cell || cell === EMPTY_CELL) continue;

			const value = legend.get(cell[0]!);
			if (value == null) {
				throw new Error(
					`Parse error: No legend entry for symbol '${cell[0]}' at cell (col=${colIdx}, row=${rowIdx}). ` +
						`Available legend keys: ${[...legend.keys()].join(', ')}`,
				);
			}

			// Get borders
			const dataLineIdx = DATA_ROW_STRIDE + rowIdx * DATA_ROW_STRIDE;
			const leftJunctionX = boundary.cellsXStart + colIdx * STRIDE;
			const rightJunctionX = leftJunctionX + STRIDE;

			const dataLine = gridLines[dataLineIdx]!;
			const topLine = gridLines[dataLineIdx - 1]!;
			const bottomLine = gridLines[dataLineIdx + 1] || '';

			const leftChar = dataLine[leftJunctionX] || ' ';
			const rightChar = dataLine[rightJunctionX] || ' ';
			const topSegment = topLine.substring(leftJunctionX + 1, rightJunctionX);
			const bottomSegment = bottomLine.substring(leftJunctionX + 1, rightJunctionX);

			const hasLeft = leftChar === '│' || leftChar === '┃';
			const hasRight = rightChar === '│' || rightChar === '┃';
			// Border exists only if there's an actual line segment, not just corner junctions
			const hasTop = /[─━]/.test(topSegment);
			const hasBottom = /[─━]/.test(bottomSegment);

			// Determine coordinates
			const colCoord = colCoords.get(colIdx);
			const rowCoord = rowCoords.get(rowIdx);
			let xmin: number, xmax: number, ymin: number, ymax: number;

			// X coordinates
			if (colCoord !== undefined) {
				// Finite column label - check borders for extent
				if (!hasLeft && !hasRight) {
					// No vertical borders at all - extends infinitely in X
					xmin = r.negInf;
					xmax = r.posInf;
				} else {
					// Has vertical borders - bounded in X
					xmin = hasLeft ? colCoord : r.negInf;
					xmax = hasRight ? colCoord : r.posInf;
				}
			} else {
				// Infinity column - use helper to infer from neighbors
				[xmin, xmax] = inferInfinityBounds(hasLeft, hasRight, colIdx, colCoords, columnLabels.length);
			}

			// Y coordinates
			if (rowCoord !== undefined) {
				// Finite row label - check horizontal borders
				ymin = hasTop ? rowCoord : r.negInf;
				ymax = hasBottom ? rowCoord : r.posInf;
			} else {
				// Infinity row - use helper to infer from neighbors
				[ymin, ymax] = inferInfinityBounds(hasTop, hasBottom, rowIdx, rowCoords, rowLabels.length);
			}

			results.push([[xmin, ymin, xmax, ymax], value]);
		}
	}

	const extent = computeExtent(results);
	return { results, extent };
}

//#endregion

//#region Utilities

/**
 * Infer coordinate bounds for infinity label cells based on borders and neighbor coordinates.
 */
function inferInfinityBounds(
	hasMin: boolean,
	hasMax: boolean,
	currentIdx: number,
	coords: Map<number, number>,
	maxIdx: number,
): [number, number] {
	if (!hasMin && !hasMax) {
		return [r.negInf, r.posInf];
	}

	let minCoord: number | undefined;
	let maxCoord: number | undefined;

	// Look backward for finite coordinate
	for (let i = currentIdx - 1; i >= 0; i--) {
		const c = coords.get(i);
		if (c !== undefined) {
			minCoord = c;
			break;
		}
	}

	// Look forward for finite coordinate
	for (let i = currentIdx + 1; i < maxIdx; i++) {
		const c = coords.get(i);
		if (c !== undefined) {
			maxCoord = c;
			break;
		}
	}

	const min = hasMin
		? (minCoord !== undefined ? minCoord + 1 : maxCoord !== undefined ? maxCoord - 1 : r.negInf)
		: r.negInf;
	const max = hasMax
		? (maxCoord !== undefined ? maxCoord - 1 : minCoord !== undefined ? minCoord + 1 : r.posInf)
		: r.posInf;

	return [min, max];
}

function parseLegend<T>(lines: string[]): Map<string, T> {
	const legend = new Map<string, T>();

	for (const line of lines) {
		const match = line.trim().match(LEGEND_ENTRY);
		if (!match) continue;

		const symbol = match[1]!;
		const rawValue = match[2]!.trim();
		legend.set(symbol, parseValue<T>(rawValue));
	}
	return legend;
}

/**
 * Parse legend value (supports JSON or plain string).
 *
 * Attempts JSON parsing first for structured values (objects, arrays, numbers, booleans).
 * Falls back to string if JSON parsing fails (for unquoted strings).
 */
function parseValue<T>(rawValue: string): T {
	try {
		return JSON.parse(rawValue) as T;
	} catch (err) {
		// Only swallow SyntaxError (expected for unquoted strings)
		// Re-throw critical errors (OOM, stack overflow, etc.)
		if (err instanceof SyntaxError) {
			return rawValue as T;
		}
		throw err;
	}
}

//#endregion

//#region Public API

/**
 * Parse rendered ASCII grid(s) back to query results.
 *
 * Handles single grids and multi-grid progressions (horizontal layout).
 */
export function parse<T = unknown>(ascii: string): {
	grids: Array<{ name: string | undefined; results: QueryResult<T>[]; extent: ExtentResult; includeOrigin: boolean }>;
	legend: Record<string, T>;
} {
	const lines = ascii.split('\n').map((line) => line.trimEnd());
	const sections = extractSections(lines);

	if (sections.grids.length === 0) {
		throw new Error('Parse error: No grids found in input');
	}

	const legend = parseLegend<T>(sections.legendLines);
	const grids = sections.grids.map(({ name, lines, boundary }) => {
		const { results, extent, includeOrigin } = parseGridFromLines<T>(
			lines,
			boundary.columnLabels,
			boundary.rowLabels,
			legend,
			boundary,
		);
		return { name, results, extent, includeOrigin };
	});

	return { grids, legend: Object.fromEntries(legend) };
}

//#endregion
