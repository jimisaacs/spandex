# Rectangle Decomposition Visual

## Basic Decomposition: A \ B → ≤4 Fragments

```text
┌─────────────────┐
│                 │
│        A        │
│                 │
│     ┌─────┐     │
│     │  B  │     │
│     └─────┘     │
│                 │
└─────────────────┘

After decomposition (A \ B):

┌─────────────────┐  ← Top fragment
│        A        │
├─────┬─────┬─────┤
│  A  │  ×  │  A  │  ← Left, Center removed, Right
└─────┴─────┴─────┘
│        A        │  ← Bottom fragment
└─────────────────┘

Result: 4 disjoint fragments (Top, Bottom, Left, Right)
```text

## Step-by-Step: Overlapping Insertions

```text
STEP 1: Insert Red [0,5) × [0,5)

┌─────┬─────┬─────┬─────┬─────┐
│ RED │ RED │ RED │ RED │ RED │  rows [0,1)
├─────┼─────┼─────┼─────┼─────┤
│ RED │ RED │ RED │ RED │ RED │  rows [1,2)
├─────┼─────┼─────┼─────┼─────┤
│ RED │ RED │ RED │ RED │ RED │  rows [2,3)
├─────┼─────┼─────┼─────┼─────┤
│ RED │ RED │ RED │ RED │ RED │  rows [3,4)
├─────┼─────┼─────┼─────┼─────┤
│ RED │ RED │ RED │ RED │ RED │  rows [4,5)
└─────┴─────┴─────┴─────┴─────┘
  0     1     2     3     4     (columns)

Result: 1 rectangle covering 25 cells

─────────────────────────────────────────────────────────────────────────────

STEP 2: Insert Blue [2,7) × [2,7) (OVERLAPS!)

Find overlap:
┌─────┬─────┬─────┬─────┬─────┐
│ RED │ RED │ RED │ RED │ RED │
├─────┼─────┼─────┼─────┼─────┤
│ RED │ RED │ RED │ RED │ RED │
├─────┼─────┼─────┼─────┼─────┤
│ RED │ RED │ ■ ■ │ ■ ■ │ RED │ ← Overlap region
├─────┼─────┼─────┼─────┼─────┤
│ RED │ RED │ ■ ■ │ ■ ■ │ RED │
├─────┼─────┼─────┼─────┼─────┤
│ RED │ RED │ ■ ■ │ ■ ■ │ RED │
└─────┴─────┴─────┴─────┴─────┘

Decompose Red:
- Red \ Blue = Top strip + Left strip
- Blue overwrites the 9-cell overlap

Final result:
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ RED │ RED │ RED │ RED │ RED │     │     │  ← Red top [0,2) × [0,5)
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ RED │ RED │BLUE │BLUE │BLUE │BLUE │BLUE │  ← Blue + Red left
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ RED │ RED │BLUE │BLUE │BLUE │BLUE │BLUE │  ← Blue row
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ RED │ RED │BLUE │BLUE │BLUE │BLUE │BLUE │  ← Blue row
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│     │     │BLUE │BLUE │BLUE │BLUE │BLUE │  ← Blue row
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│     │     │BLUE │BLUE │BLUE │BLUE │BLUE │  ← Blue row
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘
          └─ Red left [2,5) × [0,2)

Result: 3 non-overlapping rectangles
- Red top strip: 10 cells
- Red left strip: 6 cells
- Blue: 25 cells (overwrote 9 cells of red)
```text

## Geometric Set Difference: The Core Operation

```text
Given rectangles A and B that overlap:

A = [ax1, ay1, ax2, ay2] (inclusive coordinates)
B = [bx1, by1, bx2, by2]

Compute A \ B (A minus B):

              ay1
               ↓
         ┌─────────────┐ ax1
         │      T      │  ↑
         │             │
      ┌──┼──┐     ┌────┤
      │ L│ ×│  R  │    │
      └──┼──┘     └────┤
         │      B      │
         └─────────────┘ ax2
                        ↓
              ay2

T (Top):    [ax1, ay1, ax2, by1-1]  if ay1 < by1
B (Bottom): [ax1, by2+1, ax2, ay2]  if ay2 > by2
L (Left):   [ax1, max(ay1,by1), bx1-1, min(ay2,by2)]  if ax1 < bx1
R (Right):  [bx2+1, max(ay1,by1), ax2, min(ay2,by2)]  if ax2 > bx2

Note: × (center) is removed (B wins in LWW)
```text

## Last-Writer-Wins (LWW) Semantics

```text
Time →

t1: Insert A (value: "first")
    ┌─────────┐
    │    A    │
    │ "first" │
    └─────────┘

t2: Insert B (value: "second") - OVERLAPS!
    ┌─────────┐
    │    A    │
    └───┬─────┤
        │  B  │
        │"sec"│
        └─────┘

Result: Last writer wins!
    ┌───┐
    │ A │ ← Still "first"
    ├───┼─────┐
    │ A │  B  │ ← "second" overwrites overlap
    └───┴─────┘

Not layered! Not priority queue! DECOMPOSITION.
```text

## Why Decomposition vs Alternatives

| Approach                | API Match | Memory    | Query Time      | Problem                      |
| ----------------------- | --------- | --------- | --------------- | ---------------------------- |
| **Rectangle Decomp** ✅ | Perfect   | O(n)      | O(n) or O(logn) | None - optimal for this case |
| Priority Queue          | Poor      | O(cells)  | O(depth)        | Export expensive             |
| Layered (CSS-style)     | Poor      | O(layers) | O(layers)       | Needs merge on export        |
| Cell-by-cell Map        | Poor      | O(cells)  | O(1)            | Massive memory (10M cells!)  |

**Why decomposition wins**: API returns `GridRange[]` - we store exactly that format!
