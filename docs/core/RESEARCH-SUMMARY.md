# Research Summary

**Problem**: Maintain non-overlapping 2D rectangles with last-writer-wins semantics\
**Solution**: Rectangle decomposition (A \ B → ≤4 fragments)\
**Target**: Pure JavaScript environments (browsers, Node.js, Deno, constrained runtimes like Google Apps Script)

## Production Recommendations

| n (size)    | Workload        | Use                     | Why                            |
| ----------- | --------------- | ----------------------- | ------------------------------ |
| **Any**     | Multi-attribute | LazyPartitioned wrapper | Independent attribute updates  |
| **< 100**   | Write-heavy     | Morton spatial locality | Lower per-insert overhead      |
| **< 100**   | Read-heavy      | R-tree (R* split)       | Query pruning already pays off |
| **100-200** | Write-heavy     | Context-dependent       | See transition zone analysis   |
| **100-600** | High overlap    | Morton spatial locality | Decomposition cost dominates   |
| **> 200**   | Read-heavy      | R-tree (R* split)       | O(log n) query pruning wins    |
| **> 600**   | All             | R-tree (R* split)       | O(log n) hierarchical indexing |

See [PRODUCTION-GUIDE](../../PRODUCTION-GUIDE.md) for implementation details.

## Key Findings

This section summarizes research outcomes. For detailed methodology and data, see individual analysis documents linked below.

### 1. Morton Curve Optimization (5-53% speedup, 25% average)

**Finding**: Morton curve (Z-order) via bit interleaving provides 25% average speedup over Hilbert curve at small n (range: 5-53% depending on scenario), while being simpler to implement.

**Impact**: Production algorithm for n<100. Constant-time encoding vs iterative Hilbert.

See [morton-vs-hilbert-analysis.md](../analyses/morton-vs-hilbert-analysis.md) for detailed comparison.

### 2. Linear Scan Wins Write-Heavy Sparse Data (n < 100)

**Finding**: on write-heavy sparse workloads below n=100, Morton linear scan runs
between 1.0x and 4.6x faster than the R-tree over five runs. The widest margin is
sparse-overlapping at n=40. On read-heavy sparse workloads the R-tree is already
ahead, by around 4x at n=20 and n=60.

**Likely mechanism**: tree construction work (node allocation, bounding-box
updates) that a flat array never pays. No experiment has separated this from the
other differences between the two implementations, so treat it as the proposed
explanation rather than a measured cause.

**Impact**: pick by workload, not by size alone, below n=100. Above it the
crossover varies (see transition zone analysis).

See [sparse-data-analysis.md](../analyses/sparse-data-analysis.md) for performance data.

### 3. R* Split Algorithm (Construction + Quality)

**Finding**: R* split (Beckmann 1990) is fastest for tree construction and provides best query performance on overlapping/large datasets.

**Performance**: the comparison was measured against Quadratic and Midpoint
splits, neither of which is still in the tree.

**Impact**: production R-tree algorithm. Fastest construction of the three, with
the best query performance on overlapping data.

See [r-star-analysis.md](../analyses/r-star-analysis.md) for the split comparison, including the scenarios, sizes, and run count behind those numbers.

### 4. Transition Zone Mapped (100 < n < 600)

**Finding**: Crossover point between linear scan and R-tree varies by workload:

- Read-heavy: R-tree wins at n > 100
- Write + low overlap: R-tree wins at n > 200
- Write + high overlap: Linear scan wins until n > 600

**Impact**: Concrete thresholds replace "workload-dependent" guidance.

See [transition-zone-analysis.md](../analyses/transition-zone-analysis.md) for 23-scenario benchmark matrix.

### 5. Failed Experiments

**FastRTree** (R* axis + midpoint split): 1.29x slower, rejected.\
**Bulk Insert API**: 1.01-1.39x slower due to LWW sequential dependency, rejected.\
**Learned Indexes**: Requires ML runtimes (TensorFlow/PyTorch), impractical for constrained environments.

See `archive/docs/experiments/` for full analyses.

### 6. Implementation Constraints

**Runtime constraints**: WASM, WebGPU, and `SharedArrayBuffer` are all unavailable
on the constrained targets, so every optimization has to work in plain
JavaScript.

**Implementation style**: imperative loops on the insert path rather than
`.flatMap` and `.filter` chains. TypedArray-backed storage was tried twice and
archived both times as slower; see
[IMPLEMENTATION-HISTORY](../../archive/IMPLEMENTATION-HISTORY.md).

**Bundle sizes**: measured on every regeneration with `deno bundle --minify` and
reported in [BENCHMARKS.md](../../BENCHMARKS.md).

### 7. Test Coverage (35 Benchmark Scenarios)

**Coverage**:

- **Algorithmic patterns**: Sequential, grid, overlapping, large datasets (n=500-5000)
- **User patterns**: Single cells, columns, rows, diagonal, striping, merge-like blocks
- **Workloads**: Write-heavy (80/20), query-only (10k queries), mixed

**Adversarial validation**: Pathological patterns (concentric, diagonal, checkerboard) validate O(n) fragmentation bound. Empirical k ≈ 2.3 overlaps per insert.

See [adversarial-patterns.md](../analyses/adversarial-patterns.md) and [benchmark-statistics.md](../analyses/benchmark-statistics.md).

### 8. Optimization Ceiling

**Optimization study**: no remaining micro-optimization cleared a 10% effect, so
current performance is set by the algorithms rather than by tuning.

**Conclusion**: what is still open is new algorithms, not further tuning of the
current three.

## Algorithms

**Linear Scan** (O(n)): flat array in Morton order. Best for write-heavy work
below n=100. The proposed mechanism is cache locality from that ordering, which
no experiment has isolated. Bundle: 3.0KB minified.

**R-tree** (O(log n)): hierarchical index with R* split (Beckmann 1990). Best for
read-heavy work at any size, and for everything above n=600. Bundle: 7.2KB
minified.

See `packages/@jim/spandex/src/index/` for implementations.

## Methodology

**Benchmarks**: 35 scenarios (algorithmic patterns, user patterns, workloads)
over 5 runs. Run-to-run variance on a shared machine is high enough that
[benchmark-statistics](../analyses/benchmark-statistics.md) marks the current
numbers unstable, so treat the rankings as indicative and re-run on idle
hardware before quoting a margin.

**Testing**: Axiom-based correctness (LWW semantics, disjointness, fragment bounds), adversarial worst-case validation (k ≈ 2.3 overlaps/insert), cross-implementation consistency.

**Reproduce**: `deno task bench:update` • `deno task test` • `deno task test:adversarial`

## Documentation Map

| Document                                                                | Purpose                                 |
| ----------------------------------------------------------------------- | --------------------------------------- |
| [GETTING-STARTED](../GETTING-STARTED.md)                                | Tutorial for new users                  |
| [PRODUCTION-GUIDE](../../PRODUCTION-GUIDE.md)                           | Algorithm selection guide               |
| [TROUBLESHOOTING](../TROUBLESHOOTING.md)                                | Common issues and solutions             |
| [theoretical-foundation](./theoretical-foundation.md)                   | Proofs, complexity analysis             |
| [morton-vs-hilbert-analysis](../analyses/morton-vs-hilbert-analysis.md) | Space-filling curve comparison          |
| [sparse-data-analysis](../analyses/sparse-data-analysis.md)             | Why O(n) wins for n<100                 |
| [transition-zone-analysis](../analyses/transition-zone-analysis.md)     | Crossover thresholds by workload        |
| [r-star-analysis](../analyses/r-star-analysis.md)                       | Split algorithm comparison              |
| [adversarial-patterns](../analyses/adversarial-patterns.md)             | Worst-case fragmentation validation     |
| [benchmark-statistics](../analyses/benchmark-statistics.md)             | Statistical methodology                 |
| [alternatives-analysis](../analyses/alternatives-analysis.md)           | Why not quadtrees/grids?                |
| `archive/docs/experiments/`                                             | Failed experiments (preserved learning) |

## References

### Academic Literature

- **Beckmann, N., Kriegel, H.-P., Schneider, R., & Seeger, B.** (1990). "The R*-tree: An Efficient and Robust Access Method for Points and Rectangles." _SIGMOD '90: Proceedings of the 1990 ACM SIGMOD International Conference on Management of Data_, pp. 322-331. DOI: [10.1145/93597.98741](https://doi.org/10.1145/93597.98741)

- **de Berg, M., Cheong, O., van Kreveld, M., & Overmars, M.** (2008). _Computational Geometry: Algorithms and Applications_ (3rd ed.). Springer-Verlag. ISBN: 978-3-540-77973-5 (Rectangle decomposition, geometric algorithms)

- **Guttman, A.** (1984). "R-trees: A Dynamic Index Structure for Spatial Searching." _SIGMOD '84: Proceedings of the 1984 ACM SIGMOD International Conference on Management of Data_, pp. 47-57. DOI: [10.1145/602259.602266](https://doi.org/10.1145/602259.602266)

- **Hilbert, D.** (1891). "Über die stetige Abbildung einer Linie auf ein Flächenstück." _Mathematische Annalen_, 38(3), pp. 459-460. DOI: [10.1007/BF01199431](https://doi.org/10.1007/BF01199431) (Space-filling curves)

- **Samet, H.** (1990). _The Design and Analysis of Spatial Data Structures_. Addison-Wesley. ISBN: 978-0-201-50255-9 (Comprehensive survey of spatial indexing)

- **Shapiro, M., Preguiça, N., Baquero, C., & Zawirski, M.** (2011). "Conflict-Free Replicated Data Types." In _Stabilization, Safety, and Security of Distributed Systems_, LNCS vol 6976, pp. 386-400. Springer. DOI: [10.1007/978-3-642-24550-3_29](https://doi.org/10.1007/978-3-642-24550-3_29) (Last-Writer-Wins conflict resolution)

### API Documentation

- **GridRange type** - Custom interface matching Google Sheets GridRange (minus sheetId) defined in `packages/@jim/spandex/src/adapter/gridrange.ts` and published as `@jim/spandex/adapter/gridrange`
- **Deno Standard Library** - TypeScript runtime and testing framework

---

**Result**: Algorithm choice depends on n and workload. Morton linear scan for n<100, R-tree for n≥100. See [PRODUCTION-GUIDE](../../PRODUCTION-GUIDE.md) for decision tree.
