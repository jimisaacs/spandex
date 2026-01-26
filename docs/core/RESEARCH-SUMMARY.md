# Research Summary

**Problem**: Maintain non-overlapping 2D rectangles with last-writer-wins semantics\
**Solution**: Rectangle decomposition (A \ B → ≤4 fragments)\
**Target**: Pure JavaScript environments (browsers, Node.js, Deno, constrained runtimes like Google Apps Script)

## Production Recommendations

| n (size)    | Workload        | Use                     | Why                              |
| ----------- | --------------- | ----------------------- | -------------------------------- |
| **Any**     | Multi-attribute | LazyPartitioned wrapper | Independent attribute updates    |
| **< 100**   | All             | Morton spatial locality | O(n) ≈ O(1), faster via locality |
| **100-200** | Write-heavy     | Context-dependent       | See transition zone analysis     |
| **100-600** | High overlap    | Morton spatial locality | Decomposition cost dominates     |
| **> 200**   | Read-heavy      | R-tree (R* split)       | O(log n) query pruning wins      |
| **> 600**   | All             | R-tree (R* split)       | O(log n) hierarchical indexing   |

See [PRODUCTION-GUIDE](../../PRODUCTION-GUIDE.md) for implementation details.

## Key Findings

This section summarizes research outcomes. For detailed methodology and data, see individual analysis documents linked below.

### 1. Morton Curve Optimization (5-53% speedup, 25% average)

**Finding**: Morton curve (Z-order) via bit interleaving provides 25% average speedup over Hilbert curve at small n (range: 5-53% depending on scenario), while being simpler to implement.

**Impact**: Production algorithm for n<100. Constant-time encoding vs iterative Hilbert.

See [morton-vs-hilbert-analysis.md](../analyses/morton-vs-hilbert-analysis.md) for detailed comparison.

### 2. Linear Scan Wins for Sparse Data (n < 100)

**Finding**: O(n) linear scan with spatial locality is 5-10x faster than O(log n) R-trees for n < 100.

**Why**: Tree construction overhead (node allocation, bbox updates) exceeds traversal benefits at small scales.

**Impact**: Use Morton spatial locality for n<100, R-tree for n≥100. Crossover varies by workload (see transition zone analysis).

See [sparse-data-analysis.md](../analyses/sparse-data-analysis.md) for performance data.

### 3. R* Split Algorithm (Construction + Quality)

**Finding**: R* split (Beckmann 1990) is fastest for tree construction and provides best query performance on overlapping/large datasets.

**Performance**: 20-25x faster construction than Quadratic split, 30-35% faster queries on overlapping data vs Midpoint.

**Impact**: Production R-tree algorithm. Optimal balance of construction speed and tree quality.

See [r-star-analysis.md](../analyses/r-star-analysis.md) for split algorithm comparison.

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

**TypedArrays**: Only performance optimization compatible with constrained runtimes (Google Apps Script). WASM/WebGPU/SharedArrayBuffer unavailable.

**Implementation style**: Imperative + TypedArrays required for production (~14x faster than functional style with `.flatMap`/`.filter`).

**Bundle sizes**: Morton ~2.3KB, R-tree ~5.9KB, LazyPartitioned ~2.1KB (minified). Already optimal.

### 7. Comprehensive Testing (35 Benchmark Scenarios)

**Coverage**:

- **Algorithmic patterns**: Sequential, grid, overlapping, large datasets (n=500-5000)
- **User patterns**: Single cells, columns, rows, diagonal, striping, merge-like blocks
- **Workloads**: Write-heavy (80/20), query-only (10k queries), mixed

**Adversarial validation**: Pathological patterns (concentric, diagonal, checkerboard) validate O(n) fragmentation bound. Empirical k ≈ 2.3 overlaps per insert.

See [adversarial-patterns.md](../analyses/adversarial-patterns.md) and [benchmark-statistics.md](../analyses/benchmark-statistics.md).

### 8. Production Readiness (October 2025)

**Optimization study**: No further micro-optimizations viable (<10% impact threshold). Current performance is algorithmically determined.

**Test coverage**: Axiom-based conformance, ASCII snapshots, cross-implementation consistency, adversarial worst-case.

**Conclusion**: Implementations production-ready. Future gains require new algorithms, not micro-optimizations.

## Algorithms

**Linear Scan** (O(n)): Flat array with Morton spatial locality. Best for n<100 (2x faster via cache locality). Bundle: ~2.3KB.

**R-tree** (O(log n)): Hierarchical index with R* split (Beckmann 1990). Best for n≥100. Bundle: ~5.9KB.

See `packages/@jim/spandex/src/index/` for implementations.

## Methodology

**Benchmarks**: 35 scenarios (algorithmic patterns + user patterns + workloads), 5 runs, CV% <5%.

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

- **GridRange type** - Custom interface matching Google Sheets GridRange (minus sheetId) defined in `src/adapters/gridrange.ts`
- **Deno Standard Library** - TypeScript runtime and testing framework

---

**Result**: Algorithm choice depends on n and workload. Morton linear scan for n<100, R-tree for n≥100. See [PRODUCTION-GUIDE](../../PRODUCTION-GUIDE.md) for decision tree.
