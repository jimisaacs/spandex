/** ASCII backend: text grids with box-drawing and legend */

import type { ExtentResult, QueryResult } from '@jim/spandex';
import type { LayoutContext, RenderBackend, RenderContext } from '@jim/spandex/render';
import { formatASCIILegend, formatToAscii, serializeValue } from './format.ts';
import {
	createSparseGrid,
	EDGE_BOUNDED,
	EDGE_UNBOUNDED,
	setHorizontalEdge,
	setVerticalEdge,
	type SparseGrid,
} from './sparse.ts';
import type { ASCIILayoutParams, ASCIIPartialParams, ASCIIRenderParams } from './types.ts';

interface ASCIIBackendIR {
	lines: string[];
	width: number;
}

function buildSparseGrid<T>(
	fragments: Iterable<QueryResult<T>>,
	extent: ExtentResult,
	legend: Record<string, unknown>,
	usedLegendKeys?: Set<string> | null,
): SparseGrid {
	const legendKeys = new Map(Object.entries(legend).map(([k, v]) => [serializeValue(v), k]));
	const [minX, minY, maxX, maxY] = extent.mbr;
	const grid = createSparseGrid();

	for (const [bounds, value] of fragments) {
		const [x1, y1, x2, y2] = bounds;
		if (x2 < minX || x1 > maxX || y2 < minY || y1 > maxY) continue;

		const serialized = serializeValue(value);
		const key = legendKeys.get(serialized);
		if (!key) {
			throw new Error(
				`Missing legend key for value ${serialized} at bounds [${bounds.join(', ')}]. ` +
					`Available keys: ${[...legendKeys.keys()].join(', ')}`,
			);
		}

		usedLegendKeys?.add(key);

		const clampedX1 = Math.max(minX, x1), clampedX2 = Math.min(maxX, x2);
		const clampedY1 = Math.max(minY, y1), clampedY2 = Math.min(maxY, y2);

		// Convert to grid coordinates once
		const gridX1 = clampedX1 - minX, gridX2 = clampedX2 - minX;
		const gridY1 = clampedY1 - minY, gridY2 = clampedY2 - minY;

		// Populate cell values
		for (let gridY = gridY1; gridY <= gridY2; gridY++) {
			for (let gridX = gridX1; gridX <= gridX2; gridX++) {
				let col = grid.values.get(gridX);
				if (!col) grid.values.set(gridX, col = new Map());
				col.set(gridY, key);
			}
		}

		// FIRST PASS: Naive rectangle edge types (from fragment geometry)
		// - Infinite bound → UNBOUNDED (no boundary)
		// - Finite bound → BOUNDED (real boundary)
		// Conflicts resolved by max (bounded beats unbounded)

		const topType = y1 === -Infinity ? EDGE_UNBOUNDED : EDGE_BOUNDED;
		const bottomType = y2 === Infinity ? EDGE_UNBOUNDED : EDGE_BOUNDED;
		const leftType = x1 === -Infinity ? EDGE_UNBOUNDED : EDGE_BOUNDED;
		const rightType = x2 === Infinity ? EDGE_UNBOUNDED : EDGE_BOUNDED;

		for (let gridX = gridX1; gridX <= gridX2; gridX++) {
			setHorizontalEdge(grid, gridX, gridY1, topType);
			setHorizontalEdge(grid, gridX, gridY2 + 1, bottomType);
		}

		for (let gridY = gridY1; gridY <= gridY2; gridY++) {
			setVerticalEdge(grid, gridX1, gridY, leftType);
			setVerticalEdge(grid, gridX2 + 1, gridY, rightType);
		}

		for (let gridY = gridY1 + 1; gridY <= gridY2; gridY++) {
			for (let gridX = gridX1; gridX <= gridX2; gridX++) {
				setHorizontalEdge(grid, gridX, gridY, EDGE_BOUNDED);
			}
		}

		for (let gridY = gridY1; gridY <= gridY2; gridY++) {
			for (let gridX = gridX1 + 1; gridX <= gridX2; gridX++) {
				setVerticalEdge(grid, gridX, gridY, EDGE_BOUNDED);
			}
		}
	}

	return grid;
}

function addNameHeader(gridLines: string[], name: string, gridWidth: number): string[] {
	const width = Math.max(gridWidth, name.length);
	const leftPad = Math.floor((width - name.length) / 2);
	const centeredName = name.padStart(name.length + leftPad).padEnd(width);
	return [centeredName, '', ...gridLines];
}

function render<T>(
	fragments: Iterable<QueryResult<T>>,
	extent: ExtentResult,
	{ strict, usedLegendKeys, legend, includeOrigin, gridOnly }: Required<ASCIIRenderParams<T>>,
): string {
	const grid = buildSparseGrid(fragments, extent, legend, usedLegendKeys);
	if (strict && usedLegendKeys) validateStrictMode(legend, usedLegendKeys);
	return formatToAscii(grid, extent, legend, gridOnly, includeOrigin).join('\n');
}

function renderPartial<T>(
	fragments: Iterable<QueryResult<T>>,
	extent: ExtentResult,
	{ legend, usedLegendKeys, includeOrigin, name }: Required<ASCIILayoutParams<T>> & ASCIIPartialParams,
): ASCIIBackendIR {
	const grid = buildSparseGrid(fragments, extent, legend, usedLegendKeys);
	const lines = formatToAscii(grid, extent, legend, true, includeOrigin);
	let gridWidth = 0;
	for (const line of lines) {
		if (line.length > gridWidth) gridWidth = line.length;
	}
	const width = Math.max(gridWidth, name.length);
	return { lines: addNameHeader(lines, name, gridWidth), width };
}

function layout<T>(
	irs: Iterable<ASCIIBackendIR>,
	{ strict, usedLegendKeys, legend, gridOnly, spacing = 0 }: Required<ASCIILayoutParams<T>>,
): string {
	if (strict && usedLegendKeys) validateStrictMode(legend, usedLegendKeys);

	const grids = Array.from(irs);
	if (!grids.length) return gridOnly ? '' : formatASCIILegend(legend).join('\n');

	const spacer = ' '.repeat(spacing);
	const maxHeight = Math.max(...grids.map((g) => g.lines.length));
	const rows: string[] = [];

	for (let row = 0; row < maxHeight; row++) {
		rows.push(grids.map((g) => (g.lines[row] ?? '').padEnd(g.width)).join(spacer).trimEnd());
	}

	const result = rows.join('\n');
	return gridOnly ? result : `${result}\n\n${formatASCIILegend(legend).join('\n')}`;
}

function validateStrictMode(legend: Record<string, unknown>, usedLegendKeys: Set<string>): void {
	const unused = Object.keys(legend).filter((k) => !usedLegendKeys.has(k));
	if (unused.length) {
		throw new Error(`Strict mode enabled: ${unused.length} unused legend key(s): ${unused.join(', ')}`);
	}
}

function withRenderDefaults<T>(params: ASCIIRenderParams<T>): Required<ASCIIRenderParams<T>> {
	const {
		includeOrigin = false,
		legend,
		gridOnly = false,
		strict = true,
		usedLegendKeys = strict ? new Set() : null,
	} = params;
	return { includeOrigin, legend, gridOnly, strict, usedLegendKeys };
}

function withLayoutDefaults<T>(params: ASCIILayoutParams<T>): Required<ASCIILayoutParams<T>> {
	return { spacing: params.spacing ?? 3, ...withRenderDefaults(params) };
}

class ASCIIRenderContext<T> implements RenderContext<T, string, ASCIIRenderParams<T>> {
	readonly params: Required<ASCIIRenderParams<T>>;
	constructor(params: ASCIIRenderParams<T>) {
		this.params = withRenderDefaults(params);
	}
	render(fragments: Iterable<QueryResult<T>>, extent: ExtentResult, params?: Partial<ASCIIRenderParams<T>>): string {
		return render(fragments, extent, { ...this.params, ...params });
	}
}

class ASCIILayoutContext<T>
	implements LayoutContext<T, string, ASCIILayoutParams<T>, ASCIIPartialParams, ASCIIBackendIR> {
	readonly params: Required<ASCIILayoutParams<T>>;
	constructor(params: ASCIILayoutParams<T>) {
		this.params = withLayoutDefaults(params);
	}
	renderPartial(
		fragments: Iterable<QueryResult<T>>,
		extent: ExtentResult,
		params: ASCIIPartialParams,
	): ASCIIBackendIR {
		return renderPartial(fragments, extent, { ...this.params, ...params });
	}
	layout(irs: Iterable<ASCIIBackendIR>, params?: Partial<ASCIILayoutParams<T>>): string {
		return layout(irs, { ...this.params, ...params });
	}
}

export class ASCIIBackend implements
	RenderBackend<
		string,
		ASCIIRenderParams<unknown>,
		ASCIILayoutParams<unknown>,
		ASCIIPartialParams,
		ASCIIBackendIR
	> {
	context<T>(params: ASCIIRenderParams<T>): RenderContext<T, string, ASCIIRenderParams<T>> {
		return new ASCIIRenderContext(params);
	}
	layoutContext<T>(
		params: ASCIILayoutParams<T>,
	): LayoutContext<T, string, ASCIILayoutParams<T>, ASCIIPartialParams, ASCIIBackendIR> {
		return new ASCIILayoutContext(params);
	}
}
