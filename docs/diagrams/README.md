# Visual Diagrams

ASCII diagrams explaining core concepts visually.

## Available Diagrams

### [rectangle-decomposition.md](./rectangle-decomposition.md)

**Concept**: Geometric set difference (A \ B → ≤4 fragments)

**Shows**:

- Step-by-step decomposition
- Last-writer-wins semantics
- Why decomposition vs alternatives

**Use**: Understanding the core algorithm

---

### [hilbert-curve.md](./hilbert-curve.md)

**Concept**: Space-filling curves and spatial locality

**Shows**:

- Order-2 and Order-3 Hilbert patterns
- How 2D → 1D mapping preserves locality
- Hilbert vs naive insertion order
- Why it provides 2x speedup

**Use**: Understanding spatial locality optimization in linear scan

---

### [coordinate-system.md](./coordinate-system.md)

**Concept**: Half-open intervals [start, end)

**Shows**:

- Visual examples of [0, 5) = 0,1,2,3,4
- Common mistakes and how to avoid them
- Why half-open vs closed intervals
- Conversion between notations

**Use**: Preventing coordinate system errors

---

### [rtree-structure.md](./rtree-structure.md)

**Concept**: Hierarchical spatial indexing

**Shows**:

- Tree organization (internal nodes + leaves)
- Query with spatial pruning
- R\* split algorithm
- Linear scan vs R-tree comparison

**Use**: Understanding when O(log n) beats O(n)

---

## Integration with Documentation

These diagrams complement the text documentation:

- **README.md** → Links to coordinate-system.md
- **theoretical-foundation.md** → Links to rectangle-decomposition.md
- **hilbert-curve-analysis.md** → Links to hilbert-curve.md
- **RESEARCH-SUMMARY.md** → Links to rtree-structure.md

## Design Philosophy

**Why ASCII diagrams?**

- Version control friendly (text diffs work)
- Accessible (no image rendering needed)
- Inline in documentation
- Easy to update

**Future**: Could add SVG/PNG versions for presentations, but ASCII ensures accessibility.
