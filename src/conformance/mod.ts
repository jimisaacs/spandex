// Re-export everything for backward compatibility
export * from './ascii-snapshot-axioms.ts';
export * from './constants.ts';
export * from './cross-implementation.ts';
export * from './utils.ts';

// Main axiom tests (still in testsuite.ts for now)
export { assertInvariants, type TestConfig, testSpatialIndexAxioms } from './testsuite.ts';
