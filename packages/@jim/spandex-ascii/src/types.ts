/**
 * Shared types for ASCII rendering and parsing.
 *
 * Defines parameters for rendering spatial data as ASCII grids with box-drawing characters.
 */

import type { RenderParams } from '@jim/spandex/render';

/**
 * Legend mapping for rendering.
 *
 * Maps single-character keys to values that will be displayed in grid cells.
 * Values can be primitives, objects, or arrays (serialized as JSON in legend).
 *
 * @template T - Value type (string, number, object, etc.)
 *
 * @example
 * ```ts
 * const legend: ASCIILegend<string> = {
 *   'R': 'RED',
 *   'B': 'BLUE',
 *   'G': 'GREEN'
 * };
 * ```
 */
export type ASCIILegend<T> = Record<string, T | Record<string, unknown>>;

/**
 * Parameters for standalone ASCII rendering.
 *
 * Produces a single grid with legend and annotations.
 */
export interface ASCIIRenderParams<T> extends RenderParams {
	/** Legend mapping keys to values */
	legend: ASCIILegend<T>;
	/** If true, omit legend and infinity annotations (grid only) */
	gridOnly?: boolean;
	/** If true, throw error if legend contains unused keys */
	strict?: boolean;
	/** Internal: tracks which legend keys were used (for strict mode) */
	usedLegendKeys?: Set<string> | null;
}

/**
 * Parameters for partial rendering in layout compositions.
 *
 * Used when rendering multiple grids side-by-side (progression rendering).
 */
export interface ASCIIPartialParams extends RenderParams {
	/** Optional name to display above the grid */
	name: string;
}

/**
 * Parameters for layout composition (multiple grids side-by-side).
 *
 * Extends render parameters with spacing control for horizontal layout.
 */
export interface ASCIILayoutParams<T> extends ASCIIRenderParams<T> {
	/** Horizontal spacing (in characters) between grids (default: 3) */
	spacing?: number;
}
