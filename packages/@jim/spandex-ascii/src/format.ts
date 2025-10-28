import type { ExtentResult } from '@jim/spandex';
import { getGridConnectivity, selectJunction } from './box-drawing.ts';
import { CELL_WIDTH, EMPTY_CELL, JUNCTIONS, LABELS, LINES, SEPARATORS } from './constants.ts';
import { columnToLetter, formatRowNumber } from './coordinates.ts';
import {
	EDGE_BOUNDED,
	EDGE_SEMI,
	EDGE_UNBOUNDED,
	getHorizontalEdge,
	getVerticalEdge,
	type SparseGrid,
} from './sparse.ts';

/** Build label array with optional infinity markers at edges */
function buildLabels(
	min: number,
	max: number,
	leadingInf: boolean,
	trailingInf: boolean,
	formatter: (index: number) => string,
): string[] {
	// Special case: extent at origin with infinite edges - no finite labels to show
	if (leadingInf && trailingInf && min === 0 && max === 0) return [LABELS.infinity];

	const size = max - min + 1;
	if (size > 1) {
		const labels: string[] = [];
		if (leadingInf) labels.push(LABELS.infinity);
		const numFinite = size - (leadingInf ? 1 : 0) - (trailingInf ? 1 : 0);
		const startCoord = leadingInf ? min + 1 : min;
		for (let i = 0; i < numFinite; i++) labels.push(formatter(startCoord + i));
		if (trailingInf) labels.push(LABELS.infinity);
		return labels;
	}
	return [formatter(min)];
}

/** Center text in a cell, truncating if necessary */
function centerInCell(text: string): string {
	const len = Math.min(text.length, CELL_WIDTH);
	const leftPad = Math.floor((CELL_WIDTH - len) / 2);
	const rightPad = CELL_WIDTH - len - leftPad;
	return ' '.repeat(leftPad) + text.substring(0, len) + ' '.repeat(rightPad);
}

//#region Utilities

/** Serialize value to string for legend/key matching (inverse of parseValue from parse.ts) */
export function serializeValue(value: unknown): string {
	if (typeof value === 'object' && value != null && !Array.isArray(value)) {
		const entries = Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `"${k}": ${serializeValue(v)}`)
			.join(', ');
		return `{ ${entries} }`;
	}
	return JSON.stringify(value);
}

/** Format legend entries as sorted lines: "key = value" */
export function formatASCIILegend(legend: Record<string, unknown>): string[] {
	return Object.entries(legend)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key} = ${serializeValue(value).trimEnd()}`);
}

//#endregion Utilities

/** Format sparse grid to ASCII lines (box-drawing, labels, origin marker if requested) */
export function formatToAscii(
	grid: SparseGrid,
	extent: ExtentResult,
	legend: Record<string, unknown>,
	gridOnly: boolean,
	includeOrigin = false,
): string[] {
	//#region Label Formatting

	const { mbr, edges } = extent;
	const [leftInfinite, topInfinite, rightInfinite, bottomInfinite] = edges;
	const [minX, minY, maxX, maxY] = mbr;
	const width = maxX - minX + 1, height = maxY - minY + 1;

	// Build labels (or empty set markers for empty grid)
	const isEmpty = grid.values.size === 0;
	const columnLabels = isEmpty
		? [LABELS.emptySet]
		: buildLabels(minX, maxX, leftInfinite, rightInfinite, columnToLetter);
	const rowLabels = isEmpty
		? [LABELS.emptySet]
		: buildLabels(minY, maxY, topInfinite, bottomInfinite, formatRowNumber);
	const rowLabelWidth = Math.max(...rowLabels.map((l) => l.length));
	const rowLabelColumnWidth = rowLabelWidth + 1;

	//#region Row Rendering

	// Edge type to character lookup tables (indexed by EdgeType: 0=unbounded, 1=semi, 2=bounded)
	const verticalChars = [LINES.unbounded.vertical, LINES.semi.vertical, LINES.bounded.vertical];
	const horizontalChars = [LINES.unbounded.horizontal, LINES.semi.horizontal, LINES.bounded.horizontal];
	// Pre-computed horizontal segments (CELL_WIDTH repetitions)
	const horizontalSegments = horizontalChars.map((char) => char.repeat(CELL_WIDTH));

	function withRowLabel(content: string, label: string, rowLabelWidth: number): string {
		return `${label.padStart(rowLabelWidth, ' ')} ${content}`;
	}

	function renderColumnLabelRow(labels: string[], rowLabelWidth: number): string {
		const content = labels.map(centerInCell).join(SEPARATORS.column);
		return withRowLabel(`${SEPARATORS.column}${content}${SEPARATORS.column}`, '', rowLabelWidth);
	}

	/** Render a data row with appropriate vertical line characters from edge data */
	function renderDataRow(
		grid: SparseGrid,
		gridY: number,
		label: string,
		width: number,
		rowLabelWidth: number,
	): string {
		const left = verticalChars[getVerticalEdge(grid, 0, gridY)]!;
		const right = verticalChars[getVerticalEdge(grid, width, gridY)]!;

		// Build cells and interior edges
		const parts: string[] = [left];
		for (let gridX = 0; gridX < width; gridX++) {
			const col = grid.values.get(gridX);
			parts.push(centerInCell(col?.get(gridY) ?? EMPTY_CELL));
			if (gridX < width - 1) {
				parts.push(verticalChars[getVerticalEdge(grid, gridX + 1, gridY)]!);
			}
		}
		parts.push(right);
		return withRowLabel(parts.join(''), label, rowLabelWidth);
	}

	/** Select junction character based on edge types at this position */
	function selectJunctionForPosition(
		grid: SparseGrid,
		gridX: number,
		gridY: number,
		width: number,
		height: number,
	): string {
		const connectivity = getGridConnectivity(gridX, gridY, width, height);
		const [canLeft, canTop, canRight, canBottom] = connectivity;

		const edges = [
			canLeft ? getHorizontalEdge(grid, gridX - 1, gridY) : EDGE_UNBOUNDED,
			canTop ? getVerticalEdge(grid, gridX, gridY - 1) : EDGE_UNBOUNDED,
			canRight ? getHorizontalEdge(grid, gridX, gridY) : EDGE_UNBOUNDED,
			canBottom ? getVerticalEdge(grid, gridX, gridY) : EDGE_UNBOUNDED,
		] as const;
		const [left, top, right, bottom] = edges;

		let boundedCount = 0, semiCount = 0;
		for (const edge of edges) {
			if (edge === EDGE_BOUNDED) boundedCount++;
			else if (edge === EDGE_SEMI) semiCount++;
		}

		// Three-tier junction selection
		// Tier 1: If 2+ bounded/semi edges → use bounded junctions with bounded+semi connectivity
		if (boundedCount + semiCount >= 2) {
			return selectJunction(
				[left >= EDGE_SEMI, top >= EDGE_SEMI, right >= EDGE_SEMI, bottom >= EDGE_SEMI],
				JUNCTIONS.bounded,
			);
		}
		// Tier 2 & 3: Use semi or unbounded junctions with all non-unbounded connectivity
		const junctions = semiCount > 0 ? JUNCTIONS.semi : JUNCTIONS.unbounded;
		return selectJunction([left > 0, top > 0, right > 0, bottom > 0], junctions);
	}

	/** Build horizontal line (border or cap) with appropriate character sets using edge data */
	function renderHorizontalLine(
		grid: SparseGrid,
		gridY: number,
		width: number,
		height: number,
		rowLabelColumnWidth: number,
		includeOrigin: boolean,
		minX: number,
		minY: number,
	): string {
		const segments: string[] = [];

		for (let gridX = 0; gridX < width; gridX++) {
			const edgeType = getHorizontalEdge(grid, gridX, gridY);
			const horizontal = horizontalSegments[edgeType];

			if (includeOrigin && gridY === -minY && gridX === -minX) {
				segments.push(JUNCTIONS.absoluteOrigin + horizontal);
			} else {
				const junction = selectJunctionForPosition(grid, gridX, gridY, width, height);
				segments.push(junction + horizontal);
			}
		}

		// Right edge junction
		const rightEdge = selectJunctionForPosition(grid, width, gridY, width, height);
		return SEPARATORS.row.repeat(rowLabelColumnWidth) + segments.join('') + rightEdge;
	}

	//#endregion Row Rendering

	//#region Main Rendering Loop

	// Build output lines: column labels, top border/cap, data rows with borders, bottom border/cap
	const lines: string[] = [renderColumnLabelRow(columnLabels, rowLabelWidth).trimEnd()];

	// Format top border/cap
	lines.push(renderHorizontalLine(grid, 0, width, height, rowLabelColumnWidth, includeOrigin, minX, minY).trimEnd());

	for (let gridY = 0; gridY < height; gridY++) {
		// Format (non-first) row top border
		if (gridY > 0) {
			lines.push(
				renderHorizontalLine(grid, gridY, width, height, rowLabelColumnWidth, includeOrigin, minX, minY)
					.trimEnd(),
			);
		}
		// Format rows with cells
		lines.push(renderDataRow(grid, gridY, rowLabels[gridY]!, width, rowLabelWidth).trimEnd());
	}
	// Format last row bottom border/cap
	lines.push(
		renderHorizontalLine(grid, height, width, height, rowLabelColumnWidth, includeOrigin, minX, minY).trimEnd(),
	);

	// Append legend and infinity edge annotations (unless gridOnly mode)
	if (!gridOnly) {
		lines.push('', ...formatASCIILegend(legend));

		const infiniteEdges = (['left', 'top', 'right', 'bottom'] as const).filter((_, i) => edges[i]);
		if (infiniteEdges.length) {
			lines.push(
				'',
				`(${LABELS.infinity} edge${infiniteEdges.length > 1 ? 's' : ''}: ${infiniteEdges.join(', ')})`,
			);
		}
	}

	//#endregion Main Rendering Loop

	return lines;
}
