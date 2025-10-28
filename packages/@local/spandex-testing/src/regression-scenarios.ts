/**
 * @module
 *
 * Shared regression test scenarios for spatial index rendering backends.
 *
 * Provides pre-configured spatial indexes for comprehensive fixture testing.
 * Each scenario validates a specific aspect of spatial indexing:
 * - **Rendering options**: Origin inclusion, negative coords
 * - **Infinity edges**: Unbounded ranges in all directions
 * - **Data density**: Sparse, dense, and empty grids
 * - **LWW semantics**: Overlap decomposition, progressive state changes
 *
 * Backends adapt these scenarios to their own legend formats.
 */

import type { SpatialIndex } from '@jim/spandex';
import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import * as r from '@jim/spandex/r';

/** A single step in a progressive rendering scenario */
export type ProgressionStep<T> = {
	/** Display name for this step */
	name: string;
	/** Action to perform on the index */
	action: (index: T) => void;
};

/** Progression scenario with factory and steps */
export type Progression<T> = {
	/** Factory to create a fresh index */
	factory: () => T;
	/** Steps to execute sequentially */
	steps: ProgressionStep<T>[];
};

/**
 * Create regression test scenarios for rendering backends.
 *
 * Returns scenario builders grouped by category. Each builder creates fresh indexes
 * to ensure test isolation.
 */
export function createRegressionScenarios() {
	return {
		originInclusion: () => {
			const index1 = createMortonLinearScanIndex<string>();
			index1.insert([5, 7, 6, 7], 'DATA');

			const index2 = createMortonLinearScanIndex<string>();
			index2.insert([5, 7, 6, 7], 'DATA');

			const index3 = createMortonLinearScanIndex<string>();
			index3.insert([-5, -3, -2, -1], 'DATA');

			return { index1, index2, index3 };
		},

		infinityEdges: () => {
			const top = createMortonLinearScanIndex<string>();
			top.insert([0, r.negInf, 0, 0], 'TOP');

			const right = createMortonLinearScanIndex<string>();
			right.insert([0, 0, r.posInf, 0], 'RIGHT');

			const bottom = createMortonLinearScanIndex<string>();
			bottom.insert([0, 0, 0, r.posInf], 'BOTTOM');

			const left = createMortonLinearScanIndex<string>();
			left.insert([r.negInf, 0, 0, 0], 'LEFT');

			return { top, right, bottom, left };
		},

		infinityCorners: () => {
			const topLeft = createMortonLinearScanIndex<string>();
			topLeft.insert([r.negInf, r.negInf, 2, 2], 'TOP-LEFT');

			const topRight = createMortonLinearScanIndex<string>();
			topRight.insert([0, r.negInf, r.posInf, 2], 'TOP-RIGHT');

			const bottomLeft = createMortonLinearScanIndex<string>();
			bottomLeft.insert([r.negInf, 0, 2, r.posInf], 'BOTTOM-LEFT');

			const bottomRight = createMortonLinearScanIndex<string>();
			bottomRight.insert([0, 0, r.posInf, r.posInf], 'BOTTOM-RIGHT');

			return { topLeft, topRight, bottomLeft, bottomRight };
		},

		infinityBands: () => {
			const horizontal = createMortonLinearScanIndex<string>();
			horizontal.insert([r.negInf, r.negInf, r.posInf, 2], 'HBAND');

			const vertical = createMortonLinearScanIndex<string>();
			vertical.insert([r.negInf, r.negInf, 2, r.posInf], 'VBAND');

			return { horizontal, vertical };
		},

		dataDensity: () => {
			const singleCell = createMortonLinearScanIndex<string>();
			singleCell.insert([1, 1, 1, 1], 'X');

			const sparse = createMortonLinearScanIndex<string>();
			sparse.insert([0, 0, 0, 0], 'A');
			sparse.insert([3, 3, 3, 3], 'B');
			sparse.insert([6, 6, 6, 6], 'C');

			const dense = createMortonLinearScanIndex<string>();
			for (let x = 0; x < 4; x++) {
				for (let y = 0; y < 4; y++) {
					dense.insert([x, y, x, y], 'D');
				}
			}

			return { singleCell, sparse, dense };
		},

		allInfinity: () => {
			const viewport = createMortonLinearScanIndex<string>();
			viewport.insert(r.ALL, 'EVERYWHERE');

			const absolute = createMortonLinearScanIndex<string>();
			absolute.insert(r.ALL, 'EVERYWHERE');

			return { viewport, absolute };
		},

		independentStates: () => {
			const index1 = createMortonLinearScanIndex<string>();
			index1.insert([0, 0, 1, 0], 'RED');

			const index2 = createMortonLinearScanIndex<string>();
			index2.insert([0, 0, 1, 0], 'BLUE');

			return { index1, index2 };
		},

		progressions: {
			/** Partitioned index with multiple attributes per cell */
			partitionedMultiple: <T extends { bg: string; fg: string }>(): Progression<
				ReturnType<typeof createLazyPartitionedIndex<T>>
			> => ({
				factory: () => createLazyPartitionedIndex<T>(createMortonLinearScanIndex),
				steps: [
					{ name: 'Add BG', action: (idx) => idx.set([0, 0, 2, 2], 'bg', 'BACK') },
					{ name: 'Add FG', action: (idx) => idx.set([1, 1, 3, 3], 'fg', 'FORE') },
					{ name: 'Override BG', action: (idx) => idx.set([1, 1, 2, 2], 'bg', 'DARK') },
				],
			}),

			/** Partitioned index with LWW semantics on same attribute */
			partitionedOverride: <T extends { color: string }>(): Progression<
				ReturnType<typeof createLazyPartitionedIndex<T>>
			> => ({
				factory: () => createLazyPartitionedIndex<T>(createMortonLinearScanIndex),
				steps: [
					{ name: 'Set RED', action: (idx) => idx.set([0, 0, 5, 0], 'color', 'RED') },
					{ name: 'Override BLUE', action: (idx) => idx.set([2, 0, 3, 0], 'color', 'BLUE') },
				],
			}),

			/** Cross formation showing LWW decomposition with infinity edges */
			crossFormation: (): Progression<SpatialIndex<string>> => ({
				factory: () => createMortonLinearScanIndex<string>(),
				steps: [
					{ name: 'Empty', action: () => {} },
					{ name: 'Add Horizontal', action: (idx) => idx.insert([r.negInf, 1, r.posInf, 1], 'H') },
					{ name: 'Add Vertical (LWW)', action: (idx) => idx.insert([1, r.negInf, 1, r.posInf], 'V') },
				],
			}),

			/** Global fill with local overrides */
			globalOverride: (): Progression<SpatialIndex<string>> => ({
				factory: () => createMortonLinearScanIndex<string>(),
				steps: [
					{ name: 'Global Fill', action: (idx) => idx.insert(r.ALL, 'GLOBAL') },
					{ name: 'Positive Local Wins', action: (idx) => idx.insert([2, 2, 2, 2], 'LOCAL+') },
					{ name: 'Negative Local Wins', action: (idx) => idx.insert([-2, -2, -2, -2], 'LOCAL-') },
				],
			}),

			/** Progressive overlap showing fragment decomposition */
			overlapDecomposition: (): Progression<SpatialIndex<string>> => ({
				factory: () => createMortonLinearScanIndex<string>(),
				steps: [
					{ name: 'Shape A', action: (idx) => idx.insert([0, 0, 2, 2], 'A') },
					{ name: 'Add B (decomposes A)', action: (idx) => idx.insert([1, 1, 3, 3], 'B') },
					{ name: 'Add C (further decomp)', action: (idx) => idx.insert([2, 0, 2, 3], 'C') },
				],
			}),

			/** Empty index state */
			empty: (): Progression<SpatialIndex<string>> => ({
				factory: () => createMortonLinearScanIndex<string>(),
				steps: [{ name: 'Empty', action: () => {} }],
			}),

			/** Two-state progression */
			twoState: (): Progression<SpatialIndex<string>> => ({
				factory: () => createMortonLinearScanIndex<string>(),
				steps: [
					{ name: 'After H', action: (idx) => idx.insert([r.negInf, 1, r.posInf, 1], 'HORIZONTAL') },
					{ name: 'After V', action: (idx) => idx.insert([1, r.negInf, 1, r.posInf], 'VERTICAL') },
				],
			}),

			/** Three-state progression with empty initial state */
			threeState: (): Progression<SpatialIndex<string>> => ({
				factory: () => createMortonLinearScanIndex<string>(),
				steps: [
					{ name: 'Empty', action: () => {} },
					{ name: 'After H', action: (idx) => idx.insert([r.negInf, 1, r.posInf, 1], 'HORIZONTAL') },
					{ name: 'After V', action: (idx) => idx.insert([1, r.negInf, 1, r.posInf], 'VERTICAL') },
				],
			}),

			/** Custom spacing between progression states */
			customSpacing: (): Progression<SpatialIndex<string>> => ({
				factory: () => createMortonLinearScanIndex<string>(),
				steps: [
					{ name: 'A', action: (idx) => idx.insert([0, 0, 0, 0], 'X') },
					{ name: 'B', action: (idx) => idx.insert([1, 0, 1, 0], 'Y') },
				],
			}),
		},
	};
}
