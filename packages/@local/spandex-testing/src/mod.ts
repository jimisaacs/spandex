/**
 * Spandex Testing Framework
 *
 * Test spatial indexes with ASCII snapshots and conformance axioms.
 *
 * Submodules:
 * - `/ascii` - Visual snapshot testing (render → compare → document)
 * - `/axioms` - Mathematical correctness (LWW, disjointness, fragments)
 *
 * ```typescript
 * import { testSpatialIndexAxioms, renderToAscii } from '@local/spandex-testing';
 * // or
 * import { renderToAscii } from '@local/spandex-testing/ascii';
 * import { testSpatialIndexAxioms } from '@local/spandex-testing/axioms';
 * ```
 */

// ASCII snapshot testing
export * from './ascii/mod.ts';

// Conformance axioms
export * from './axioms/mod.ts';

// Test utilities
export * from './utils.ts';
