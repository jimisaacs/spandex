# R-Tree Structure Visualization

## What is an R-Tree?

A **hierarchical spatial index** that organizes rectangles in a tree structure where each node has a bounding box containing all its children.

## Simple R-Tree Example (M=4 entries per node)

```
                     ROOT
                 ┌──────────┐
                 │ [0,0,10,10] │ ← Bounding box of all data
                 └──────┬──────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
      ┌───┴───┐                   ┌───┴───┐
      │ [0,0,5,5] │                 │ [5,5,10,10] │ ← Internal nodes
      └───┬───┘                   └───┬───┘
          │                           │
   ┌──────┼──────┐             ┌──────┼──────┐
   │      │      │             │      │      │
┌──┴─┐ ┌─┴──┐ ┌─┴──┐       ┌──┴─┐ ┌─┴──┐ ┌─┴──┐
│ A  │ │ B  │ │ C  │       │ D  │ │ E  │ │ F  │ ← Leaf entries
└────┘ └────┘ └────┘       └────┘ └────┘ └────┘
```

**Key property**: Each internal node's bounding box fully contains all children's bounding boxes.

## Query Example: Find rectangles intersecting [2,2,4,4]

```
Query region: [2,2,4,4]

Step 1: Check ROOT [0,0,10,10]
        ✅ Intersects! Descend to children

Step 2: Check left child [0,0,5,5]
        ✅ Intersects! Descend to its children

Step 3: Check right child [5,5,10,10]  
        ❌ No intersection! PRUNE entire subtree (D,E,F skipped!)

Step 4: Check leaves A, B, C
        ✅ A [1,1,3,3] intersects
        ✅ B [2,2,4,4] intersects
        ❌ C [0,4,2,5] no intersection

Result: [A, B] returned

Nodes visited: 5 (ROOT, 2 internal, 2 leaves)
Nodes pruned: 4 (right subtree skipped!)

This is O(log n) vs O(n) for linear scan!
```

## R\* Split Algorithm (Production Implementation)

When a node overflows (> M entries), it must split:

```
BEFORE SPLIT (Node has 5 entries, M=4):
┌─────────────────────────────┐
│ Node: [0,0,10,10]           │
│ Entries: A, B, C, D, E (5!) │ ← TOO MANY!
└─────────────────────────────┘

R* SPLIT PROCESS:

1. Choose axis (minimize perimeter sum):
   X-axis perimeter: ...
   Y-axis perimeter: ...
   → Choose Y-axis

2. Sort entries by Y-coordinate

3. Choose split point (minimize overlap):
   Try all M-2m+2 distributions
   → Choose split with minimal overlap

AFTER SPLIT (2 nodes with ≤4 entries each):
┌──────────────┐  ┌──────────────┐
│ Node1:       │  │ Node2:       │
│ [0,0,5,10]   │  │ [5,0,10,10]  │
│ A, B, C      │  │ D, E         │
└──────────────┘  └──────────────┘

Result: Minimal overlap, balanced nodes, good query performance!
```

## Linear Scan vs R-Tree: Visual Comparison

### Linear Scan (Flat Array)

```
Query [2,2,4,4]:

Memory: [A][B][C][D][E][F] ← All in contiguous array

Check A ✅
Check B ✅
Check C ❌
Check D ❌
Check E ❌
Check F ❌

6 checks (O(n) where n=6)

Cache: All entries likely in cache (small n)
```

### R-Tree (Hierarchical)

```
Query [2,2,4,4]:

              [ROOT]
               /  \
           [L]    [R] ← R doesn't intersect, SKIP!
          / | \
        [A][B][C]

Check ROOT ✅ (descend)
Check L ✅ (descend)
Check R ❌ (PRUNE! Skip D,E,F)
Check A ✅
Check B ✅
Check C ❌

5 checks, but PRUNED 3!

For n=1000: Linear scan = 1000 checks, R-tree ≈ log(1000) = ~10 nodes!
```

## When Each Wins

```
n < 100 (Sparse):
┌────────────────┐
│  [A][B][C]...  │ ← Flat array in L1 cache
└────────────────┘
Linear scan: 100 checks @ 1ns = 100ns ✅ FASTER

    [ROOT]
     /  \
   ...  ... ← Tree overhead dominates
R-tree: Tree traversal + allocations = 200ns ❌ SLOWER

─────────────────────────────────────────────────────────────

n > 1000 (Large):
┌──────────────────────────────────────┐
│ [A][B][C]...[999][1000]              │ ← Too big for cache
└──────────────────────────────────────┘
Linear scan: 1000 checks = 10,000ns ❌ SLOW

          [ROOT]
         /   |   \
      [L]   [M]  [R] ← Spatial pruning!
      / \   / \   / \
    ...  ......  ...
R-tree: log(1000) ≈ 10 nodes = 500ns ✅ FASTER
```

## Google Sheets API Context

```typescript
// Google Sheets GridRange (half-open by design)
interface GridRange {
	startRowIndex?: number; // Inclusive
	endRowIndex?: number; // Exclusive!
	startColumnIndex?: number; // Inclusive
	endColumnIndex?: number; // Exclusive!
}

// Our library matches this exactly!
const index = new MortonLinearScanImpl<string>();
index.insert({
	startRowIndex: 0,
	endRowIndex: 5, // Means rows 0-4
}, 'value');
```

## Quick Reference Table

| Notation | start | end | Rows Included | Length |
| -------- | ----- | --- | ------------- | ------ |
| [0, 5)   | 0     | 5   | 0,1,2,3,4     | 5      |
| [3, 4)   | 3     | 4   | 3             | 1      |
| [5, 5)   | 5     | 5   | (empty)       | 0      |
| [0, 10)  | 0     | 10  | 0,1,...,9     | 10     |
| [a, b)   | a     | b   | a,...,b-1     | b - a  |

**Memory aid**: "The end number is NOT included - it's where you STOP counting"

---

**See Also**:

- [theoretical-foundation.md](../core/theoretical-foundation.md) - Mathematical model with formal notation
- [README.md](../../README.md#coordinate-system) - Quick visual examples
- Google Apps Script GridRange API documentation
