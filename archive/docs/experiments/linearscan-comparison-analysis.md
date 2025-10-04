# Linear Scan Championship Experiment

**Status**: ❌ HYPOTHESIS COMPLETELY REJECTED

**Hypothesis**: OptimizedLinearScanImpl is the fastest linear scan variant for sparse data (n < 100)

**Research Question**: Can any other linear scan implementation beat OptimizedLinearScanImpl?

**Result**: ArrayBufferLinearScanImpl wins ALL 45/45 scenarios (100%), 1.7x faster average

---

## Motivation

**Current claim**: "OptimizedLinearScanImpl is optimal for n < 100"

**Basis**: Previous benchmarks showed it 2-3x faster than R-trees at sparse sizes

**Gap**: Never directly compared ALL 4 linear scan implementations head-to-head

**Contenders**:

- LinearScanImpl: Reference implementation
- CompactLinearScanImpl: Minimal code size
- OptimizedLinearScanImpl: Current champion (V8-optimized)
- ArrayBufferLinearScanImpl: TypedArray-based

---

## Hypothesis

OptimizedLinearScanImpl wins across:

- All sparse sizes (n = 10, 25, 50, 75, 100)
- All patterns (sequential, grid, overlapping)
- All workloads (write-heavy, balanced, read-heavy)

**Why**: V8 optimizations (inline caching, monomorphic shapes) beat TypedArray overhead at small n

**Alternative outcome**: ArrayBufferLinearScanImpl might win at larger sparse sizes (n = 75-100) due to cache efficiency

---

## Methodology

### Sparse Data Head-to-Head

Test all 4 linear scan implementations:

**Data sizes**: 10, 25, 50, 75, 100 (sparse range)

**Patterns**:

- Sequential: Minimal overlap
- Grid: Medium overlap
- Overlapping: High overlap

**Workloads**:

- Write-heavy (construction + 50 queries)
- Balanced (construction + 250 queries)
- Read-heavy (construction + 1000 queries)

**Metrics**:

- Total time
- Winner per scenario
- Consistency check

### Success Criteria

**Minimal Success**:

- Clear winner identified
- Win margin > 10%

**Full Success**:

- ONE implementation wins >80% of scenarios
- Validates current recommendation OR replaces it

**Failure**:

- No consistent winner (need more analysis)
- ArrayBufferLinearScan wins (contradicts V8 optimization theory)

---

## Expected Outcomes

### Scenario A: OptimizedLinearScan Dominates (Most Likely)

**Result**: Wins 90%+ of scenarios

**Conclusion**: Current recommendation validated

**Action**: Keep OptimizedLinearScanImpl as production recommendation

### Scenario B: ArrayBufferLinearScan Wins at Larger n

**Result**: OptimizedLinearScan wins n < 50, ArrayBufferLinearScan wins n >= 50

**Conclusion**: Need size-specific recommendations even within sparse range

**Action**: Update guidance with crossover point

### Scenario C: Pattern-Dependent (Unlikely)

**Result**: Different winners for different patterns

**Conclusion**: Too complex, pick safe default

**Action**: Choose winner by most common pattern (grid/overlap)

---

## Implementation Plan

1. Create `benchmarks/linearscan-championship.ts`
2. Test 4 implementations × 5 sizes × 3 patterns × 3 workloads = 180 scenarios
3. Run benchmarks, collect data
4. Analyze: Which impl wins most scenarios?
5. Document findings
6. Update production recommendations
