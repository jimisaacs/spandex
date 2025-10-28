# Rectangle Decomposition Primer

Three strategies for handling overlapping 2D rectangles.

---

## The Core Problem

Imagine you're building a spreadsheet system. Users can:

- Color cells A1:C2 red
- Then color cells B0:D2 blue

**Question**: What happens to cells B1, C1, B2, C2 that are in BOTH ranges?

This is the **rectangle decomposition problem**.

---

## Three Strategies

### 1. Last-Writer-Wins (LWW)

**The simplest approach** - new values replace old values in overlaps.

- ✅ **Pro**: Simple inserts, minimal storage
- ❌ **Con**: Can only store one value per cell
- 📖 **Read more**: [rectangle-decomposition-lww.md](./diagrams/rectangle-decomposition-lww.md)

**Use when**: Single property per cell.

### 2. Shallow Merge

**Property combination** - merge object properties in overlaps using spread operator.

- ✅ **Pro**: Cells can have multiple properties (background AND font color)
- ❌ **Con**: More complex inserts, more storage fragments
- 📖 **Read more**: [rectangle-decomposition-merge.md](./diagrams/rectangle-decomposition-merge.md)

**Use when**: Properties always updated together.

### 3. Spatial Join

**Multiple simple indexes** - keep each property in its own index, combine at query time.

- ✅ **Pro**: Simple inserts (just LWW per index), properties updated independently
- ❌ **Con**: Slightly more complex queries (join operation)
- 📖 **Read more**: [rectangle-decomposition-spatial-join.md](./diagrams/rectangle-decomposition-spatial-join.md)

**Use when**: Properties updated independently.

---

## Quick Comparison

| Approach          | Insert  | Query  | Storage (example)           | Best for                   |
| ----------------- | ------- | ------ | --------------------------- | -------------------------- |
| **LWW**           | Simple  | Simple | 2 ranges                    | Single property only       |
| **Shallow Merge** | Complex | Simple | 4 ranges                    | Properties always together |
| **Spatial Join**  | Simple  | Join   | 3 ranges (across 2 indexes) | Independent properties     |

---

## Reading Path

**If you want to understand all three**:

1. Start with [Last-Writer-Wins](./diagrams/rectangle-decomposition-lww.md) - the foundation
2. Then [Shallow Merge](./diagrams/rectangle-decomposition-merge.md) - property combination
3. Finally [Spatial Join](./diagrams/rectangle-decomposition-spatial-join.md) - multiple indexes

**To use this library**:

- [README](../README.md) and [PRODUCTION-GUIDE](../PRODUCTION-GUIDE.md)
- LWW (Strategy #1) = single-property indexes
- Spatial Join (Strategy #3) = multi-property use cases

---

## Related Documentation

- **[RESEARCH-SUMMARY](./core/RESEARCH-SUMMARY.md)** - All research findings
- **[theoretical-foundation](./core/theoretical-foundation.md)** - Mathematical proofs and complexity analysis
- **[BENCHMARKS](../BENCHMARKS.md)** - Performance data for current implementations

---

**Academic basis**: Rectangle decomposition (Guttman, 1984 R-trees), spatial join (Brinkhoff et al., 1993).
