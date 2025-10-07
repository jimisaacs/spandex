# Hilbert Curve Visualization

**Note**: This document explains the Hilbert curve educational concept. Our production implementation uses **Morton curves** (25% faster due to simpler encoding). Hilbert implementation is archived at `archive/src/implementations/superseded/hilbertlinearscan.ts`.

## What is a Hilbert Curve?

A **space-filling curve** that maps 2D coordinates to a 1D line while preserving spatial locality.

## Order-2 Hilbert Curve (4×4 grid)

```
Points visited in Hilbert order (0 → 15):

 0 ─ 1   14─ 15
     │    │
 3 ─ 2   13─ 12
 │            │
 4 ─ 7   8 ─ 11
     │   │
 5 ─ 6   9 ─ 10

Hilbert index:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
2D position:   (0,0)(1,0)(1,1)(0,1)(0,2)(0,3)(1,3)(1,2)(2,2)(2,3)(3,3)(3,2)(3,1)(2,1)(2,0)(3,0)
```

**Key property**: Points close in 2D (like (1,0) and (1,1)) have nearby Hilbert indices (1 and 2).

## Order-3 Hilbert Curve (8×8 grid)

```
 0 ─ 1  14─ 15  16─ 17  30─ 31
     │   │        │   │
 3 ─ 2  13─ 12  19─ 18  29─ 28
 │            │   │            │
 4 ─ 7   8 ─ 11  20─ 23  24─ 27
     │   │            │   │
 5 ─ 6   9 ─ 10  21─ 22  25─ 26
 │                            │
... (continues to fill 8×8 grid)

Pattern: Recursively subdivides into 4 quadrants, 
         rotating at each level to maintain continuity
```

## Why It Preserves Locality

```
Euclidean distance vs Hilbert distance:

Points A(1,1) and B(2,1):
- Euclidean distance: 1 unit apart
- Hilbert indices: 2 and 13
- Hilbert distance: 11 (far apart in 1D)

BUT on average:
- Points nearby in 2D → nearby Hilbert indices
- Hilbert curve minimizes "jumps"
- Better than row-major or column-major ordering!

Comparison for 8 neighbors of point (4,4):

Neighbors:        Hilbert Indices:
┌───┬───┬───┐    
│   │ ^ │   │    (3,5) → 20  (4,5) → 21  (5,5) → 22
├───┼───┼───┤    
│ < │ X │ > │    (3,4) → 7   (4,4) → 8   (5,4) → 23
├───┼───┼───┤    
│   │ v │   │    (3,3) → 6   (4,3) → 9   (5,3) → 10
└───┴───┴───┘    

Average index difference: ~2.5 (vs ~8 for row-major)
```

## How Space-Filling Curves Are Used (Morton/Hilbert)

```
Rectangle storage (sorted by space-filling curve index):

Index  Hilbert   Rectangle       Value
─────  ────────  ─────────────   ─────
  0      0002    [1,1,2,2]       "A"    ← Spatially close
  1      0003    [1,2,2,3]       "B"    ← (adjacent in memory)
  2      0007    [3,3,4,4]       "C"
  3      0008    [3,4,4,5]       "D"    ← Spatially close
  4      0014    [7,1,8,2]       "E"

When querying region [1,1,5,5]:
- Linear scan through array
- Entries 0,1,2,3 are LIKELY in same cache line!
- Hardware prefetcher loads next entries
- 2x speedup from cache locality
```

## Comparison: Hilbert vs Naive (Insertion Order)

```
NAIVE LINEAR SCAN (insertion order):
Memory: [A] → [A,B] → [A,B,C] → [A,B,C,D] → [A,B,C,D,E]
         │     │       │         │           │
      (1,1) (7,7)   (3,3)     (1,2)       (9,9)
         ↑     ↑       ↑         ↑           ↑
    RANDOM! Cache misses likely on query.

HILBERT LINEAR SCAN (Hilbert sorted):
Memory: [A,D,B,C,E]  ← Sorted by Hilbert index
         │  │  │  │  │
      (1,1)(1,2)(3,3)(3,4)(7,7)
         └─┬─┘  └─┬─┘   │
      ADJACENT! Cache hits likely on query.

Query [0,0,5,5]: Scan both, but Hilbert version loads
A,D,B,C together into cache (spatially clustered).
```

## Mathematical Foundation

**Hilbert curve properties** (Hilbert, 1891):

1. **Space-filling**: Visits every point in 2D grid exactly once
2. **Continuous**: No jumps (curve is connected)
3. **Locality-preserving**: d_Euclidean(p1, p2) small → d_Hilbert(p1, p2) small (on average)
4. **Recursive**: Order-n curve built from 4 Order-(n-1) curves with rotation

**Comparison with alternatives**:

- Row-major (x,y) → y×width + x: Poor locality for vertical patterns
- Column-major (x,y) → x×height + y: Poor locality for horizontal patterns
- **Morton (Z-order)**: ✅ Production - Constant-time encoding (bit interleaving), good locality, 25% faster than Hilbert
- **Hilbert**: Archived - Theoretically better locality but iterative encoding overhead (16 iterations) makes it slower in practice

## Implementation Notes

**Historical Hilbert implementation** (archived) used Order-16 (2^16 = 65,536 coordinates) via iterative encoding:

```typescript
for (let s = MAX_COORD / 2; s > 0; s >>= 1) {
	const rx = (x & s) > 0 ? 1 : 0;
	const ry = (y & s) > 0 ? 1 : 0;
	index += s * s * ((3 * rx) ^ ry);
	// Rotate quadrant for continuity
	if (ry === 0) { /* rotation logic */ }
}
```

**Current Morton implementation** (production) uses constant-time bit interleaving via magic masks:

```typescript
// Spread bits: 0b0000abcd → 0b0a0b0c0d
x = (x | (x << 8)) & 0x00FF00FF;
x = (x | (x << 4)) & 0x0F0F0F0F;
x = (x | (x << 2)) & 0x33333333;
x = (x | (x << 1)) & 0x55555555;
// Same for y, then interleave: x | (y << 1)
```

See:
- **Production**: `src/implementations/mortonlinearscan.ts`
- **Archived**: `archive/src/implementations/superseded/hilbertlinearscan.ts`
- **Analysis**: `docs/analyses/morton-vs-hilbert-analysis.md`

---

**References**:

- Hilbert, D. (1891). "Über die stetige Abbildung einer Linie auf ein Flächenstück." _Mathematische Annalen_, 38(3), pp. 459-460.
- Moon, B., Jagadish, H. V., Faloutsos, C., & Saltz, J. H. (2001). "Analysis of the Clustering Properties of the Hilbert Space-Filling Curve." _IEEE TKDE_, 13(1), pp. 124-141.
