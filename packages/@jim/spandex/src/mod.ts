/**
 * @module
 *
 * Core types for spatial indexing. Import implementations from subpaths:
 * - `@jim/spandex/index/mortonlinearscan`
 * - `@jim/spandex/index/rstartree`
 * - `@jim/spandex/index/lazypartitionedindex`
 */

// Core types only - implementations via subpath exports for tree-shaking
export type * from './types.ts';
