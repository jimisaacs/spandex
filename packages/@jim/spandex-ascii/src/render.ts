/**
 * ASCII renderer - 3-pass optimization
 *
 * Pass 1: Query + Analyze → validate + map symbols + compute viewport (single query iteration)
 * Pass 2: Build Grid → populate sparse grid from fragments
 * Pass 3: Format → render ASCII with borders, labels, legend
 */

import type { QueryResult, Rectangle } from '@jim/spandex';
import {
	ABSOLUTE_ORIGIN_MARKER,
	BORDER_CHAR,
	BORDER_LINE,
	CELL_SEPARATOR,
	CELL_WIDTH,
	COLUMN_SEPARATOR,
	EMPTY_CELL,
	INFINITY_SYMBOL,
} from './constants.ts';
import type { CoordinateSystem, RenderOptions } from './types.ts';

//#region Types

interface Extent {
	min: number;
	max: number;
}

interface InfinityEdges {
	left: boolean;
	top: boolean;
	right: boolean;
	bottom: boolean;
}

interface Viewport {
	worldBounds: Rectangle;
	width: number;
	height: number;
	infinityEdges: InfinityEdges;
}

type SparseGrid = Map<number, Map<number, string>>;

//#endregion

//#region Pass 1: Query + Analyze

function updateExtent(coord: number, extent: Extent): void {
	if (isFinite(coord)) {
		extent.min = Math.min(extent.min, coord);
		extent.max = Math.max(extent.max, coord);
	}
}

function analyzeQueryResults<T>(
	query: () => IterableIterator<QueryResult<T>>,
	legend: Record<string, T | Record<string, unknown>>,
	isAbsoluteCoordinateSystem: boolean,
	strict: boolean = false,
): readonly [fragments: [rect: Rectangle, symbol: string][], viewport: Viewport] {
	// Build symbol lookup
	const symbolLookup = new Map<string, string>();
	for (const [symbol, value] of Object.entries(legend)) {
		symbolLookup.set(serializeValue(value), symbol);
	}

	// Single pass: query + validate + analyze viewport + track usage
	const fragments: [rect: Rectangle, symbol: string][] = [];

	// Two-tier extent tracking: prioritize fully-finite rectangles over partial-infinity
	const extent = {
		fullyFinite: { x: { min: Infinity, max: -Infinity }, y: { min: Infinity, max: -Infinity } },
		partialInfinity: { x: { min: Infinity, max: -Infinity }, y: { min: Infinity, max: -Infinity } },
	};
	let hasFullyFinite = false;

	const infinityEdges: InfinityEdges = { left: false, top: false, right: false, bottom: false };
	const usedSymbols = strict ? new Set<string>() : null;

	for (const [rect, value] of query()) {
		// Validate and map to symbol
		const serialized = serializeValue(value);
		const symbol = symbolLookup.get(serialized);
		if (symbol == null) {
			throw new Error(`Render error: Legend missing symbol for value ${serialized} at [${rect.join(', ')}]`);
		}
		fragments.push([rect, symbol]);

		// Track symbol usage (strict mode only)
		if (usedSymbols) usedSymbols.add(symbol);

		// Analyze viewport
		const [x1, y1, x2, y2] = rect;

		// Update appropriate extent based on rectangle type
		const isFullyFinite = x1 !== -Infinity && x2 !== Infinity && y1 !== -Infinity && y2 !== Infinity;
		const target = isFullyFinite ? extent.fullyFinite : extent.partialInfinity;

		updateExtent(x1, target.x);
		updateExtent(x2, target.x);
		updateExtent(y1, target.y);
		updateExtent(y2, target.y);

		if (isFullyFinite) hasFullyFinite = true;

		// Detect infinity edges
		if (x1 === -Infinity) infinityEdges.left = true;
		if (x2 === Infinity) infinityEdges.right = true;
		if (y1 === -Infinity) infinityEdges.top = true;
		if (y2 === Infinity) infinityEdges.bottom = true;
	}

	// Choose extent: prefer fully-finite, fallback to partial-infinity
	const { x: xExtent, y: yExtent } = hasFullyFinite ? extent.fullyFinite : extent.partialInfinity;

	// Check if we have any finite data at all
	const hasFiniteX = isFinite(xExtent.min) && isFinite(xExtent.max);
	const hasFiniteY = isFinite(yExtent.min) && isFinite(yExtent.max);
	const hasAnyFiniteData = hasFiniteX || hasFiniteY;

	// Special case: no finite data and all 4 infinity edges → render as 1×1 grid
	if (!hasAnyFiniteData && infinityEdges.left && infinityEdges.right && infinityEdges.top && infinityEdges.bottom) {
		const viewport: Viewport = {
			worldBounds: [0, 0, 0, 0],
			width: 1,
			height: 1,
			infinityEdges,
		};

		// Strict mode validation still applies
		if (usedSymbols) {
			const difference = new Set(Object.keys(legend)).difference(usedSymbols);
			if (difference.size > 0) {
				throw new Error(
					`Render error (strict mode): Legend contains unused symbols: ${Array.from(difference).join(', ')}`,
				);
			}
		}

		return [fragments, viewport] as const;
	}

	// Normal case: compute world bounds with finite data
	// For dimensions without finite data, use dummy bounds (min=0, max=-1) to signal worldWidth/Height = 0
	const minX = hasFiniteX ? (isAbsoluteCoordinateSystem ? Math.min(0, xExtent.min) : xExtent.min) : 0;
	const maxX = hasFiniteX ? (isAbsoluteCoordinateSystem ? Math.max(0, xExtent.max) : xExtent.max) : -1; // Dummy: signals no finite extent (worldWidth = 0)
	const minY = hasFiniteY ? (isAbsoluteCoordinateSystem ? Math.min(0, yExtent.min) : yExtent.min) : 0;
	const maxY = hasFiniteY ? (isAbsoluteCoordinateSystem ? Math.max(0, yExtent.max) : yExtent.max) : -1; // Dummy: signals no finite extent (worldHeight = 0)

	const worldBounds: Rectangle = [minX, minY, maxX, maxY];

	// Compute viewport dimensions: finite region + infinity edge cells
	// If dimension has no finite data, worldWidth/Height = 0 (only show infinity edges)
	const worldWidth = hasFiniteX ? (maxX - minX + 1) : 0;
	const worldHeight = hasFiniteY ? (maxY - minY + 1) : 0;
	const width = worldWidth + (infinityEdges.left ? 1 : 0) + (infinityEdges.right ? 1 : 0);
	const height = worldHeight + (infinityEdges.top ? 1 : 0) + (infinityEdges.bottom ? 1 : 0);

	const viewport: Viewport = { worldBounds, width, height, infinityEdges };

	// Strict mode: validate all legend symbols were used
	if (usedSymbols) {
		const difference = new Set(Object.keys(legend)).difference(usedSymbols);
		if (difference.size > 0) {
			throw new Error(
				`Render error (strict mode): Legend contains unused symbols: ${Array.from(difference).join(', ')}`,
			);
		}
	}

	return [fragments, viewport] as const;
}

//#endregion

//#region Pass 2: Build Grid

function worldToGrid(worldX: number, worldY: number, viewport: Viewport): [gridX: number, gridY: number] {
	const [minX, minY] = viewport.worldBounds;
	const { infinityEdges } = viewport;
	const xOffset = infinityEdges.left ? 1 : 0;
	const yOffset = infinityEdges.top ? 1 : 0;
	return [worldX - minX + xOffset, worldY - minY + yOffset];
}

function clip(coord: number, min: number, max: number): number {
	return Math.max(min, Math.min(coord, max));
}

function setCell(grid: SparseGrid, x: number, y: number, symbol: string): void {
	if (!grid.has(y)) grid.set(y, new Map());
	grid.get(y)!.set(x, symbol);
}

function fillFiniteRegion(
	grid: SparseGrid,
	rect: Rectangle,
	symbol: string,
	viewport: Viewport,
): void {
	const [x1, y1, x2, y2] = rect;
	const [minX, minY, maxX, maxY] = viewport.worldBounds;

	// Skip if viewport has no finite extent (e.g., only infinity edges)
	if (maxX < minX || maxY < minY) return;

	// Skip if rectangle doesn't intersect viewport (check BEFORE clipping)
	if (x2 < minX || x1 > maxX || y2 < minY || y1 > maxY) return;

	const clippedX1 = clip(x1, minX, maxX);
	const clippedX2 = clip(x2, minX, maxX);
	const clippedY1 = clip(y1, minY, maxY);
	const clippedY2 = clip(y2, minY, maxY);

	for (let worldY = clippedY1; worldY <= clippedY2; worldY++) {
		for (let worldX = clippedX1; worldX <= clippedX2; worldX++) {
			const [gridX, gridY] = worldToGrid(worldX, worldY, viewport);
			setCell(grid, gridX, gridY, symbol);
		}
	}
}

function fillInfiniteEdges(
	grid: SparseGrid,
	rect: Rectangle,
	symbol: string,
	viewport: Viewport,
): void {
	const [x1, y1, x2, y2] = rect;
	const [minX, minY, maxX, maxY] = viewport.worldBounds;
	const { infinityEdges, width, height } = viewport;

	// Vertical infinity edges (left/right)
	if (x1 === -Infinity || x2 === Infinity) {
		const edgeClippedY1 = clip(y1, minY, maxY);
		const edgeClippedY2 = clip(y2, minY, maxY);
		const yOffset = infinityEdges.top ? 1 : 0;
		if (x1 === -Infinity && infinityEdges.left) {
			for (let worldY = edgeClippedY1; worldY <= edgeClippedY2; worldY++) {
				const gridY = worldY - minY + yOffset;
				setCell(grid, 0, gridY, symbol);
			}
		}
		if (x2 === Infinity && infinityEdges.right) {
			for (let worldY = edgeClippedY1; worldY <= edgeClippedY2; worldY++) {
				const gridY = worldY - minY + yOffset;
				setCell(grid, width - 1, gridY, symbol);
			}
		}
	}

	// Horizontal infinity edges (top/bottom)
	if (y1 === -Infinity || y2 === Infinity) {
		const edgeClippedX1 = clip(x1, minX, maxX);
		const edgeClippedX2 = clip(x2, minX, maxX);
		const xOffset = infinityEdges.left ? 1 : 0;
		if (y1 === -Infinity && infinityEdges.top) {
			for (let worldX = edgeClippedX1; worldX <= edgeClippedX2; worldX++) {
				const gridX = worldX - minX + xOffset;
				setCell(grid, gridX, 0, symbol);
			}
		}
		if (y2 === Infinity && infinityEdges.bottom) {
			for (let worldX = edgeClippedX1; worldX <= edgeClippedX2; worldX++) {
				const gridX = worldX - minX + xOffset;
				setCell(grid, gridX, height - 1, symbol);
			}
		}
	}
}

function fillInfiniteCorners(
	grid: SparseGrid,
	rect: Rectangle,
	symbol: string,
	viewport: Viewport,
): void {
	const [x1, y1, x2, y2] = rect;
	const { infinityEdges, width, height } = viewport;

	if (infinityEdges.left && infinityEdges.top && x1 === -Infinity && y1 === -Infinity) {
		setCell(grid, 0, 0, symbol);
	}
	if (infinityEdges.right && infinityEdges.top && x2 === Infinity && y1 === -Infinity) {
		setCell(grid, width - 1, 0, symbol);
	}
	if (infinityEdges.left && infinityEdges.bottom && x1 === -Infinity && y2 === Infinity) {
		setCell(grid, 0, height - 1, symbol);
	}
	if (infinityEdges.right && infinityEdges.bottom && x2 === Infinity && y2 === Infinity) {
		setCell(grid, width - 1, height - 1, symbol);
	}
}

//#endregion

//#region Pass 3: Format

function buildColumnLabels(viewport: Viewport): string[] {
	const { worldBounds: [minX], infinityEdges, width } = viewport;
	const labels: string[] = [];

	// Special case: totally infinite dimension (width=1, both edges)
	if (width === 1 && infinityEdges.left && infinityEdges.right) {
		return [INFINITY_SYMBOL];
	}

	if (infinityEdges.left) labels.push(INFINITY_SYMBOL);

	const numFiniteColumns = width - (infinityEdges.left ? 1 : 0) - (infinityEdges.right ? 1 : 0);
	for (let i = 0; i < numFiniteColumns; i++) {
		labels.push(columnToLetter(minX + i));
	}

	if (infinityEdges.right) labels.push(INFINITY_SYMBOL);

	return labels;
}

function buildRowLabels(viewport: Viewport): string[] {
	const [, minY] = viewport.worldBounds;
	const { infinityEdges, height } = viewport;
	const labels: string[] = [];

	// Special case: totally infinite dimension (height=1, both edges)
	if (height === 1 && infinityEdges.top && infinityEdges.bottom) {
		return [INFINITY_SYMBOL];
	}

	if (infinityEdges.top) labels.push(INFINITY_SYMBOL);

	const numFiniteRows = height - (infinityEdges.top ? 1 : 0) - (infinityEdges.bottom ? 1 : 0);
	for (let i = 0; i < numFiniteRows; i++) {
		labels.push(String(minY + i));
	}

	if (infinityEdges.bottom) labels.push(INFINITY_SYMBOL);

	return labels;
}

function formatToAscii(
	grid: SparseGrid,
	viewport: Viewport,
	legend: Record<string, unknown>,
	gridOnly: boolean = false,
	isAbsoluteCoordinateSystem: boolean,
): string {
	const lines: string[] = [];
	const { width, height, infinityEdges, worldBounds } = viewport;
	const [minX, minY] = worldBounds;

	const columnLabels = buildColumnLabels(viewport);
	const rowLabels = buildRowLabels(viewport);
	const rowLabelWidth = rowLabels.length > 0 ? Math.max(...rowLabels.map((l) => l.length)) : 0;

	// Calculate where (0,0) cell is in grid coordinates (for absolute mode marker)
	const originGridX = isAbsoluteCoordinateSystem ? 0 - minX : -1; // -1 means not applicable
	const originGridY = isAbsoluteCoordinateSystem ? 0 - minY : -1;

	// Helper: center text within cell width
	// Algorithm: leftPad = floor(CELL_WIDTH/2) - floor(text.length/2)
	// This centers single-char text, and left-aligns multi-char (e.g., "-A" becomes "- A ")
	const centerInCell = (text: string): string => {
		const leftPad = Math.floor(CELL_WIDTH / 2) - Math.floor(text.length / 2);
		const rightPad = CELL_WIDTH - text.length - leftPad;
		return EMPTY_CELL.repeat(leftPad) + text + EMPTY_CELL.repeat(rightPad);
	};

	// Helper: render a row with label and cells
	const renderRow = (label: string, cells: string[], hideBorders = false): string => {
		const paddedLabel = label.padStart(rowLabelWidth, EMPTY_CELL);
		const cellSep = hideBorders ? EMPTY_CELL : CELL_SEPARATOR;
		const leftSeparator = infinityEdges.left ? EMPTY_CELL : cellSep;
		const rightSeparator = infinityEdges.right ? '' : cellSep;
		return `${paddedLabel}${COLUMN_SEPARATOR}${leftSeparator}${cells.join(cellSep)}${rightSeparator}`;
	};

	// Column header - render with borders hidden for clean look
	const headerCells = columnLabels.map(centerInCell);
	lines.push(renderRow('', headerCells, true));

	// Helper: Build a border line, optionally marking (0,0) cell with *
	const buildBorder = (forRow: number): string => {
		let result = '';
		for (let x = 0; x < width; x++) {
			const corner = (isAbsoluteCoordinateSystem && forRow === originGridY && x === originGridX)
				? ABSOLUTE_ORIGIN_MARKER
				: BORDER_CHAR;
			result += corner + BORDER_LINE;
		}
		result += infinityEdges.right ? '' : BORDER_CHAR;
		if (infinityEdges.left) result = EMPTY_CELL + result.substring(1);
		return EMPTY_CELL.repeat(rowLabelWidth) + COLUMN_SEPARATOR + result;
	};

	// Build top border once (reused for blank line length and/or first border)
	const topBorder = buildBorder(0);

	// Blank spacer line for top infinity edge
	if (infinityEdges.top) {
		lines.push(EMPTY_CELL.repeat(topBorder.length));
	}

	// Data rows
	for (let y = 0; y < height; y++) {
		const isFirstRow = y === 0;
		const isLastRow = y === height - 1;
		const isTopInfinity = isFirstRow && infinityEdges.top;

		if (!isTopInfinity) lines.push(isFirstRow ? topBorder : buildBorder(y));

		const rowLabel = rowLabels[y];
		const row = grid.get(y);
		const cells: string[] = [];

		for (let x = 0; x < width; x++) {
			const symbol = row?.get(x) ?? EMPTY_CELL;
			cells.push(centerInCell(symbol));
		}

		lines.push(renderRow(rowLabel, cells));

		if (isLastRow && !infinityEdges.bottom) {
			lines.push(buildBorder(y + 1));
		}
	}

	// Footer (legend + infinity annotations) - skip if gridOnly
	if (!gridOnly) {
		// Legend
		lines.push('');
		formatLegend(legend).forEach((line) => lines.push(line));

		// Infinity annotation
		const edges = (['left', 'top', 'right', 'bottom'] as const)
			.filter((edge) => infinityEdges[edge]);

		if (edges.length > 0) {
			const edgeLabel = edges.length === 1 ? `${INFINITY_SYMBOL} edge` : `${INFINITY_SYMBOL} edges`;
			lines.push('', `(${edgeLabel}: ${edges.join(', ')})`);
		}
	}

	return lines.join('\n');
}

//#endregion

//#region Utilities

/**
 * Serialize a value to string for legend and symbol matching.
 *
 * Inverse of parseValue() from parse.ts
 */
function serializeValue(value: unknown): string {
	if (typeof value === 'object' && value != null && !Array.isArray(value)) {
		const entries = Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `"${k}": ${serializeValue(v)}`)
			.join(', ');
		return `{ ${entries} }`;
	}
	return JSON.stringify(value);
}

/**
 * Format legend entries as lines
 *
 * @param legend - Legend mapping symbols to values
 * @returns Array of formatted legend lines (sorted by symbol)
 */
export function formatLegend(legend: Record<string, unknown>): string[] {
	return Object.entries(legend)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([symbol, value]) => `${symbol} = ${serializeValue(value)}`);
}

/**
 * Convert column number to spreadsheet-style letter (0 → 'A', 25 → 'Z', 26 → 'AA', ...).
 * Negative columns get '-' prefix: -1 → '-A', -2 → '-B', etc.
 *
 * Inverse of letterToCol() from parse.ts
 */
function columnToLetter(col: number): string {
	if (col < 0) return '-' + columnToLetter(-col - 1);
	if (col < 26) return String.fromCharCode(65 + col);
	return columnToLetter(Math.floor(col / 26) - 1) + columnToLetter(col % 26);
}

function getDefaultCoordinateSystem(): CoordinateSystem {
	return Deno.env.get('COORDINATE_SYSTEM') === 'absolute' ? 'absolute' : 'viewport';
}

//#endregion

//#region Public API

/**
 * Render spatial query results to ASCII grid
 *
 * @param query - Function that returns query results as [Rectangle, T] pairs
 * @param legend - Maps symbols to values (all query values must be present)
 * @param options - Rendering options
 * @returns ASCII grid with borders, labels, and legend
 * @throws Error if any query value is missing from legend
 */
export function render<T>(
	query: () => IterableIterator<QueryResult<T>>,
	legend: Record<string, T | Record<string, unknown>>,
	{ strict, coordinateSystem = getDefaultCoordinateSystem(), gridOnly }: RenderOptions = {},
): string {
	const isAbsoluteCoordinateSystem = coordinateSystem === 'absolute';

	// Pass 1: Query + analyze (single query iteration)
	const [fragments, viewport] = analyzeQueryResults(query, legend, isAbsoluteCoordinateSystem, strict);

	// Pass 2: Build grid (single fragments iteration)
	const grid: SparseGrid = new Map();
	for (const [rect, symbol] of fragments) {
		// Fill the finite intersection of this rectangle with the viewport (works for all rectangles)
		fillFiniteRegion(grid, rect, symbol, viewport);

		// Additionally fill infinity edge/corner cells for rectangles that extend to infinity
		fillInfiniteEdges(grid, rect, symbol, viewport);
		fillInfiniteCorners(grid, rect, symbol, viewport);
	}

	// Pass 3: Format (single grid iteration)
	return formatToAscii(grid, viewport, legend, gridOnly, isAbsoluteCoordinateSystem);
}

//#endregion
