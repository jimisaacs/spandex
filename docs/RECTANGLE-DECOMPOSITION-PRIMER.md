# Rectangle Decomposition Primer

Three strategies for handling overlapping 2D rectangles.

## The Core Problem

When storing overlapping 2D rectangles, you must decide how to handle intersections. Three strategies exist with different trade-offs in insertion complexity, query complexity, and storage characteristics.

## Strategy Comparison

| Approach          | Insert  | Query  | Storage (example)           | Best for                   |
| ----------------- | ------- | ------ | --------------------------- | -------------------------- |
| **LWW**           | Simple  | Simple | 2 ranges                    | Single property only       |
| **Shallow Merge** | Complex | Simple | 4 ranges                    | Properties always together |
| **Spatial Join**  | Simple  | Join   | 3 ranges (across 2 indexes) | Independent properties     |

## Strategy Details

### 1. Last-Writer-Wins (LWW)

New values replace old values in overlaps.

- ✅ **Pro**: Simple inserts, minimal storage
- ❌ **Con**: Single value per coordinate
- 📖 **Read more**: [rectangle-decomposition-lww.md](./diagrams/rectangle-decomposition-lww.md)

**Use when**: Single property per cell.

### 2. Shallow Merge

Merge object properties in overlaps using spread operator.

- ✅ **Pro**: Multiple properties per coordinate
- ❌ **Con**: More complex inserts, more storage fragments
- 📖 **Read more**: [rectangle-decomposition-merge.md](./diagrams/rectangle-decomposition-merge.md)

**Use when**: Properties always updated together.

### 3. Spatial Join

Separate index per property, combine at query time.

- ✅ **Pro**: Simple inserts, independent property updates
- ❌ **Con**: Query-time join operation required
- 📖 **Read more**: [rectangle-decomposition-spatial-join.md](./diagrams/rectangle-decomposition-spatial-join.md)

**Use when**: Properties updated independently.

## Further Reading

Detailed strategy documentation: [LWW](./diagrams/rectangle-decomposition-lww.md), [Shallow Merge](./diagrams/rectangle-decomposition-merge.md), [Spatial Join](./diagrams/rectangle-decomposition-spatial-join.md)

**This library**: Implements LWW for single-property indexes. Multi-property use cases require Spatial Join pattern.

**Implementation guides**: [README](../README.md), [PRODUCTION-GUIDE](../PRODUCTION-GUIDE.md)

## Related Documentation

- **[RESEARCH-SUMMARY](./core/RESEARCH-SUMMARY.md)** - All research findings
- **[theoretical-foundation](./core/theoretical-foundation.md)** - Mathematical proofs and complexity analysis
- **[BENCHMARKS](../BENCHMARKS.md)** - Performance data for current implementations

**Academic basis**: Rectangle decomposition (Guttman, 1984 R-trees), spatial join (Brinkhoff et al., 1993).
