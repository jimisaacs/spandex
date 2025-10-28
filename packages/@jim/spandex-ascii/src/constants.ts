/**
 * Shared constants for ASCII rendering and parsing
 *
 * Naming conventions:
 * - SCREAMING_SNAKE for top-level constants (CELL_WIDTH, LINES, JUNCTIONS)
 * - camelCase for nested properties (infinity, emptySet, column, row)
 */

import type { JunctionChars, LineChars } from './box-drawing.ts';

//#region Grid Structure

/** Width of cell content in characters (excluding borders) */
export const CELL_WIDTH = 3;
/** Grid row stride: each data row followed by border line */
export const GRID_ROW_STRIDE = 2;

//#endregion Grid Structure

//#region Cell Content & Labels

/** Empty space within cell content (data, column labels, row labels) */
export const EMPTY_CELL = ' ';
/** Structural separators for labels and their edges */
export const SEPARATORS = { column: ' ', row: ' ' } as const;
/** Special labels for rendering */
export const LABELS = { infinity: '∞', emptySet: '∅' } as const;

//#endregion Cell Content & Labels

//#region Box Drawing Characters

/**
 * Line characters for different boundedness contexts.
 *
 * Context selection (by segment endpoints):
 * - bounded: Both ends within finite grid bounds
 * - semi: One end finite, one end unbounded (grid edge transitioning to/from infinite space)
 * - unbounded: Both ends unbounded (invisible in infinite space)
 *
 * Per-segment selection in render.ts: selectHorizontalSegment() / selectVerticalSegment()
 */
export const LINES = {
	bounded: { vertical: '┃', horizontal: '━' } as const satisfies LineChars,
	semi: { vertical: '│', horizontal: '─' } as const satisfies LineChars,
	unbounded: { vertical: ' ', horizontal: ' ' } as const satisfies LineChars,
} as const;

/**
 * Junction characters for different spatial contexts.
 *
 * Context selection (by infinity count in 4 cardinal directions):
 * - absoluteOrigin: Special marker for absolute origin (0,0) (overrides normal junction logic)
 * - bounded: 0 infinities (finite interior grid - heavy Unicode box-drawing)
 * - semi: 1-3 infinities (grid boundaries - uniform plus signs)
 * - unbounded: 4 infinities (corners beyond grid - middle dots)
 *
 * Shape selected via selectJunction() based on EdgeFlags connectivity.
 */
export const JUNCTIONS = {
	/** Absolute origin marker (0,0) */
	absoluteOrigin: '*',
	/** Bounded junctions (0 infinities) */
	bounded: {
		cross: '╋', // All 4 directions
		teeTop: '┳', // Connects: left, right, bottom
		teeBottom: '┻', // Connects: left, right, top
		teeLeft: '┣', // Connects: top, right, bottom
		teeRight: '┫', // Connects: top, left, bottom
		cornerTopLeft: '┏', // Connects: right, bottom
		cornerTopRight: '┓', // Connects: left, bottom
		cornerBottomLeft: '┗', // Connects: right, top
		cornerBottomRight: '┛', // Connects: left, top
	} as const satisfies JunctionChars,
	/** Semi-bounded junctions (1-3 infinities) */
	semi: {
		cross: '+',
		teeTop: '+',
		teeBottom: '+',
		teeLeft: '+',
		teeRight: '+',
		cornerTopLeft: '+',
		cornerTopRight: '+',
		cornerBottomLeft: '+',
		cornerBottomRight: '+',
	} as const satisfies JunctionChars,
	/** Unbounded junctions (4 infinities) */
	unbounded: {
		cross: '·', // Shouldn't occur (all 4 can't connect through space)
		teeTop: '·', // Shouldn't occur (only corners used)
		teeBottom: '·', // Shouldn't occur (only corners used)
		teeLeft: '·', // Shouldn't occur (only corners used)
		teeRight: '·', // Shouldn't occur (only corners used)
		cornerTopLeft: '·', // Top-left unbounded corner
		cornerTopRight: '·', // Top-right unbounded corner
		cornerBottomLeft: '·', // Bottom-left unbounded corner
		cornerBottomRight: '·', // Bottom-right unbounded corner
	} as const satisfies JunctionChars,
} as const;

//#endregion Box Drawing Characters
