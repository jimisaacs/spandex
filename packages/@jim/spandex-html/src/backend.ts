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

// ============================================================================
// Types and Constants
// ============================================================================

/**
 * Intermediate representation for layout composition.
 * Used to pass rendered fragments between layout stages.
 */
interface HTMLBackendIR {
	/** Rendered HTML string */
	html: string;
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
		data: '1px solid #ffffff', // Pure white (fully bounded/finite)
		transparent: '1px dotted rgba(180, 180, 180, 0.1)', // Transparent dotted (empty cells or fully unbounded)
		semiInfinite: '1px dotted rgba(255, 255, 255, 0.6)', // Gray dotted (semi-infinite - some edges infinite)
		header: 'none',
		none: 'none',
	},
	colors: {
		empty: '#d8dce0',
		headerText: '#999',
		arrowOverlay: 'black',
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
		arrowOffset: '2px',
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

// ============================================================================
// Utility Functions
// ============================================================================

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

/**
 * Serialize value to consistent string key for legend lookup.
 * Handles all JavaScript primitives and falls back to JSON for objects.
 */
function serializeValue<T>(value: T): string {
	if (value === null) return 'null';
	if (value === undefined) return 'undefined';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return JSON.stringify(value);
}

/**
 * Calculate contrasting text color (black or white) for readability.
 * Uses ITU-R BT.601 relative luminance formula to determine optimal contrast.
 *
 * @param bgColor - Hex color string (e.g., "#ff0000" or "#f00")
 * @returns "#000" for light backgrounds, "#fff" for dark backgrounds
 */
function getContrastColor(bgColor: string): '#000' | '#fff' {
	const hex = bgColor.replace('#', '');

	// Parse RGB: support both 3-char (#RGB) and 6-char (#RRGGBB) formats
	// Normalize 3-char to 6-char by doubling each digit
	const is3Char = hex.length === 3;
	const r = parseInt(is3Char ? hex[0]! + hex[0]! : hex.slice(0, 2), 16);
	const g = parseInt(is3Char ? hex[1]! + hex[1]! : hex.slice(2, 4), 16);
	const b = parseInt(is3Char ? hex[2]! + hex[2]! : hex.slice(4, 6), 16);

	// ITU-R BT.601 coefficients for perceived brightness
	const luminance = r * 0.299 + g * 0.587 + b * 0.114;

	// Threshold at middle of 0-255 range
	return luminance > 128 ? '#000' : '#fff';
}

// ============================================================================
// Grid Building
// ============================================================================

/**
 * Legend entry containing visual properties for a value.
 * Simplified from full legend entry (omits value for internal use).
 */
interface LegendEntry {
	/** Display label shown in cell */
	label: string;
	/** Background color as hex string */
	color: string;
}

/**
 * Grid coordinate key for cell lookup.
 * Format: "x,y" where x and y are coordinates (e.g., "0,0", "5,-3").
 */
type GridKey = string;

/**
 * Build grid of cells from spatial fragments with infinite edge tracking.
 *
 * Maps each (x,y) coordinate to its visual representation (label + color) plus
 * which edges extend to infinity.
 */
function buildGrid<T>(
	fragments: Iterable<QueryResult<T>>,
	extent: ExtentResult,
	legend: Record<string, { label: string; color: string; value: T }>,
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

		// Track if this fragment has infinite edges
		const fragmentInfiniteTop = y1 === -Infinity;
		const fragmentInfiniteBottom = y2 === Infinity;
		const fragmentInfiniteLeft = x1 === -Infinity;
		const fragmentInfiniteRight = x2 === Infinity;

		// Clamp fragment to viewport bounds
		const clampedX1 = Math.max(minX, x1);
		const clampedX2 = Math.min(maxX, x2);
		const clampedY1 = Math.max(minY, y1);
		const clampedY2 = Math.min(maxY, y2);

		// Fill grid cells, marking infinite edges at viewport boundaries
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

// ============================================================================
// Infinite Edge Visualization
// ============================================================================

/**
 * Format coordinate label with infinity symbol if at infinite edge.
 */
function formatCoordinateLabel(coord: number, isInfinite: boolean): string {
	if (!isInfinite) return String(coord);

	const { infinityFont } = STYLES.sizes;
	return `<span style="font-size: ${infinityFont};">∞</span>`;
}

/**
 * Edge pattern for infinite edge detection.
 * Tracks which edges of a cell extend to infinity.
 */
interface InfiniteEdges {
	/** Top edge is infinite */
	top: boolean;
	/** Bottom edge is infinite */
	bottom: boolean;
	/** Left edge is infinite */
	left: boolean;
	/** Right edge is infinite */
	right: boolean;
	/** Total number of infinite edges (0-4) */
	count: number;
}

/**
 * Detect which edges are infinite for a given cell.
 */
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

/**
 * Check if a cell extends to infinity in any direction.
 * Used for border style determination.
 */
function isUnboundedCell(cell: CellData | undefined): boolean {
	if (!cell) return false;
	return cell.infiniteTop || cell.infiniteBottom || cell.infiniteLeft || cell.infiniteRight;
}

/**
 * Determine border style based on edge relationships between cells.
 *
 * Border logic:
 * - Bounded edge + bounded adjacent → solid white (finite container)
 * - Bounded edge + unbounded adjacent → dotted gray (semi border - transition zone)
 * - Infinite edge at viewport boundary → transparent (extends to infinity)
 * - Infinite edge + unbounded adjacent → transparent (both infinite)
 * - Infinite edge + bounded adjacent → dotted gray (semi border - transition zone)
 *
 * @param thisEdgeInfinite - Whether the current cell's edge is infinite
 * @param isAtViewportBoundary - Whether this edge is at the viewport boundary
 * @param adjacentCell - The adjacent cell (if any)
 * @returns CSS border style string
 */
function getBorderStyle(
	thisEdgeInfinite: boolean,
	isAtViewportBoundary: boolean,
	adjacentCell: CellData | undefined,
): string {
	const adjacentCellUnbounded = isUnboundedCell(adjacentCell);

	if (!thisEdgeInfinite) {
		// Bounded edge: use semi border if adjacent cell is unbounded
		return adjacentCellUnbounded ? STYLES.border.semiInfinite : STYLES.border.data;
	}

	// Infinite edge at viewport boundary: transparent (extends to infinity)
	if (isAtViewportBoundary) return STYLES.border.transparent;

	// Inner infinite edge: transparent if adjacent is unbounded, dotted if bounded
	return adjacentCellUnbounded ? STYLES.border.transparent : STYLES.border.semiInfinite;
}

/**
 * Build gradient CSS for infinite edges based on edge pattern.
 * Returns appropriate gradient for the given edge combination.
 */
function buildInfiniteGradient(edges: InfiniteEdges, bgColor: string): string {
	const { top, bottom, left, right, count } = edges;
	const fade = STYLES.colors.transparent;

	if (count === 0) {
		return bgColor; // No gradient needed
	}

	if (count === 4) {
		// All edges: radial from center
		return `radial-gradient(circle at center, ${bgColor} ${STYLES.gradient.centerSolid}, ${fade} 100%)`;
	}

	if (count === 3) {
		// Three edges: radial from finite edge (the one that's NOT infinite)
		// Position gradient center at the finite edge
		const centerX = !left ? '0%' : !right ? '100%' : '50%';
		const centerY = !top ? '0%' : !bottom ? '100%' : '50%';
		return `radial-gradient(ellipse at ${centerX} ${centerY}, ${bgColor} ${STYLES.gradient.threeSideSolid}, ${fade} 100%)`;
	}

	if (count === 2) {
		// Two edges: opposite (band) or adjacent (corner)
		if ((top && bottom) || (left && right)) {
			// Opposite edges: band gradient from center
			const direction = top && bottom ? 'to bottom' : 'to right';
			return `linear-gradient(${direction}, ${fade} 0%, ${bgColor} ${STYLES.gradient.bandCenter}, ${fade} 100%)`;
		} else {
			// Adjacent edges (corner): gradient from opposite corner
			// If left edge is infinite, gradient starts from right (100%)
			const cornerX = left ? '100%' : '0%'; // left→right, right→left
			const cornerY = top ? '100%' : '0%'; // top→bottom, bottom→top
			return `radial-gradient(ellipse at ${cornerX} ${cornerY}, ${bgColor} ${STYLES.gradient.cornerSolid}, ${fade} 100%)`;
		}
	}

	// Single edge: linear gradient
	const direction = top ? 'to top' : bottom ? 'to bottom' : left ? 'to left' : 'to right';
	return `linear-gradient(${direction}, ${bgColor} ${STYLES.gradient.singleEdgeStart}, ${fade} 100%)`;
}

/**
 * Build cell styling for infinite edges using smart gradient combinations.
 * Creates optimized gradients based on edge patterns (single, corner, opposite, etc.).
 *
 * Border system based on edge relationships (checks both this cell and adjacent cells):
 * - **Outer boundaries** (viewport edge + infinite): transparent (extends to ∞)
 * - **Semi borders** (bounded ↔ unbounded): dotted gray (transition zone)
 * - **Unbounded ↔ Unbounded**: transparent (both sides infinite)
 * - **Bounded ↔ Bounded**: solid white (finite container)
 * - **Empty cells**: cool gray dotted on all sides
 *
 * Examples:
 * - Unbounded cell at viewport edge → transparent border (extends to ∞)
 * - Unbounded cell next to bounded cell → dotted border (semi border)
 * - Bounded cell next to unbounded cell → dotted border (semi border)
 * - Unbounded cell next to unbounded cell → transparent border
 * - Bounded cell next to bounded cell → white border
 *
 * @returns Object with border style, background gradient, and detected edges
 */
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

	// Build borders surgically: each side gets its own style based on whether IT is infinite
	let border: string;

	if (!showGrid) {
		border = `border: ${STYLES.border.none}`;
	} else if (!cell) {
		// Empty cells: all sides transparent dotted
		border = `border: ${STYLES.border.transparent}`;
	} else {
		// Data cells: Apply per-side border logic by checking both this cell and adjacent cells
		// Semi borders appear whenever bounded meets unbounded (regardless of which side is which)

		// Get adjacent cells
		const topCell = grid.get(`${x},${y - 1}`);
		const bottomCell = grid.get(`${x},${y + 1}`);
		const leftCell = grid.get(`${x - 1},${y}`);
		const rightCell = grid.get(`${x + 1},${y}`);

		// Apply borders per-side based on infinite edge relationships
		const topBorder = getBorderStyle(edges.top, isTopRow, topCell);
		const bottomBorder = getBorderStyle(edges.bottom, isBottomRow, bottomCell);
		const leftBorder = getBorderStyle(edges.left, isLeftCol, leftCell);
		const rightBorder = getBorderStyle(edges.right, isRightCol, rightCell);

		border = [
			`border-top: ${topBorder}`,
			`border-bottom: ${bottomBorder}`,
			`border-left: ${leftBorder}`,
			`border-right: ${rightBorder}`,
		].join('; ');
	}

	return { border, background, edges };
}

/**
 * Build single arrow indicator HTML.
 */
function buildArrow(symbol: string, position: string): string {
	const { arrowOverlay } = STYLES.colors;
	const { arrowFont } = STYLES.sizes;
	const baseStyle = `position: absolute; color: ${arrowOverlay}; font-size: ${arrowFont}; font-weight: bold;`;
	return `<span style="${baseStyle} ${position}">${symbol}</span>`;
}

/**
 * Build directional arrow indicators for infinite edges.
 * Returns HTML for positioned arrow overlays (⇡⇣⇠⇢).
 */
function buildInfiniteIndicator(edges: InfiniteEdges): string {
	if (edges.count === 0) return '';

	const arrows: string[] = [];
	const { arrowOffset } = STYLES.spacing;

	if (edges.top) {
		arrows.push(buildArrow('⇡', `top: ${arrowOffset}; left: 50%; transform: translateX(-50%);`));
	}
	if (edges.bottom) {
		arrows.push(buildArrow('⇣', `bottom: ${arrowOffset}; left: 50%; transform: translateX(-50%);`));
	}
	if (edges.left) {
		arrows.push(buildArrow('⇠', `left: ${arrowOffset}; top: 50%; transform: translateY(-50%);`));
	}
	if (edges.right) {
		arrows.push(buildArrow('⇢', `right: ${arrowOffset}; top: 50%; transform: translateY(-50%);`));
	}

	return arrows.join('');
}

// ============================================================================
// Table Rendering
// ============================================================================

/**
 * Build header (th) element with optional infinity indicator.
 * Used for both column and row headers.
 */
function buildHeader(
	coord: number,
	isStartEdge: boolean,
	isEndEdge: boolean,
	startLabel: string,
	endLabel: string,
	extraStyles?: string,
): string {
	const isInfinite = isStartEdge || isEndEdge;
	const label = isInfinite ? formatCoordinateLabel(coord, true) : String(coord);

	// Build title attribute for infinite edges
	let titleAttr = '';
	if (isInfinite) {
		const directions = [
			isStartEdge ? startLabel : null,
			isEndEdge ? endLabel : null,
		].filter(Boolean).join(' and ');
		titleAttr = ` title="Extends to ${directions} infinity"`;
	}

	// Assemble header styles
	const styleParts = [
		`border: ${STYLES.border.header}`,
		`padding: ${STYLES.spacing.headerPadding}`,
		'text-align: center',
		`font-size: ${STYLES.sizes.headerFont}`,
		`color: ${STYLES.colors.headerText}`,
		'font-weight: 300',
	];
	if (extraStyles) styleParts.push(extraStyles);

	return `<th style="${styleParts.join('; ')}"${titleAttr}>${label}</th>`;
}

/** Build column header (th) element with optional infinity indicator */
function buildColumnHeader(
	x: number,
	leftInf: boolean,
	rightInf: boolean,
	minX: number,
	maxX: number,
	cellWidth: number,
): string {
	return buildHeader(
		x,
		x === minX && leftInf,
		x === maxX && rightInf,
		'left',
		'right',
		`min-width: ${cellWidth}px`,
	);
}

/** Build row header (th) element with optional infinity indicator */
function buildRowHeader(
	y: number,
	topInf: boolean,
	bottomInf: boolean,
	minY: number,
	maxY: number,
): string {
	return buildHeader(
		y,
		y === minY && topInf,
		y === maxY && bottomInf,
		'top',
		'bottom',
	);
}

/**
 * Build a single table cell (td) with styling and infinite edge indicators.
 *
 * @returns HTML string for the cell element
 */
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
): string {
	const cell = grid.get(`${x},${y}`);
	const bgColor = cell?.color ?? STYLES.colors.transparent;
	const label = cell?.label ?? '';
	const textColor = cell ? getContrastColor(bgColor) : '#000';

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

	const indicators = buildInfiniteIndicator(edges);
	const { cellFont } = STYLES.sizes;

	// Assemble cell styles
	const cellStyle = [
		'position: relative',
		border,
		`background: ${background}`,
		`color: ${textColor}`,
		'text-align: center',
		'vertical-align: middle',
		`width: ${cellWidth}px`,
		`height: ${cellHeight}px`,
		`font-size: ${cellFont}`,
	].join('; ');

	return `<td style="${cellStyle}">${indicators}<span style="position: relative; z-index: 1;">${
		escapeHtml(label)
	}</span></td>`;
}

/**
 * Render complete HTML table from spatial fragments.
 * Main entry point for table generation.
 */
function renderHTMLTable<T>(
	fragments: Iterable<QueryResult<T>>,
	extent: ExtentResult,
	params: Partial<HTMLRenderParams<T>> = {},
): string {
	const {
		className = 'spatial-index-grid',
		legend = {},
		showCoordinates = true,
		cellWidth = 40,
		cellHeight = 40,
		showGrid = true,
	} = params;

	// Handle empty index
	const fragmentsArray = Array.from(fragments);
	if (fragmentsArray.length === 0 && extent.empty) {
		const { empty } = STYLES.colors;
		const { messagePadding } = STYLES.spacing;
		return `<div class="${
			escapeHtml(className)
		}" style="padding: ${messagePadding}; text-align: center; color: ${empty};">Empty index</div>`;
	}

	const grid = buildGrid(fragmentsArray, extent, legend);
	const [minX, minY, maxX, maxY] = extent.mbr;
	const [leftInf, topInf, rightInf, bottomInf] = extent.edges;

	const parts: string[] = [];
	const { tableMargin } = STYLES.spacing;

	// Table opening tag
	parts.push(
		`<table class="${
			escapeHtml(className)
		}" style="border-collapse: collapse; font-family: monospace; margin: ${tableMargin};">`,
	);

	// Column headers
	if (showCoordinates) {
		parts.push('<thead><tr><th style="border: none;"></th>');
		for (let x = minX; x <= maxX; x++) {
			parts.push(buildColumnHeader(x, leftInf, rightInf, minX, maxX, cellWidth));
		}
		parts.push('</tr></thead>');
	}

	// Table body
	parts.push('<tbody>');
	for (let y = minY; y <= maxY; y++) {
		parts.push('<tr>');

		// Row header
		if (showCoordinates) {
			parts.push(buildRowHeader(y, topInf, bottomInf, minY, maxY));
		}

		// Data cells
		for (let x = minX; x <= maxX; x++) {
			parts.push(buildCell(x, y, grid, minX, maxX, minY, maxY, cellWidth, cellHeight, showGrid));
		}

		parts.push('</tr>');
	}
	parts.push('</tbody></table>');

	// Optional annotation for fully unbounded case
	const allEdgesInfinite = leftInf && topInf && rightInf && bottomInf;
	if (allEdgesInfinite) {
		const { messageMargin } = STYLES.spacing;
		const { headerFont } = STYLES.sizes;
		parts.push(
			`<div style="margin: ${messageMargin}; font-size: ${headerFont}; color: #999; font-family: sans-serif; font-style: italic;">Unbounded in all directions</div>`,
		);
	}

	return parts.join('');
}

// ============================================================================
// Parameter Defaults
// ============================================================================

/** Common render parameter defaults shared across contexts */
const RENDER_DEFAULTS = {
	className: 'spatial-index-grid',
	legend: {},
	showCoordinates: true,
	cellWidth: 40,
	cellHeight: 40,
	showGrid: true,
	includeOrigin: false,
} as const;

function withRenderDefaults<T>(
	params: HTMLRenderParams<T>,
): Required<HTMLRenderParams<T>> {
	return { ...RENDER_DEFAULTS, ...params, legend: params.legend ?? RENDER_DEFAULTS.legend };
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

// ============================================================================
// Backend Implementation
// ============================================================================

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
		const html = renderHTMLTable(fragments, extent, mergedParams);
		return { html };
	}
	layout(
		irs: Iterable<HTMLBackendIR>,
		params?: Partial<HTMLLayoutParams<T>>,
	): string {
		const { direction, spacing, title } = { ...this.params, ...params };

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
		for (const ir of irs) {
			parts.push(ir.html);
		}
		parts.push('</div>');

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
