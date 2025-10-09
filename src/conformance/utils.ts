/**
 * Utility functions for conformance testing
 */

import type { Rectangle } from '../types.ts';

/**
 * Simple seeded PRNG for deterministic tests
 * Uses Mulberry32 algorithm (fast, good distribution)
 */
export function seededRandom(seed: number): () => number {
	return () => {
		seed |= 0;
		seed = (seed + 0x6D2B79F5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export const randomRect = (maxDim = 20, seed = 42): Rectangle => {
	const random = seededRandom(seed);
	const xmin = Math.floor(random() * maxDim);
	const ymin = Math.floor(random() * maxDim);
	const xmax = xmin + Math.floor(random() * (maxDim - xmin));
	const ymax = ymin + Math.floor(random() * (maxDim - ymin));
	return [xmin, ymin, xmax, ymax];
};
