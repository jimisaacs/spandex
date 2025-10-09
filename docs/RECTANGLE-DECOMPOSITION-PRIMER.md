# Rectangle Decomposition Primer

**What you'll learn**: The fundamental problem of overlapping ranges and three different strategies for handling them.

**Target audience**: Anyone wanting to understand how spatial indexes handle overlapping 2D rectangles.

---

## The Core Problem

Imagine you're building a spreadsheet system. Users can:

- Color cells A1:C2 red
- Then color cells B0:D2 blue

**Question**: What happens to cells B1, C1, B2, C2 that are in BOTH ranges?

This is the **rectangle decomposition problem** - how do you store overlapping ranges efficiently while maintaining correctness?

---

## Three Strategies

We explore three different approaches, each with different tradeoffs:

### 1. Last-Writer-Wins (LWW)

**The simplest approach** - new values replace old values in overlaps.

- ✅ **Pro**: Simple inserts, minimal storage
- ❌ **Con**: Can only store one value per cell
- 📖 **Read more**: [rectangle-decomposition-lww.md](./diagrams/rectangle-decomposition-lww.md)

**Use when**: You have a single property (like cell values where you don't want both formula AND value).

### 2. Shallow Merge

**Property combination** - merge object properties in overlaps using spread operator.

- ✅ **Pro**: Cells can have multiple properties (background AND font color)
- ❌ **Con**: More complex inserts, more storage fragments
- 📖 **Read more**: [rectangle-decomposition-merge.md](./diagrams/rectangle-decomposition-merge.md)

**Use when**: Properties are always updated together and you want them stored in one index.

### 3. Spatial Join

**Multiple simple indexes** - keep each property in its own index, combine at query time.

- ✅ **Pro**: Simple inserts (just LWW per index), properties updated independently
- ❌ **Con**: Slightly more complex queries (join operation)
- 📖 **Read more**: [rectangle-decomposition-spatial-join.md](./diagrams/rectangle-decomposition-spatial-join.md)

**Use when**: Properties are updated independently (user changes background separately from font) and inserts are more frequent than queries.

---

## Quick Comparison

| Approach          | Insert  | Query  | Storage (example)           | Best for                   |
| ----------------- | ------- | ------ | --------------------------- | -------------------------- |
| **LWW**           | Simple  | Simple | 2 ranges                    | Single property only       |
| **Shallow Merge** | Complex | Simple | 4 ranges                    | Properties always together |
| **Spatial Join**  | Simple  | Join   | 3 ranges (across 2 indexes) | Independent properties     |

---

## For Google Sheets Batch API

**Recommendation**: **Spatial Join** (Strategy #3)

Why?

1. Google Sheets API has separate request types per property (updateCells, repeatCell, updateBorders, etc.)
2. Users edit different properties at different times
3. Insert performance matters (batch operations) more than query performance (render once)
4. Each property naturally maps to its own spatial index

---

## Reading Path

**If you want to understand all three**:

1. Start with [Last-Writer-Wins](./diagrams/rectangle-decomposition-lww.md) - the foundation
2. Then [Shallow Merge](./diagrams/rectangle-decomposition-merge.md) - property combination
3. Finally [Spatial Join](./diagrams/rectangle-decomposition-spatial-join.md) - multiple indexes

**If you just want to use this library**:

- Read the [main README](../README.md) and [PRODUCTION-GUIDE](../PRODUCTION-GUIDE.md)
- The library currently implements **LWW** (Strategy #1)
- Spatial Join (Strategy #3) is the recommended next feature for multi-property use cases

---

## Related Documentation

- **[RESEARCH-SUMMARY](./core/RESEARCH-SUMMARY.md)** - All research findings
- **[theoretical-foundation](./core/theoretical-foundation.md)** - Mathematical proofs and complexity analysis
- **[BENCHMARKS](../BENCHMARKS.md)** - Performance data for current implementations

---

**Academic basis**: Rectangle decomposition is the foundation of R-trees (Guttman, 1984) and spatial databases. Spatial join is a standard operation in PostGIS, ArcGIS, and other GIS systems (Brinkhoff et al., 1993).
