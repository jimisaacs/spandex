# Corrected Transition Zone Experiment

**Status**: ✅ COMPLETED & ARCHIVED

**Hypothesis**: ArrayBufferLinearScanImpl vs RStarTreeImpl crossover occurs at n=200-800

**Result**: Hypothesis partially validated - crossover at n=100 for most scenarios, n=400 for overlapping write-heavy

**Research Question**: Where does the TRUE optimal implementation crossover from ArrayBufferLinearScan to RTree?

**Answer**: n=100 for most scenarios (read-heavy, mixed), but n=400 for overlapping write-heavy workloads

---

## Motivation

**Critical Discovery**: Previous transition zone analysis used **OptimizedLinearScanImpl**, which is 1.7x SLOWER than ArrayBufferLinearScanImpl

**Invalidated Results**: ALL crossover points (n=100-600) are WRONG

**Need**: Re-map transition zone with CORRECT linear scan implementation

---

## Hypothesis

ArrayBufferLinearScanImpl extends dominance further than OptimizedLinearScan:

**Expected crossover shifts**:

- Sequential: n>100 → n>200 (2x shift)
- Grid: n>100 → n>150
- Overlapping: n>600 → n>800

**Why**: ArrayBufferLinearScan is 1.7x faster, so it remains optimal longer.

---

## Methodology

### Head-to-Head: ArrayBufferLinearScan vs RTree (R*)

**Implementations**:

- ArrayBufferLinearScanImpl (TRUE sparse winner)
- RStarTreeImpl (R* split, TRUE large data winner)

**Data sizes**: 100, 150, 200, 300, 400, 500, 600, 700, 800, 1000

**Patterns**:

- Sequential
- Grid
- Overlapping

**Workloads**:

- Write-heavy
- Balanced (80/20 write/read)
- Read-heavy

**Total**: 2 implementations × 10 sizes × 3 patterns × 3 workloads = 180 scenarios

---

## Success Criteria

**Minimal Success**:

- Identify crossover point per pattern/workload
- Statistical stability

**Full Success**:

- Map complete transition zone (100-1000)
- Clear decision thresholds
- Update production recommendations

---

## Expected Outcomes

### Scenario A: Linear Crossover Shift (Most Likely)

**Result**: Crossover points shift proportionally to 1.7x speedup

- Sequential: n>200 (was n>100)
- Grid: n>150 (was n>100)
- Overlapping: n>800 (was n>600)

**Action**: Update transition zone analysis with corrected thresholds

### Scenario B: Non-Linear Shift

**Result**: Crossover shift varies by pattern (not uniform 1.7x)

**Action**: Map detailed transition matrix

### Scenario C: ArrayBuffer Dominates Further

**Result**: ArrayBuffer competitive even at n>1000

**Action**: Reconsider R-tree recommendation entirely

---

## Implementation Plan

1. Create `benchmarks/corrected-transition.ts`
2. Test ArrayBuffer vs RTree across 100-1000 range
3. Identify exact crossover points per scenario
4. Compare to previous (incorrect) transition zone
5. Update all affected documentation
6. Archive previous transition zone analysis as "INVALIDATED"
