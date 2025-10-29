import type { RenderParams } from '@jim/spandex/render';

/**
 * Legend type mapping keys to visual properties and values.
 * Each entry defines how a value should be displayed in the rendered grid.
 *
 * @example
 * ```typescript
 * const legend: HTMLLegend<string> = {
 *   red: { label: 'R', color: '#ff0000', value: 'red' },
 *   blue: { label: 'B', color: '#0000ff', value: 'blue' }
 * };
 * ```
 */
export type HTMLLegend<T> = Record<string, { label: string; color: string; value: T }>;

/**
 * HTML rendering parameters for complete renders.
 *
 * Controls the visual appearance and behavior of rendered HTML tables.
 * Includes options for styling, coordinates, and infinite edge visualization.
 */
export interface HTMLRenderParams<T> extends RenderParams {
	/** CSS class name for the table element (default: 'spatial-index-grid') */
	className?: string;
	/** Legend mapping values to display labels and colors */
	legend?: HTMLLegend<T>;
	/** Show coordinate labels on axes (default: true) */
	showCoordinates?: boolean;
	/** Cell width in pixels (default: 40) */
	cellWidth?: number;
	/** Cell height in pixels (default: 40) */
	cellHeight?: number;
	/** Show grid lines (default: true) */
	showGrid?: boolean;
	/** If true, omit legend (grid only, default: false) */
	gridOnly?: boolean;
}

/**
 * HTML rendering parameters for partial renders.
 * Used when composing multiple grids in layouts.
 */
export interface HTMLPartialParams<T> extends RenderParams {
	/** Optional name to display above the grid */
	name?: string;
	/** Legend mapping values to display labels and colors */
	legend?: HTMLLegend<T>;
}

/**
 * HTML layout parameters for composing multiple renders.
 */
export interface HTMLLayoutParams<T> extends HTMLRenderParams<T> {
	/** Layout direction: horizontal or vertical */
	direction?: 'horizontal' | 'vertical';
	/** Spacing between renders in pixels */
	spacing?: number;
	/** Title for the overall layout (optional) */
	title?: string | undefined;
}
