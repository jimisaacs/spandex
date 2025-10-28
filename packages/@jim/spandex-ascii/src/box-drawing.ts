/**
 * Box-drawing utilities for ASCII grid rendering
 *
 * Provides:
 * - Type definitions for box-drawing character sets
 * - Junction selection logic based on connectivity
 * - Grid connectivity computation
 *
 * Note: Character constants (LINES, JUNCTIONS) are in constants.ts
 */

import type { EdgeFlags } from '@jim/spandex';

/**
 * Line/border characters (straight segments between junctions).
 * Used for type safety in character set definitions.
 */
export interface LineChars {
	readonly vertical: string;
	readonly horizontal: string;
}

/**
 * Junction characters (intersections and corners).
 * Used for type safety in character set definitions.
 */
export interface JunctionChars {
	readonly cross: string;
	readonly teeTop: string;
	readonly teeBottom: string;
	readonly teeLeft: string;
	readonly teeRight: string;
	readonly cornerTopLeft: string;
	readonly cornerTopRight: string;
	readonly cornerBottomLeft: string;
	readonly cornerBottomRight: string;
}

/**
 * Select the appropriate box-drawing junction character based on what connects to it.
 *
 * @param connectivity - Which directions have connections
 * @param junctions - Junction character set to select from
 * @returns The appropriate junction character
 */
export function selectJunction(connectivity: EdgeFlags, junctions: JunctionChars): string {
	const [xmin, ymin, xmax, ymax] = connectivity;
	const connectionCount = (xmin ? 1 : 0) + (ymin ? 1 : 0) + (xmax ? 1 : 0) + (ymax ? 1 : 0);

	// Two connections - either corner or straight line
	if (connectionCount === 2) {
		// Corners (perpendicular connections)
		if (xmax && ymax) return junctions.cornerTopLeft; // ┌
		if (xmin && ymax) return junctions.cornerTopRight; // ┐
		if (xmax && ymin) return junctions.cornerBottomLeft; // └
		if (xmin && ymin) return junctions.cornerBottomRight; // ┘
		// Straight through (parallel connections) - use cross as fallback
		return junctions.cross;
	}

	// Three connections - T-junctions
	if (connectionCount === 3) {
		if (!xmin) return junctions.teeLeft; // ├
		if (!ymin) return junctions.teeTop; // ┬
		if (!xmax) return junctions.teeRight; // ┤
		if (!ymax) return junctions.teeBottom; // ┴
	}

	// Four connections - full cross, or 0-1 connections (degenerate, use cross)
	return junctions.cross;
}

/**
 * Compute which directions connect to a junction in a rectangular grid.
 *
 * @param gridX - X position in grid coordinates (0-based, 0 = left edge, width = right edge)
 * @param gridY - Y position in grid coordinates (0-based, 0 = top edge, height = bottom edge)
 * @param width - Grid width (number of columns)
 * @param height - Grid height (number of rows)
 * @returns EdgeFlags indicating connectivity in all four cardinal directions
 */
export function getGridConnectivity(
	gridX: number,
	gridY: number,
	width: number,
	height: number,
): EdgeFlags {
	// Borders exist between cells, so junction (gridX, gridY) is at:
	// - gridX position (0 = left edge, width = right edge)
	// - gridY position (0 = top edge, height = bottom edge)
	const xmin = gridX === 0, ymin = gridY === 0;
	const xmax = gridX === width, ymax = gridY === height;

	return [
		!xmin, // Can connect leftward if not at left edge
		!ymin, // Can connect upward if not at top edge
		!xmax, // Can connect rightward if not at right edge
		!ymax, // Can connect downward if not at bottom edge
	];
}
