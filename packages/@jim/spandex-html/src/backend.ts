/**
 * @module
 *
 * HTML table backend for spatial index rendering.
 *
 * Generates styled HTML tables with inline CSS for browser viewing, documentation,
 * and visual regression testing. All styles are self-contained requiring no external CSS.
 *
 * ## Infinite Edge Visualization
 *
 * Ranges extending to infinity are visualized using three complementary techniques:
 * - **Smart gradients**: Fade toward infinity using pattern-specific gradients
 *   - Single edge: Linear gradient
 *   - Corner (2 adjacent): Radial from opposite corner
 *   - Band (2 opposite): Linear from center
 *   - 3 edges: Radial from finite edge
 *   - All edges: Radial from center
 * - **Directional arrows**: Positioned indicators (⇡⇣⇠⇢) at cell edges
 * - **Infinity symbols**: ∞ in table headers with tooltips
 *
 * ## Design Principles
 *
 * - Self-evident visuals over explicit annotations
 * - Transparency gradients work on any background
 * - Consistent spacing and styling via STYLES constants
 * - Type-safe grid keys and edge detection
 */

import type { ExtentResult, QueryResult } from '@jim/spandex';
import type { LayoutContext, RenderBackend, RenderContext } from '@jim/spandex/render';
import type { HTMLLayoutParams, HTMLPartialParams, HTMLRenderParams } from './types.ts';

//#region Types and Constants

/**
 * Intermediate representation for layout composition.
 * Used to pass rendered fragments between layout stages.
 */
interface HTMLBackendIR {
	/** Rendered HTML string */
	html: string;
	/** Legend entries for deferred rendering in layouts */
	legend?: [string, { label: string; color: string; value: unknown }][];
}

/**
 * Cell data with infinite edge tracking.
 * Combines visual properties (label, color) with infinite edge flags.
 */
interface CellData {
	/** Display label (e.g., "R", "B", "1") */
	label: string;
	/** Background color (e.g., "#ff0000") */
	color: string;
	/** Whether this cell's top edge extends to infinity */
	infiniteTop: boolean;
	/** Whether this cell's bottom edge extends to infinity */
	infiniteBottom: boolean;
	/** Whether this cell's left edge extends to infinity */
	infiniteLeft: boolean;
	/** Whether this cell's right edge extends to infinity */
	infiniteRight: boolean;
}

/** CSS style constants for consistent visual appearance */
const STYLES = {
	border: {
		data: '1px solid light-dark(#000000, #ffffff)', // Adaptive (fully bounded/finite - black in light, white in dark)
		transparent: '1px dotted rgba(180, 180, 180, 0.1)', // Transparent dotted (empty cells or fully unbounded)
		semiInfinite: '1px dotted light-dark(rgba(0, 0, 0, 0.6), rgba(255, 255, 255, 0.6))', // Adaptive dotted (semi-infinite)
		header: 'none',
		none: 'none',
	},
	colors: {
		empty: 'light-dark(#d8dce0, #2a2a2a)', // Adaptive empty cell background
		headerText: 'light-dark(#999, #888)', // Adaptive header text
		arrowOverlay: 'light-dark(black, white)', // Adaptive directional arrows
		legendText: 'light-dark(#666, #999)', // Adaptive legend text
		transparent: 'transparent',
	},
	sizes: {
		headerFont: '10px',
		cellFont: '12px',
		infinityFont: '14px',
		arrowFont: '10px',
	},
	spacing: {
		headerPadding: '4px',
		tableMargin: '10px',
		messageMargin: '0 10px 10px 10px',
		messagePadding: '20px',
	},
	gradient: {
		centerSolid: '25%', // For all-edges infinite
		threeSideSolid: '30%', // For 3-edge infinite
		bandCenter: '50%', // For opposite-edge infinite
		cornerSolid: '50%', // For corner infinite
		singleEdgeStart: '60%', // For single-edge infinite
	},
} as const;

//#endregion Types and Constants

//#region Utility Functions

/**
 * Escape HTML special characters for safe rendering.
 * Prevents XSS attacks by converting special chars to HTML entities.
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/** Convert column number to spreadsheet letter (0→A, 25→Z, 26→AA, negatives get '-' prefix) */
function columnToLetter(col: number): string {
	if (col < 0) return '-' + columnToLetter(-col - 1);
	if (col < 26) return String.fromCharCode(65 + col);
	return columnToLetter(Math.floor(col / 26) - 1) + columnToLetter(col % 26);
}

/** Format row number for display (negatives stay negative, non-negatives use 1-based indexing) */
function formatRowNumber(row: number): string {
	return String(row < 0 ? row : row + 1);
}

/**
 * Serialize value to consistent string for legend lookup.
 * Handles primitives directly, falls back to JSON for objects.
 */
function serializeValue<T>(value: T): string {
	if (value === null) return 'null';
	if (value === undefined) return 'undefined';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return JSON.stringify(value);
}

/**
 * Calculate contrasting text color for readability.
 * Uses ITU-R BT.601 luminance formula.
 *
 * @param bgColor - Hex color ("#ff0000" or "#f00")
 * @returns "#000" (light bg) or "#fff" (dark bg)
 */
function getContrastColor(bgColor: string): '#000' | '#fff' {
	const hex = bgColor.replace('#', '');
	const is3Char = hex.length === 3;

	// Parse RGB (support 3-char and 6-char hex)
	const r = parseInt(is3Char ? hex[0]! + hex[0]! : hex.slice(0, 2), 16);
	const g = parseInt(is3Char ? hex[1]! + hex[1]! : hex.slice(2, 4), 16);
	const b = parseInt(is3Char ? hex[2]! + hex[2]! : hex.slice(4, 6), 16);

	// ITU-R BT.601 perceived brightness
	const luminance = r * 0.299 + g * 0.587 + b * 0.114;
	return luminance > 128 ? '#000' : '#fff';
}

//#endregion Utility Functions

//#region Grid Building

/** Legend entry: visual properties for a value (omits value for internal use) */
interface LegendEntry {
	label: string;
	color: string;
}

/** Grid coordinate key: "x,y" format (e.g., "0,0", "5,-3") */
type GridKey = string;

/**
 * Build grid from fragments with infinite edge tracking.
 * Maps (x,y) → CellData with visual properties and infinite edge flags.
 */
function buildGrid<T>(
	fragments: Iterable<QueryResult<T>>,
	extent: ExtentResult,
	legend: Record<string, { label: string; color: string; value: T }>,
	usedLegendKeys?: Set<string> | null,
): Map<GridKey, CellData> {
	// Pre-compute legend lookup by serialized value
	const legendMap = new Map<string, LegendEntry>(
		Object.values(legend).map(({ label, color, value }) => [
			serializeValue(value),
			{ label, color },
		]),
	);

	const [minX, minY, maxX, maxY] = extent.mbr;
	const grid = new Map<GridKey, CellData>();

	for (const [bounds, value] of fragments) {
		const [x1, y1, x2, y2] = bounds;
		if (x2 < minX || x1 > maxX || y2 < minY || y1 > maxY) continue;

		const serializedValue = serializeValue(value);
		const entry = legendMap.get(serializedValue);
		if (!entry) {
			const available = [...legendMap.keys()].join(', ');
			throw new Error(
				`Missing legend entry for value "${serializedValue}". Available keys: ${available}`,
			);
		}

		// Track usage for strict mode validation
		usedLegendKeys?.add(serializedValue);

		// Track infinite edges
		const fragmentInfiniteTop = y1 === -Infinity;
		const fragmentInfiniteBottom = y2 === Infinity;
		const fragmentInfiniteLeft = x1 === -Infinity;
		const fragmentInfiniteRight = x2 === Infinity;

		// Clamp to viewport
		const clampedX1 = Math.max(minX, x1);
		const clampedX2 = Math.min(maxX, x2);
		const clampedY1 = Math.max(minY, y1);
		const clampedY2 = Math.min(maxY, y2);

		// Fill cells, mark infinite edges at viewport boundary
		for (let y = clampedY1; y <= clampedY2; y++) {
			for (let x = clampedX1; x <= clampedX2; x++) {
				const key: GridKey = `${x},${y}`;
				const existing = grid.get(key);

				const cellInfiniteTop = y === minY && fragmentInfiniteTop;
				const cellInfiniteBottom = y === maxY && fragmentInfiniteBottom;
				const cellInfiniteLeft = x === minX && fragmentInfiniteLeft;
				const cellInfiniteRight = x === maxX && fragmentInfiniteRight;

				grid.set(key, {
					...entry,
					infiniteTop: existing?.infiniteTop || cellInfiniteTop,
					infiniteBottom: existing?.infiniteBottom || cellInfiniteBottom,
					infiniteLeft: existing?.infiniteLeft || cellInfiniteLeft,
					infiniteRight: existing?.infiniteRight || cellInfiniteRight,
				});
			}
		}
	}

	return grid;
}

//#endregion Grid Building

//#region Infinite Edge Visualization

/** Format coordinate with ∞ symbol if infinite */
function formatCoordinateLabel(coord: number, isInfinite: boolean, isColumn: boolean): string {
	if (!isInfinite) return isColumn ? columnToLetter(coord) : formatRowNumber(coord);
	return `<span style="font-size: ${STYLES.sizes.infinityFont}; line-height: 1;">∞</span>`;
}

/** Infinite edge pattern: tracks which edges extend to infinity */
interface InfiniteEdges {
	top: boolean;
	bottom: boolean;
	left: boolean;
	right: boolean;
	count: number; // 0-4
}

/** Detect infinite edges for a cell */
function detectInfiniteEdges(
	cell: CellData | undefined,
	isTopRow: boolean,
	isBottomRow: boolean,
	isLeftCol: boolean,
	isRightCol: boolean,
): InfiniteEdges {
	if (!cell) {
		return { top: false, bottom: false, left: false, right: false, count: 0 };
	}

	const top = isTopRow && cell.infiniteTop;
	const bottom = isBottomRow && cell.infiniteBottom;
	const left = isLeftCol && cell.infiniteLeft;
	const right = isRightCol && cell.infiniteRight;
	const count = [top, bottom, left, right].filter(Boolean).length;

	return { top, bottom, left, right, count };
}

/** Check if adjacent cell is unbounded (has any infinite edge) */
function isAdjacentUnbounded(adjacentCell: CellData | undefined): boolean {
	if (!adjacentCell) return false;
	return adjacentCell.infiniteTop || adjacentCell.infiniteBottom ||
		adjacentCell.infiniteLeft || adjacentCell.infiniteRight;
}

/**
 * Determine border style based on edge relationships.
 * - Bounded edge: solid (fully bounded) or dotted (mixed edges)
 * - Infinite at viewport: transparent (extends to ∞)
 * - Infinite with unbounded neighbor: transparent
 * - Infinite with bounded neighbor: dotted (transition)
 */
function getBorderStyle(
	thisEdgeInfinite: boolean,
	isAtViewportBoundary: boolean,
	thisCellUnbounded: boolean,
	adjacentCell: CellData | undefined,
): string {
	if (!thisEdgeInfinite) {
		return thisCellUnbounded ? STYLES.border.semiInfinite : STYLES.border.data;
	}
	if (isAtViewportBoundary) return STYLES.border.transparent;
	return isAdjacentUnbounded(adjacentCell) ? STYLES.border.transparent : STYLES.border.semiInfinite;
}

/** Build gradient CSS for infinite edges based on pattern */
function buildInfiniteGradient(edges: InfiniteEdges, bgColor: string): string {
	const { top, bottom, left, right, count } = edges;
	const fade = STYLES.colors.transparent;

	if (count === 0) return bgColor;

	if (count === 4) {
		return `radial-gradient(circle at center, ${bgColor} ${STYLES.gradient.centerSolid}, ${fade} 100%)`;
	}

	if (count === 3) {
		const centerX = !left ? '0%' : !right ? '100%' : '50%';
		const centerY = !top ? '0%' : !bottom ? '100%' : '50%';
		return `radial-gradient(ellipse at ${centerX} ${centerY}, ${bgColor} ${STYLES.gradient.threeSideSolid}, ${fade} 100%)`;
	}

	if (count === 2) {
		if ((top && bottom) || (left && right)) {
			const direction = top && bottom ? 'to bottom' : 'to right';
			return `linear-gradient(${direction}, ${fade} 0%, ${bgColor} ${STYLES.gradient.bandCenter}, ${fade} 100%)`;
		}
		const cornerX = left ? '100%' : '0%';
		const cornerY = top ? '100%' : '0%';
		return `radial-gradient(ellipse at ${cornerX} ${cornerY}, ${bgColor} ${STYLES.gradient.cornerSolid}, ${fade} 100%)`;
	}

	const direction = top ? 'to top' : bottom ? 'to bottom' : left ? 'to left' : 'to right';
	return `linear-gradient(${direction}, ${bgColor} ${STYLES.gradient.singleEdgeStart}, ${fade} 100%)`;
}

/** Build cell styling with infinite edge gradients and adaptive borders */
function buildCellInfiniteStyle(
	cell: CellData | undefined,
	bgColor: string,
	showGrid: boolean,
	grid: Map<GridKey, CellData>,
	x: number,
	y: number,
	isTopRow: boolean,
	isBottomRow: boolean,
	isLeftCol: boolean,
	isRightCol: boolean,
): { border: string; background: string; edges: InfiniteEdges } {
	const edges = detectInfiniteEdges(cell, isTopRow, isBottomRow, isLeftCol, isRightCol);
	const background = buildInfiniteGradient(edges, bgColor);

	const border = !showGrid ? `border: ${STYLES.border.none}` : !cell ? `border: ${STYLES.border.transparent}` : [
		`border-top: ${getBorderStyle(edges.top, isTopRow, edges.count > 0, grid.get(`${x},${y - 1}`))}`,
		`border-bottom: ${getBorderStyle(edges.bottom, isBottomRow, edges.count > 0, grid.get(`${x},${y + 1}`))}`,
		`border-left: ${getBorderStyle(edges.left, isLeftCol, edges.count > 0, grid.get(`${x - 1},${y}`))}`,
		`border-right: ${getBorderStyle(edges.right, isRightCol, edges.count > 0, grid.get(`${x + 1},${y}`))}`,
	].join('; ');

	return { border, background, edges };
}

/** Build directional arrows (⇡⇣⇠⇢) positioned at cell edges */
function buildInfiniteIndicator(edges: InfiniteEdges): string {
	if (edges.count === 0) return '';
	const arrow = (symbol: string, position: string) =>
		`<span style="position: absolute; color: ${STYLES.colors.arrowOverlay}; font-size: ${STYLES.sizes.arrowFont}; font-weight: bold; ${position}">${symbol}</span>`;
	return [
		edges.top && arrow('⇡', `top: 0; left: 50%; transform: translate(-50%, -50%);`),
		edges.bottom && arrow('⇣', `bottom: 0; left: 50%; transform: translate(-50%, 50%);`),
		edges.left && arrow('⇠', `left: 0; top: 50%; transform: translate(-50%, -50%);`),
		edges.right && arrow('⇢', `right: 0; top: 50%; transform: translate(50%, -50%);`),
	].filter(Boolean).join('');
}

//#endregion Infinite Edge Visualization

//#region Table Rendering

/** Build header (th) with optional ∞ indicator */
function buildHeader(
	coord: number,
	isStartEdge: boolean,
	isEndEdge: boolean,
	startLabel: string,
	endLabel: string,
	isColumn: boolean,
	extraStyles: string,
	extentSize: number,
): string {
	// Show ∞ if:
	// 1. Both edges infinite at origin (special case)
	// 2. Extent has multiple coordinates (general case)
	const isBothEdgesAtOrigin = isStartEdge && isEndEdge && coord === 0;
	const isInfinite = isBothEdgesAtOrigin || ((isStartEdge || isEndEdge) && extentSize > 1);
	const label = formatCoordinateLabel(coord, isInfinite, isColumn);

	const titleAttr = isInfinite
		? ` title="Extends to ${
			[isStartEdge && startLabel, isEndEdge && endLabel].filter(Boolean).join(' and ')
		} infinity"`
		: '';

	const style = [
		`border: ${STYLES.border.header}`,
		`padding: ${STYLES.spacing.headerPadding}`,
		'text-align: center',
		`font-size: ${STYLES.sizes.headerFont}`,
		`color: ${STYLES.colors.headerText}`,
		'font-weight: 300',
		extraStyles,
	].join('; ');

	return `<th style="${style}"${titleAttr}>${label}</th>`;
}

function buildColumnHeader(
	x: number,
	leftInf: boolean,
	rightInf: boolean,
	minX: number,
	maxX: number,
	cellWidth: number,
): string {
	const extentSize = maxX - minX + 1;
	return buildHeader(
		x,
		x === minX && leftInf,
		x === maxX && rightInf,
		'left',
		'right',
		true, // isColumn
		`min-width: ${cellWidth}px`,
		extentSize,
	);
}

function buildRowHeader(
	y: number,
	topInf: boolean,
	bottomInf: boolean,
	minY: number,
	maxY: number,
	cellHeight: number,
): string {
	const extentSize = maxY - minY + 1;
	return buildHeader(
		y,
		y === minY && topInf,
		y === maxY && bottomInf,
		'top',
		'bottom',
		false, // isColumn
		`min-height: ${cellHeight}px`,
		extentSize,
	);
}

/** Build empty set header (∅) for empty index */
function buildEmptySetHeader(dimension: 'width' | 'height', size: number): string {
	const style = [
		`border: ${STYLES.border.header}`,
		`padding: ${STYLES.spacing.headerPadding}`,
		'text-align: center',
		`font-size: ${STYLES.sizes.headerFont}`,
		`color: ${STYLES.colors.headerText}`,
		'font-weight: 300',
		`min-${dimension}: ${size}px`,
	].join('; ');
	return `<th style="${style}">∅</th>`;
}

/** Build fixed-size dimension styles for data cells */
function buildCellDimensions(width: number, height: number): string {
	return [
		`width: ${width}px`,
		`height: ${height}px`,
		`min-width: ${width}px`,
		`min-height: ${height}px`,
		`max-width: ${width}px`,
		`max-height: ${height}px`,
	].join('; ');
}

/** Build table cell (td) with infinite edge indicators */
function buildCell(
	x: number,
	y: number,
	grid: Map<GridKey, CellData>,
	minX: number,
	maxX: number,
	minY: number,
	maxY: number,
	cellWidth: number,
	cellHeight: number,
	showGrid: boolean,
	includeOrigin: boolean,
): string {
	const cell = grid.get(`${x},${y}`);
	const bgColor = cell?.color ?? STYLES.colors.transparent;
	const label = cell?.label ?? '';
	const textColor = cell ? getContrastColor(bgColor) : '#000';
	const isOrigin = includeOrigin && x === 0 && y === 0;

	const isTopRow = y === minY;
	const isBottomRow = y === maxY;
	const isLeftCol = x === minX;
	const isRightCol = x === maxX;

	const { border, background, edges } = buildCellInfiniteStyle(
		cell,
		bgColor,
		showGrid,
		grid,
		x,
		y,
		isTopRow,
		isBottomRow,
		isLeftCol,
		isRightCol,
	);

	const originMarker = isOrigin
		? `<span style="position: absolute; top: -1px; left: -1px; transform: translate(-50%, -50%); color: ${STYLES.colors.arrowOverlay}; font-size: ${STYLES.sizes.arrowFont}; font-weight: bold; z-index: 10; line-height: 1;" title="Absolute origin (0,0)">*</span>`
		: '';

	const style = [
		'position: relative',
		border,
		`background: ${background}`,
		`color: ${textColor}`,
		'text-align: center',
		'vertical-align: middle',
		buildCellDimensions(cellWidth, cellHeight),
		`font-size: ${STYLES.sizes.cellFont}`,
	].join('; ');

	return `<td style="${style}">${originMarker}${
		buildInfiniteIndicator(edges)
	}<span style="position: relative; z-index: 1;">${escapeHtml(label)}</span></td>`;
}

/** Render legend with color swatches */
function renderLegend(entries: [string, { label: string; color: string; value: unknown }][]): string {
	const items = entries.map(([_key, { label, color, value }]) => {
		const valueStr = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
		const swatch = `<span style="display: inline-block; width: 12px; height: 12px; background: ${
			escapeHtml(color)
		}; border: 1px solid rgba(0,0,0,0.2); margin-right: 6px; vertical-align: middle;"></span>`;
		return `${swatch}<code style="background: none; padding: 0; color: inherit;">${
			escapeHtml(label)
		}</code> = <code style="background: none; padding: 0; color: inherit;">${escapeHtml(valueStr)}</code>`;
	}).join('<br>');

	return `<div style="margin: ${STYLES.spacing.messageMargin}; font-size: ${STYLES.sizes.headerFont}; color: ${STYLES.colors.legendText}; font-family: monospace; line-height: 1.8; color-scheme: light dark;">${items}</div>`;
}

/** Validate strict mode: throw if legend has unused keys */
function validateStrictMode(legend: Record<string, unknown>, usedLegendKeys: Set<string>): void {
	const unused = Object.keys(legend).filter((k) => !usedLegendKeys.has(k));
	if (unused.length) {
		throw new Error(`Strict mode enabled: ${unused.length} unused legend key(s): ${unused.join(', ')}`);
	}
}

/** Render HTML table from fragments */
function renderHTMLTable<T>(
	fragments: Iterable<QueryResult<T>>,
	extent: ExtentResult,
	params: Partial<HTMLRenderParams<T>> = {},
	gridOnly = false,
): string {
	const {
		className = 'spatial-index-grid',
		legend = {},
		showCoordinates = true,
		cellWidth = 40,
		cellHeight = 40,
		showGrid = true,
		gridOnly: gridOnlyParam = false,
		strict = false,
		usedLegendKeys = strict ? new Set<string>() : null,
		includeOrigin = false,
	} = params;

	const omitLegend = gridOnly || gridOnlyParam;
	const fragmentsArray = Array.from(fragments);
	const isEmpty = fragmentsArray.length === 0 && extent.empty;

	const grid = buildGrid(fragmentsArray, extent, legend, usedLegendKeys);

	// Validate strict mode after building grid
	if (strict && usedLegendKeys) {
		validateStrictMode(legend, usedLegendKeys);
	}

	const [minX, minY, maxX, maxY] = extent.mbr;
	const [leftInf, topInf, rightInf, bottomInf] = extent.edges;

	const parts: string[] = [];
	const { tableMargin } = STYLES.spacing;

	parts.push(
		`<table class="${
			escapeHtml(className)
		}" style="border-collapse: collapse; border-spacing: 0; font-family: monospace; margin: ${tableMargin}; width: auto; table-layout: fixed; color-scheme: light dark;">`,
	);

	if (showCoordinates) {
		const cornerWidth = cellWidth / 2;
		const cornerHeight = cellHeight / 2;
		const cornerStyle = `border: none; min-width: ${cornerWidth}px; min-height: ${cornerHeight}px;`;
		parts.push(`<thead><tr><th style="${cornerStyle}"></th>`);
		if (isEmpty) {
			parts.push(buildEmptySetHeader('width', cellWidth));
		} else {
			for (let x = minX; x <= maxX; x++) {
				parts.push(buildColumnHeader(x, leftInf, rightInf, minX, maxX, cellWidth));
			}
		}
		parts.push('</tr></thead>');
	}

	parts.push('<tbody>');
	if (isEmpty) {
		// Empty index: single row with empty set symbol and empty cell
		parts.push('<tr>');
		if (showCoordinates) {
			parts.push(buildEmptySetHeader('height', cellHeight));
		}
		// Empty cell
		const cellStyle = [
			'position: relative',
			`border: ${showGrid ? STYLES.border.transparent : STYLES.border.none}`,
			`background: ${STYLES.colors.transparent}`,
			'text-align: center',
			'vertical-align: middle',
			buildCellDimensions(cellWidth, cellHeight),
			`font-size: ${STYLES.sizes.cellFont}`,
		].join('; ');
		parts.push(`<td style="${cellStyle}"></td>`);
		parts.push('</tr>');
	} else {
		for (let y = minY; y <= maxY; y++) {
			parts.push('<tr>');

			if (showCoordinates) {
				parts.push(buildRowHeader(y, topInf, bottomInf, minY, maxY, cellHeight));
			}

			for (let x = minX; x <= maxX; x++) {
				parts.push(
					buildCell(x, y, grid, minX, maxX, minY, maxY, cellWidth, cellHeight, showGrid, includeOrigin),
				);
			}

			parts.push('</tr>');
		}
	}
	parts.push('</tbody></table>');

	const legendEntries = Object.entries(legend);
	if (!omitLegend && legendEntries.length > 0) {
		parts.push(renderLegend(legendEntries));
	}

	return parts.join('');
}

//#endregion Table Rendering

//#region Parameter Defaults

/** Render parameter defaults */
const RENDER_DEFAULTS = {
	className: 'spatial-index-grid',
	legend: {},
	showCoordinates: true,
	cellWidth: 40,
	cellHeight: 40,
	showGrid: true,
	gridOnly: false,
	includeOrigin: false,
	strict: false,
	usedLegendKeys: null,
} as const;

function withRenderDefaults<T>(
	params: HTMLRenderParams<T>,
): Required<HTMLRenderParams<T>> {
	const strict = params.strict ?? RENDER_DEFAULTS.strict;
	const usedLegendKeys = params.usedLegendKeys ?? (strict ? new Set<string>() : null);
	return {
		...RENDER_DEFAULTS,
		...params,
		legend: params.legend ?? RENDER_DEFAULTS.legend,
		strict,
		usedLegendKeys,
	};
}

function withLayoutDefaults<T>(
	params: HTMLLayoutParams<T>,
): Required<HTMLLayoutParams<T>> {
	const {
		direction = 'horizontal',
		spacing = 20,
		title,
	} = params;
	return {
		...RENDER_DEFAULTS,
		...params,
		legend: params.legend ?? RENDER_DEFAULTS.legend,
		direction,
		spacing,
		title,
	};
}

//#endregion Parameter Defaults

//#region Backend Implementation

class HTMLRenderContext<T> implements RenderContext<T, string, HTMLRenderParams<T>> {
	readonly params: Required<HTMLRenderParams<T>>;
	constructor(params: HTMLRenderParams<T>) {
		this.params = withRenderDefaults(params);
	}
	render(
		fragments: Iterable<QueryResult<T>>,
		extent: ExtentResult,
		params?: Partial<HTMLRenderParams<T>>,
	): string {
		return renderHTMLTable(fragments, extent, {
			...this.params,
			...params,
		});
	}
}

class HTMLLayoutContext<T> implements
	LayoutContext<
		T,
		string,
		HTMLLayoutParams<T>,
		HTMLPartialParams<T>,
		HTMLBackendIR
	> {
	readonly params: Required<HTMLLayoutParams<T>>;
	constructor(params: HTMLLayoutParams<T>) {
		this.params = withLayoutDefaults(params);
	}
	renderPartial(
		fragments: Iterable<QueryResult<T>>,
		extent: ExtentResult,
		params: HTMLPartialParams<T>,
	): HTMLBackendIR {
		// Merge layout-level legend with partial params (partial overrides layout)
		const mergedParams = {
			...this.params,
			...params,
			legend: params.legend ?? this.params.legend,
		};

		let html = renderHTMLTable(fragments, extent, mergedParams, true);

		// Wrap table + name in a container so name appears above table in layouts
		if (params.name) {
			const nameHeader =
				`<div style="text-align: center; font-family: monospace; font-size: 11px; color: ${STYLES.colors.legendText}; margin: 0 0 5px 0;">${
					escapeHtml(params.name)
				}</div>`;
			html = `<div style="display: inline-block;">${nameHeader}${html}</div>`;
		}

		const legendEntries = Object.entries(mergedParams.legend);
		const result: HTMLBackendIR = { html };
		if (legendEntries.length > 0) {
			result.legend = legendEntries;
		}
		return result;
	}
	layout(
		irs: Iterable<HTMLBackendIR>,
		params?: Partial<HTMLLayoutParams<T>>,
	): string {
		const mergedParams = { ...this.params, ...params };
		const { direction, spacing, title, strict, usedLegendKeys } = mergedParams;

		const parts: string[] = [];

		if (title) {
			const { tableMargin } = STYLES.spacing;
			parts.push(
				`<h3 style="font-family: sans-serif; margin: ${tableMargin} 0;">${escapeHtml(title)}</h3>`,
			);
		}

		const wrapperStyle = direction === 'horizontal'
			? `display: flex; gap: ${spacing}px; align-items: flex-start;`
			: `display: flex; flex-direction: column; gap: ${spacing}px;`;

		parts.push(`<div style="${wrapperStyle}">`);

		let legendEntries: [string, { label: string; color: string; value: unknown }][] | undefined;
		for (const ir of irs) {
			parts.push(ir.html);
			if (!legendEntries && ir.legend) {
				legendEntries = ir.legend;
			}
		}

		parts.push('</div>');

		if (legendEntries && legendEntries.length > 0) {
			parts.push(renderLegend(legendEntries));
		}

		// Validate strict mode after layout
		if (strict && usedLegendKeys) {
			validateStrictMode(mergedParams.legend, usedLegendKeys);
		}

		return parts.join('');
	}
}

/**
 * HTML rendering backend for spatial indexes.
 *
 * Generates styled HTML tables with inline CSS for visualization in browsers,
 * documentation, and testing. Supports sophisticated infinite edge visualization
 * using gradients, directional arrows, and infinity symbols.
 *
 * Features:
 * - Smart gradient combinations based on infinite edge patterns
 * - Automatic text color contrast for readability
 * - HTML escaping for security
 * - Customizable cell sizes, colors, and layout
 * - Composable multi-grid layouts
 *
 * @example
 * ```typescript
 * import { createRenderer } from '@jim/spandex-html';
 *
 * const { render } = createRenderer<string>();
 * const html = render(index, {
 *   legend: {
 *     red: { label: 'R', color: '#ff0000', value: 'red' }
 *   },
 *   cellWidth: 50,
 *   cellHeight: 50
 * });
 * ```
 */
export class HTMLBackend implements
	RenderBackend<
		string,
		HTMLRenderParams<unknown>,
		HTMLLayoutParams<unknown>,
		HTMLPartialParams<unknown>,
		HTMLBackendIR
	> {
	context<T>(
		params: HTMLRenderParams<T>,
	): RenderContext<T, string, HTMLRenderParams<T>> {
		return new HTMLRenderContext(params);
	}

	layoutContext<T>(
		params: HTMLLayoutParams<T>,
	): LayoutContext<
		T,
		string,
		HTMLLayoutParams<T>,
		HTMLPartialParams<T>,
		HTMLBackendIR
	> {
		return new HTMLLayoutContext(params);
	}
}

//#endregion Backend Implementation
