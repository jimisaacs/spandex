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

/**
 * Extent - the min/max coordinate range along a single axis.
 *
 * Used as an accumulator during query analysis to track the bounding box
 * of all rectangles. For example, if processing rectangles with X coordinates
 * [0,10], [5,15], [-3,8], the X extent would be { min: -3, max: 15 }.
 */
interface Extent {
	min: number;
	max: number;
}

/** Which edges of the viewport extend to infinity */
interface InfinityEdges {
	left: boolean;
	top: boolean;
	right: boolean;
	bottom: boolean;
}

/** Viewport metadata for rendering - world coordinate bounds and grid dimensions */
interface Viewport {
	worldBounds: Rectangle;
	width: number;
	height: number;
	infinityEdges: InfinityEdges;
}

/**
 * Spatial summary of query results - aggregate properties computed from rectangles.
 *
 * Tracks two separate bounding boxes:
 * - fullyFinite: rectangles with no infinity edges (used for compact viewport)
 * - partialInfinity: rectangles with at least one infinity edge (fallback if no finite data)
 */
interface SpatialSummary {
	fullyFinite: { x: Extent; y: Extent };
	partialInfinity: { x: Extent; y: Extent };
	hasFullyFinite: boolean;
	infinityEdges: InfinityEdges;
}

/** Processed query result - rectangle mapped to legend symbol */
type Fragment = readonly [rect: Rectangle, symbol: string];

/** Sparse 2D grid: Y coordinate → X coordinate → symbol */
type SparseGrid = Map<number, Map<number, string>>;

//#endregion

//#region Pass 1: Query + Analyze

/**
 * Update extent accumulator with a new coordinate value.
 * Expands the min/max range to include the coordinate (ignores infinities).
 */
function updateExtent(coord: number, extent: Extent): void {
	if (!isFinite(coord)) return;
	extent.min = Math.min(extent.min, coord);
	extent.max = Math.max(extent.max, coord);
}

function validateStrictMode(legend: Record<string, unknown>, usedSymbols: Set<string> | null): void {
	if (!usedSymbols) return;

	const unusedSymbols = new Set(Object.keys(legend)).difference(usedSymbols);
	if (unusedSymbols.size) {
		throw new Error(
			`Render error (strict mode): Legend contains unused symbols: ${[...unusedSymbols].join(', ')}`,
		);
	}
}

function computeAxisBounds(extent: Extent, includeOrigin: boolean): [min: number, max: number] {
	const hasFiniteData = isFinite(extent.min) && isFinite(extent.max);
	if (!hasFiniteData) return [0, -1]; // Sentinel: signals no extent

	return [
		includeOrigin ? Math.min(0, extent.min) : extent.min,
		includeOrigin ? Math.max(0, extent.max) : extent.max,
	];
}

function computeViewportBounds(xExtent: Extent, yExtent: Extent, isAbsolute: boolean): Rectangle {
	const [minX, maxX] = computeAxisBounds(xExtent, isAbsolute);
	const [minY, maxY] = computeAxisBounds(yExtent, isAbsolute);
	return [minX, minY, maxX, maxY];
}

function computeViewport(summary: SpatialSummary, isAbsolute: boolean): Viewport {
	const { fullyFinite, partialInfinity, hasFullyFinite, infinityEdges } = summary;

	// Choose extent: prefer fully-finite, fallback to partial-infinity
	const { x: xExtent, y: yExtent } = hasFullyFinite ? fullyFinite : partialInfinity;

	// Check if we have any finite data at all
	const hasAnyFiniteData = (isFinite(xExtent.min) && isFinite(xExtent.max)) ||
		(isFinite(yExtent.min) && isFinite(yExtent.max));

	// Special case: no finite data and all 4 infinity edges → minimal 1×1 grid
	const allEdgesInfinite = Object.values(infinityEdges).every(Boolean);
	if (!hasAnyFiniteData && allEdgesInfinite) {
		return { worldBounds: [0, 0, 0, 0], width: 1, height: 1, infinityEdges };
	}

	// Normal case: compute world bounds with finite data
	const worldBounds = computeViewportBounds(xExtent, yExtent, isAbsolute);
	const [minX, minY, maxX, maxY] = worldBounds;

	// Compute viewport dimensions: finite region + infinity edge cells
	const worldWidth = Math.max(0, maxX - minX + 1);
	const worldHeight = Math.max(0, maxY - minY + 1);
	const width = worldWidth + +infinityEdges.left + +infinityEdges.right;
	const height = worldHeight + +infinityEdges.top + +infinityEdges.bottom;

	return { worldBounds, width, height, infinityEdges };
}

function analyzeQueryResults<T>(
	query: () => IterableIterator<QueryResult<T>>,
	legend: Record<string, T | Record<string, unknown>>,
	isAbsolute: boolean,
	strict: boolean = false,
): readonly [fragments: Fragment[], viewport: Viewport] {
	// Build symbol lookup
	const symbolLookup = new Map(
		Object.entries(legend).map(([symbol, value]) => [serializeValue(value), symbol]),
	);

	// Single pass: query + validate + analyze
	const fragments: Fragment[] = [];
	const summary: SpatialSummary = {
		fullyFinite: { x: { min: Infinity, max: -Infinity }, y: { min: Infinity, max: -Infinity } },
		partialInfinity: { x: { min: Infinity, max: -Infinity }, y: { min: Infinity, max: -Infinity } },
		hasFullyFinite: false,
		infinityEdges: { left: false, top: false, right: false, bottom: false },
	};
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
		usedSymbols?.add(symbol);

		// Analyze extents and infinity edges
		const isFullyFinite = rect.every(isFinite);
		const target = isFullyFinite ? summary.fullyFinite : summary.partialInfinity;
		const [x1, y1, x2, y2] = rect;

		updateExtent(x1, target.x);
		updateExtent(x2, target.x);
		updateExtent(y1, target.y);
		updateExtent(y2, target.y);

		summary.hasFullyFinite ||= isFullyFinite;

		summary.infinityEdges.left ||= x1 === -Infinity;
		summary.infinityEdges.right ||= x2 === Infinity;
		summary.infinityEdges.top ||= y1 === -Infinity;
		summary.infinityEdges.bottom ||= y2 === Infinity;
	}

	// Special case: empty index → minimal 1×1 grid at origin
	if (!fragments.length) {
		return [fragments, {
			worldBounds: [0, 0, 0, 0],
			width: 1,
			height: 1,
			infinityEdges: { left: false, top: false, right: false, bottom: false },
		}] as const;
	}

	// Compute viewport from summary
	const viewport = computeViewport(summary, isAbsolute);

	validateStrictMode(legend, usedSymbols);
	return [fragments, viewport] as const;
}

//#endregion

//#region Pass 2: Build Grid

function worldToGrid(worldX: number, worldY: number, viewport: Viewport): [gridX: number, gridY: number] {
	const [minX, minY] = viewport.worldBounds;
	const { infinityEdges } = viewport;
	return [worldX - minX + +infinityEdges.left, worldY - minY + +infinityEdges.top];
}

function clip(coord: number, min: number, max: number): number {
	return Math.max(min, Math.min(coord, max));
}

function setCell(grid: SparseGrid, x: number, y: number, symbol: string): void {
	let row = grid.get(y);
	if (!row) grid.set(y, row = new Map());
	row.set(x, symbol);
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

	// Helper: Fill an infinity edge along one axis
	const fillEdge = (
		isInfinite: boolean,
		hasEdge: boolean,
		gridPos: number,
		rectMin: number,
		rectMax: number,
		worldMin: number,
		worldMax: number,
		worldOffset: number,
		isVertical: boolean,
	) => {
		if (!isInfinite || !hasEdge) return;
		const clippedMin = clip(rectMin, worldMin, worldMax);
		const clippedMax = clip(rectMax, worldMin, worldMax);
		for (let coord = clippedMin; coord <= clippedMax; coord++) {
			const gridCoord = coord - worldMin + worldOffset;
			if (isVertical) {
				setCell(grid, gridPos, gridCoord, symbol);
			} else {
				setCell(grid, gridCoord, gridPos, symbol);
			}
		}
	};

	// Vertical edges (left/right) - fixed X, varying Y
	fillEdge(x1 === -Infinity, infinityEdges.left, 0, y1, y2, minY, maxY, +infinityEdges.top, true);
	fillEdge(x2 === Infinity, infinityEdges.right, width - 1, y1, y2, minY, maxY, +infinityEdges.top, true);

	// Horizontal edges (top/bottom) - fixed Y, varying X
	fillEdge(y1 === -Infinity, infinityEdges.top, 0, x1, x2, minX, maxX, +infinityEdges.left, false);
	fillEdge(y2 === Infinity, infinityEdges.bottom, height - 1, x1, x2, minX, maxX, +infinityEdges.left, false);
}

function fillInfiniteCorners(
	grid: SparseGrid,
	rect: Rectangle,
	symbol: string,
	viewport: Viewport,
): void {
	const [x1, y1, x2, y2] = rect;
	const { infinityEdges: edges, width, height } = viewport;

	if (edges.left && edges.top && x1 === -Infinity && y1 === -Infinity) setCell(grid, 0, 0, symbol);
	if (edges.right && edges.top && x2 === Infinity && y1 === -Infinity) setCell(grid, width - 1, 0, symbol);
	if (edges.left && edges.bottom && x1 === -Infinity && y2 === Infinity) setCell(grid, 0, height - 1, symbol);
	if (edges.right && edges.bottom && x2 === Infinity && y2 === Infinity) setCell(grid, width - 1, height - 1, symbol);
}

//#endregion

//#region Pass 3: Format

function buildLabels(
	min: number,
	size: number,
	leadingInfinite: boolean,
	trailingInfinite: boolean,
	formatter: (index: number) => string,
): string[] {
	// Special case: totally infinite dimension (size=1, both edges)
	if (size === 1 && leadingInfinite && trailingInfinite) {
		return [INFINITY_SYMBOL];
	}

	const numFinite = size - +leadingInfinite - +trailingInfinite;
	return [
		...(leadingInfinite ? [INFINITY_SYMBOL] : []),
		...Array.from({ length: numFinite }, (_, i) => formatter(min + i)),
		...(trailingInfinite ? [INFINITY_SYMBOL] : []),
	];
}

function buildColumnLabels(viewport: Viewport): string[] {
	const { worldBounds: [minX], infinityEdges, width } = viewport;
	return buildLabels(minX, width, infinityEdges.left, infinityEdges.right, columnToLetter);
}

function buildRowLabels(viewport: Viewport): string[] {
	const [, minY] = viewport.worldBounds;
	const { infinityEdges, height } = viewport;
	return buildLabels(minY, height, infinityEdges.top, infinityEdges.bottom, String);
}

function formatToAscii(
	grid: SparseGrid,
	viewport: Viewport,
	legend: Record<string, unknown>,
	gridOnly: boolean = false,
	isAbsolute: boolean,
): string {
	const lines: string[] = [];
	const { width, height, infinityEdges, worldBounds } = viewport;
	const [minX, minY] = worldBounds;

	const columnLabels = buildColumnLabels(viewport);
	const rowLabels = buildRowLabels(viewport);
	const rowLabelWidth = rowLabels.length ? Math.max(...rowLabels.map((l) => l.length)) : 0;

	// Calculate where (0,0) cell is in grid coordinates (for absolute mode marker)
	const originGridX = isAbsolute ? -minX : -1; // -1 means not applicable
	const originGridY = isAbsolute ? -minY : -1;

	// Helper: prepend row label to content
	const withRowLabel = (content: string, label: string = ''): string => {
		const paddedLabel = label.padStart(rowLabelWidth, EMPTY_CELL);
		return `${paddedLabel}${COLUMN_SEPARATOR}${content}`;
	};

	// Helper: center text within cell width
	const centerInCell = (text: string): string => {
		const leftPad = Math.floor(CELL_WIDTH / 2) - Math.floor(text.length / 2);
		const rightPad = CELL_WIDTH - text.length - leftPad;
		return EMPTY_CELL.repeat(leftPad) + text + EMPTY_CELL.repeat(rightPad);
	};

	// Helper: render a row with label and cells
	const renderRow = (label: string, cells: string[], hideBorders = false): string => {
		const cellSep = hideBorders ? EMPTY_CELL : CELL_SEPARATOR;
		const leftSeparator = infinityEdges.left ? EMPTY_CELL : cellSep;
		const rightSeparator = infinityEdges.right ? '' : cellSep;
		return withRowLabel(`${leftSeparator}${cells.join(cellSep)}${rightSeparator}`, label);
	};

	// Column header - render with borders hidden for clean look
	lines.push(renderRow('', columnLabels.map(centerInCell), true));

	// Helper: Build a border line, optionally marking (0,0) cell with *
	const buildBorder = (forRow: number): string => {
		const content = Array.from({ length: width }, (_, x) => {
			const isAbsoluteOrigin = isAbsolute && forRow === originGridY && x === originGridX;
			const corner = isAbsoluteOrigin ? ABSOLUTE_ORIGIN_MARKER : BORDER_CHAR;
			return corner + BORDER_LINE;
		}).join('') + BORDER_CHAR;
		return withRowLabel(content);
	};

	// Helper: Build a line with + markers to cap vertical bars at infinity edges
	const buildCapLine = (): string => {
		const capPattern = BORDER_CHAR + EMPTY_CELL.repeat(CELL_WIDTH);
		return withRowLabel(capPattern.repeat(width) + BORDER_CHAR);
	};

	// Build top border once (reused for blank line length and/or first border)
	const topBorder = buildBorder(0);

	// Cap line for top infinity edge
	if (infinityEdges.top) {
		lines.push(buildCapLine());
	}

	// Data rows
	for (let y = 0; y < height; y++) {
		const isFirstRow = y === 0;
		const isLastRow = y === height - 1;
		const isTopInfinity = isFirstRow && infinityEdges.top;

		if (!isTopInfinity) lines.push(isFirstRow ? topBorder : buildBorder(y));

		const rowLabel = rowLabels[y];
		const row = grid.get(y);
		const cells = Array.from({ length: width }, (_, x) => centerInCell(row?.get(x) ?? EMPTY_CELL));

		lines.push(renderRow(rowLabel, cells));

		if (isLastRow && infinityEdges.bottom) {
			lines.push(buildCapLine());
		} else if (isLastRow) {
			lines.push(buildBorder(y + 1));
		}
	}

	// Footer (legend + infinity annotations) - skip if gridOnly
	if (!gridOnly) {
		// Legend
		lines.push('', ...formatLegend(legend));

		// Infinity annotation
		const edges = (['left', 'top', 'right', 'bottom'] as const).filter((e) => infinityEdges[e]);

		if (edges.length) {
			const edgeLabel = `${INFINITY_SYMBOL} edge${edges.length > 1 ? 's' : ''}`;
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
	return (Deno.env.get('COORDINATE_SYSTEM') as CoordinateSystem) ?? 'viewport';
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
	{ strict = false, coordinateSystem = getDefaultCoordinateSystem(), gridOnly = false }: RenderOptions = {},
): string {
	const isAbsolute = coordinateSystem === 'absolute';

	// Pass 1: Query + analyze (single query iteration)
	const [fragments, viewport] = analyzeQueryResults(query, legend, isAbsolute, strict);

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
	return formatToAscii(grid, viewport, legend, gridOnly, isAbsolute);
}

//#endregion
