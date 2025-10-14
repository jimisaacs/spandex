# Related Work

Comparison of spatial indexing libraries and techniques for 2D range management.

---

## JavaScript/TypeScript Libraries

### RBush

**URL**: https://github.com/mourner/rbush

**Algorithm**: R-tree with OMT (Overlap Minimizing Top-down) split

**Trade-offs**:

- ✅ **Mature**: 10+ years, battle-tested in production (Leaflet, Mapbox)
- ✅ **Fast bulk loading**: STR (Sort-Tile-Recursive) packing for pre-sorted data
- ✅ **Small bundle**: ~2KB minified
- ❌ **No LWW semantics**: Designed for immutable spatial objects, not overlapping ranges
- ❌ **No decomposition**: Doesn't handle rectangle fragmentation on overlap
- ❌ **Generic spatial**: Optimized for points/rectangles in general, not spreadsheet-specific use case

**Use Case**: General-purpose 2D spatial queries (GIS, maps, collision detection)

**vs This Project**: RBush is for _finding_ overlapping objects. We're for _managing_ overlapping ranges with last-writer-wins conflict resolution and automatic fragmentation. Different problem domain.

---

### FlatBush

**URL**: https://github.com/mourner/flatbush

**Algorithm**: Static packed Hilbert R-tree

**Trade-offs**:

- ✅ **Extremely fast queries**: Pre-packed structure, cache-optimal
- ✅ **Tiny**: ~1KB minified, ArrayBuffer-based
- ✅ **Memory efficient**: Flat array storage, no object overhead
- ❌ **Static only**: Cannot insert/update after construction
- ❌ **No LWW**: Same as RBush, no overlap management

**Use Case**: Immutable spatial datasets (tile indices, static maps)

**vs This Project**: FlatBush is read-only. Spreadsheet ranges are dynamic (user edits constantly). Not applicable.

---

### kd-Bush

**URL**: https://github.com/mourner/kdbush

**Algorithm**: k-d tree for 2D points

**Trade-offs**:

- ✅ **Fast for points**: O(√n) range queries for point data
- ✅ **Simple**: Easier to understand than R-trees
- ❌ **Points only**: Doesn't handle rectangles/ranges
- ❌ **Worse for rectangles**: k-d trees struggle with extent queries

**Use Case**: Point clouds, marker clustering

**vs This Project**: k-d trees are for points. We need rectangles. Wrong data structure.

---

## Other Spatial Indexing Techniques

### Quadtree

**Algorithm**: Recursive 2D grid subdivision

**Trade-offs**:

- ✅ **Intuitive**: Easy to visualize and implement
- ✅ **Good for uniform data**: Works well when points/rectangles evenly distributed
- ❌ **Poor for sparse data**: Empty nodes waste memory
- ❌ **Depth explosion**: Skewed data creates deep trees (worst-case O(n) depth)
- ❌ **No overlap handling**: Still need LWW + decomposition logic on top

**vs This Project**: Tested in early research (not in archive). R-tree was faster and more space-efficient for realistic spreadsheet patterns.

---

### Grid/Hashmap

**Algorithm**: Divide space into fixed-size cells, hash ranges to cells

**Trade-offs**:

- ✅ **O(1) insertion**: Fast writes
- ✅ **Simple**: No tree balancing
- ❌ **Poor for large ranges**: Range spanning many cells → stored in many buckets
- ❌ **Grid size tuning**: Too coarse → long linear scan per cell. Too fine → memory waste
- ❌ **No overlap handling**: Still need LWW + decomposition

**vs This Project**: Grid approach works if you know the query pattern (e.g., always 10×10 viewport). Spreadsheets have arbitrary range sizes (1 cell to entire sheet). R-tree adapts dynamically.

---

### S2 Geometry

**URL**: https://s2geometry.io/

**Algorithm**: Hilbert curve mapping on sphere surface

**Trade-offs**:

- ✅ **Global scale**: Designed for Earth-scale geospatial data
- ✅ **Hilbert curve**: Spatial locality via space-filling curve (similar to our `HilbertLinearScan`)
- ❌ **Spherical geometry**: Overhead for flat 2D spreadsheet use case
- ❌ **C++ library**: No native TypeScript port, would need WASM
- ❌ **Overkill**: Designed for Google Maps, not spreadsheet cells

**vs This Project**: S2's Hilbert curve insight inspired our `HilbertLinearScan` implementation. But S2's spherical math is unnecessary for flat 2D grids.

---

## Academic Algorithms (Not Implemented)

### R+ tree

**Innovation**: Non-overlapping nodes (objects clipped at boundaries)

**Trade-offs**:

- ✅ **Better query performance**: No false positives
- ❌ **Slower inserts**: Object clipping adds overhead
- ❌ **Complex**: Harder to implement correctly

**Why not**: R* tree already achieves good query performance. R+ tree's complexity not worth marginal gains.

---

### Priority R-tree

**Innovation**: Prioritize important objects for faster access

**Trade-offs**:

- ✅ **Adaptive**: Can optimize for access patterns
- ❌ **Requires usage data**: Need to track object access frequency
- ❌ **Added complexity**: Priority tracking overhead

**Why not**: Spreadsheet ranges don't have predictable "importance" - all ranges equal priority.

---

## Key Differentiators of This Project

### 1. **Last-Writer-Wins Semantics**

Most spatial libraries assume **independent objects** (e.g., buildings on a map don't overwrite each other).

Spreadsheet ranges **conflict** - applying background color to A1:B2 then A2:C3 means A2:B2 gets the second color. This requires:

- Automatic rectangle decomposition (≤4 fragments per overlap)
- Maintaining insertion order
- Efficient fragmentation tracking

**No existing library handles this** - they'd need LWW logic built on top.

---

### 2. **Context-Dependent Optimization**

Research finding: **Best algorithm depends on n** (data size).

- **n < 100**: Linear scan wins (O(n) with low constant)
- **n > 1000**: R-tree wins (O(log n) amortizes overhead)

Libraries like RBush optimize for one use case. We provide **both**, with guidance on when to switch.

---

### 3. **Google Sheets Integration**

All implementations use Google Sheets `GridRange` type via custom adapter (`src/adapters/gridrange.ts`). Minimal conversion overhead (half-open ⟷ closed interval transformation).

Other libraries would need adapter layer to translate to/from their coordinate systems.

---

## When to Use Existing Libraries

**Use RBush if**:

- You need general-purpose 2D spatial queries
- Objects don't overlap (or overlaps don't matter)
- Mature, battle-tested library is required
- No LWW semantics needed

**Use FlatBush if**:

- Data is static (no inserts after construction)
- Query performance is critical
- Memory is tight

**Use this project if**:

- Managing overlapping ranges with LWW conflict resolution
- Spreadsheet-specific use case (GridRange types)
- Need both sparse (n<100) and large (n>1000) optimizations
- Want empirically validated performance across workloads

---

## References

- **RBush**: Agafonkin, V. (2015). "RBush - JavaScript R-tree-based 2D spatial index for points and rectangles." https://github.com/mourner/rbush
- **FlatBush**: Agafonkin, V. (2018). "FlatBush - Fast static spatial index for 2D points and rectangles." https://github.com/mourner/flatbush
- **S2 Geometry**: Google (2017). "S2 Geometry Library." https://s2geometry.io/
- R* Tree: Beckmann, N. et al. (1990). "The R*-tree: An Efficient and Robust Access Method." SIGMOD. DOI: [10.1145/93597.98741](https://doi.org/10.1145/93597.98741)
- **Quadtrees**: Samet, H. (1990). "The Design and Analysis of Spatial Data Structures." Addison-Wesley.

---

**See Also**:

- [RESEARCH-SUMMARY.md](../core/RESEARCH-SUMMARY.md) - Our empirical findings
- [alternatives-analysis.md](./alternatives-analysis.md) - Why not quadtrees, grids, B-trees?
