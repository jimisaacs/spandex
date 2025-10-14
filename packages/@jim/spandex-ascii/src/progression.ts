/**
 * Progression rendering utilities
 *
 * Render index progression side-by-side to show evolution through cumulative operations.
 */

import type { QueryResult, SpatialIndex } from '@jim/spandex';
import { formatLegend, render } from './render.ts';
import type { RenderOptions } from './types.ts';

export interface State<T> {
	name: string;
	query: () => IterableIterator<QueryResult<T>>;
}

export interface StateOptions extends RenderOptions {
	spacing?: number; // Space between grids (default 3)
	// Inherits: strict?, coordinateSystem?
	// Note: gridOnly is always true for individual state grids (legend added at bottom)
}

export interface ProgressionStep<T> {
	name: string;
	action: (index: SpatialIndex<T>) => void;
}

/**
 * Layout grids horizontally with titles
 */
function layoutGridsHorizontally(
	grids: Array<{ name: string; grid: string }>,
	spacing: number,
): string {
	const spacer = ' '.repeat(spacing);

	// Parse grids into lines and calculate dimensions
	const parsed = grids.map(({ name, grid }) => {
		const lines = grid.split('\n');
		const width = Math.max(...lines.map((l) => l.length), name.length);
		return { name, lines, width };
	});

	const maxHeight = Math.max(...parsed.map((g) => g.lines.length));

	// Helper: center text within width
	const center = (text: string, width: number) => {
		const leftPad = Math.floor((width - text.length) / 2);
		return text.padStart(text.length + leftPad).padEnd(width);
	};

	const output: string[] = [];

	// Title row (centered)
	output.push(parsed.map((g) => center(g.name, g.width)).join(spacer));
	output.push(''); // Blank line

	// Grid rows (top-aligned, pad shorter grids)
	for (let row = 0; row < maxHeight; row++) {
		const rowParts = parsed.map((g) => {
			const line = g.lines[row] ?? '';
			return line.padEnd(g.width);
		});
		output.push(rowParts.join(spacer));
	}

	return output.join('\n');
}

/**
 * Render independent states side-by-side with shared legend
 *
 * Lower-level primitive for displaying multiple query results horizontally.
 * Unlike renderProgression, states are independent (not cumulative).
 *
 * @param states - Array of named query functions
 * @param legend - Shared legend mapping symbols to values
 * @param options - Rendering options (strict validation, spacing)
 * @returns Complete state visualization with shared legend
 *
 * @example
 * ```ts
 * const state1 = Array.from(index1.query());
 * const state2 = Array.from(index2.query());
 *
 * const result = renderStates(
 *   [
 *     { name: 'Before', query: () => state1.values() },
 *     { name: 'After', query: () => state2.values() },
 *   ],
 *   { 'R': 'RED', 'B': 'BLUE' }
 * );
 * ```
 */
export function renderStates<T>(
	states: State<T>[],
	legend: Record<string, T | Record<string, unknown>>,
	options?: StateOptions,
): string {
	const { spacing = 3, gridOnly = false, ...renderOptions } = options ?? {};

	// Render each state's grid (always gridOnly for composition)
	const grids: Array<{ name: string; grid: string }> = [];

	for (const { name, query } of states) {
		const grid = render(query, legend, { ...renderOptions, gridOnly: true });
		grids.push({ name, grid });
	}

	// Layout grids horizontally
	const layout = layoutGridsHorizontally(grids, spacing);

	// Add shared legend at bottom (unless gridOnly requested)
	if (gridOnly) return layout;

	const legendLines = formatLegend(legend);
	return layout + '\n\n' + legendLines.join('\n');
}

/**
 * Render index progression side-by-side with shared legend
 *
 * @param indexFactory - Factory function that creates a fresh index
 * @param steps - Array of progression steps to apply cumulatively
 * @param legend - Shared legend mapping symbols to values
 * @param options - Rendering options (strict validation, spacing)
 * @returns Complete progression visualization with shared legend
 *
 * @example
 * ```ts
 * const result = renderProgression(
 *   () => new MortonLinearScanImpl<string>(),
 *   [
 *     { name: 'Empty', action: () => {} },
 *     { name: 'After H', action: (idx) => idx.insert([-Infinity, 1, Infinity, 1], 'HORIZONTAL') },
 *     { name: 'After V', action: (idx) => idx.insert([1, -Infinity, 1, Infinity], 'VERTICAL') },
 *   ],
 *   { 'H': 'HORIZONTAL', 'V': 'VERTICAL' }
 * );
 * ```
 */
export function renderProgression<T>(
	indexFactory: () => SpatialIndex<T>,
	steps: ProgressionStep<T>[],
	legend: Record<string, T | Record<string, unknown>>,
	options?: StateOptions,
): string {
	const { spacing = 3, gridOnly = false, ...renderOptions } = options ?? {};

	// Create fresh index
	const index = indexFactory();

	// Execute steps cumulatively and render each state (always gridOnly for composition)
	const grids: Array<{ name: string; grid: string }> = [];

	for (const { name, action } of steps) {
		action(index);
		const grid = render(() => index.query(), legend, { ...renderOptions, gridOnly: true });
		grids.push({ name, grid });
	}

	// Layout grids horizontally
	const layout = layoutGridsHorizontally(grids, spacing);

	// Add shared legend at bottom (unless gridOnly requested)
	if (gridOnly) return layout;

	const legendLines = formatLegend(legend);
	return layout + '\n\n' + legendLines.join('\n');
}
