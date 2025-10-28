/**
 * Sparse grid data structure for ASCII grid rendering.
 *
 * Stores cell values and edge types. Coordinates use (x, y) = (column, row).
 * Edges indexed by top-left position.
 */

/** Edge types (priority: 0 < 1 < 2 for conflict resolution) */
export const EDGE_UNBOUNDED = 0; // No line
export const EDGE_SEMI = 1; // Light line (─/│)
export const EDGE_BOUNDED = 2; // Heavy line (━/┃)

export type EdgeType = 0 | 1 | 2;

/** Sparse grid: cell values + edge types */
export interface SparseGrid {
	values: Map<number, Map<number, string>>;
	horizontals: Map<number, Map<number, EdgeType>>;
	verticals: Map<number, Map<number, EdgeType>>;
}

export function createSparseGrid(): SparseGrid {
	return { values: new Map(), horizontals: new Map(), verticals: new Map() };
}

export function setHorizontalEdge(grid: SparseGrid, x: number, y: number, type: EdgeType): void {
	let colMap = grid.horizontals.get(x);
	if (!colMap) grid.horizontals.set(x, colMap = new Map());
	colMap.set(y, Math.max(colMap.get(y) ?? EDGE_UNBOUNDED, type) as EdgeType);
}

export function setVerticalEdge(grid: SparseGrid, x: number, y: number, type: EdgeType): void {
	let colMap = grid.verticals.get(x);
	if (!colMap) grid.verticals.set(x, colMap = new Map());
	colMap.set(y, Math.max(colMap.get(y) ?? EDGE_UNBOUNDED, type) as EdgeType);
}

function getH(grid: SparseGrid, x: number, y: number): EdgeType {
	return grid.horizontals.get(x)?.get(y) ?? EDGE_UNBOUNDED;
}

function getV(grid: SparseGrid, x: number, y: number): EdgeType {
	return grid.verticals.get(x)?.get(y) ?? EDGE_UNBOUNDED;
}

/**
 * Check if a junction at (x, y) is surrounded by unbounded space (no bounded edges connecting).
 * @param grid - Sparse grid
 * @param x - Junction x coordinate
 * @param y - Junction y coordinate
 * @param perpGet - Getter for perpendicular edges (getH for vertical edge, getV for horizontal edge)
 * @param parallelGet - Getter for parallel edges (getV for vertical edge, getH for horizontal edge)
 * @param perpOffsets - Offsets for the two perpendicular edges to check [(x1, y1), (x2, y2)]
 * @param parallelOffset - Offset for the parallel edge to check (x, y)
 * @returns true if junction is surrounded by unbounded space
 */
function isJunctionUnbounded(
	grid: SparseGrid,
	x: number,
	y: number,
	perpGet: typeof getH | typeof getV,
	parallelGet: typeof getH | typeof getV,
	perpOffsets: [[number, number], [number, number]],
	parallelOffset: [number, number],
): boolean {
	return perpGet(grid, x + perpOffsets[0][0], y + perpOffsets[0][1]) === EDGE_UNBOUNDED &&
		perpGet(grid, x + perpOffsets[1][0], y + perpOffsets[1][1]) === EDGE_UNBOUNDED &&
		parallelGet(grid, x + parallelOffset[0], y + parallelOffset[1]) !== EDGE_BOUNDED;
}

/**
 * Get horizontal edge with lazy semi-edge determination.
 * Downgrades BOUNDED to SEMI if both junctions connect only to unbounded space.
 */
export function getHorizontalEdge(grid: SparseGrid, x: number, y: number): EdgeType {
	const type = getH(grid, x, y);
	if (type !== EDGE_BOUNDED) return type;

	// Downgrade to semi if either junction surrounded by unbounded space
	// For horizontal edge at (x, y), check junctions at (x, y) and (x+1, y)
	const leftUnbounded = isJunctionUnbounded(grid, x, y, getV, getH, [[0, -1], [0, 0]], [-1, 0]);
	const rightUnbounded = isJunctionUnbounded(grid, x + 1, y, getV, getH, [[0, -1], [0, 0]], [1, 0]);

	return leftUnbounded || rightUnbounded ? EDGE_SEMI : EDGE_BOUNDED;
}

/**
 * Get vertical edge with lazy semi-edge determination.
 * Downgrades BOUNDED to SEMI if both junctions connect only to unbounded space.
 */
export function getVerticalEdge(grid: SparseGrid, x: number, y: number): EdgeType {
	const type = getV(grid, x, y);
	if (type !== EDGE_BOUNDED) return type;

	// Downgrade to semi if either junction surrounded by unbounded space
	// For vertical edge at (x, y), check junctions at (x, y) and (x, y+1)
	const topUnbounded = isJunctionUnbounded(grid, x, y, getH, getV, [[-1, 0], [0, 0]], [0, -1]);
	const bottomUnbounded = isJunctionUnbounded(grid, x, y + 1, getH, getV, [[-1, 0], [0, 0]], [0, 1]);

	return topUnbounded || bottomUnbounded ? EDGE_SEMI : EDGE_BOUNDED;
}
