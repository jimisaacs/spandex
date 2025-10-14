/**
 * Shared types for ASCII rendering and parsing
 */

/**
 * Coordinate system for grid rendering.
 *
 * **Viewport mode** (default): Shows only the data extent.
 * - Compact: Grid is sized to fit the data
 * - Relative: No origin marker, coordinates relative to data bounds
 * - Use for: Displaying data ranges, focusing on the data itself
 * - Example: Data at [5,10] renders as single cell grid without showing rows 0-4
 *
 * **Absolute mode**: Shows world coordinates with origin (0,0) always visible.
 * - Reference point: Marked with `*` at (0,0)
 * - Expands to include: Both the origin AND the data extent
 * - Use for: Showing data position in world space, debugging coordinates
 * - Example: Data at [5,10] renders grid from [0,0] to [5,10] with `*` at origin
 * - Works with negative coords: Data at [-5,-3] shows grid from [-5,-3] to [0,0]
 */
export type CoordinateSystem = 'viewport' | 'absolute';

/** Options for rendering spatial query results to ASCII */
export interface RenderOptions {
	/**
	 * Coordinate system for rendering (default: 'viewport').
	 * - 'viewport': Compact grid showing only data extent
	 * - 'absolute': Expanded grid always including origin (0,0) marked with `*`
	 */
	coordinateSystem?: CoordinateSystem;
	/** Validate all legend symbols are used in the index */
	strict?: boolean;
	/** Render only the grid (no legend or infinity annotations, default: false) */
	gridOnly?: boolean;
}
