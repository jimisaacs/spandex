# Rectangle Decomposition with Last-Writer-Wins

**What you'll learn**: How a spatial index handles overlapping rectangles when new values should replace old ones.

**Series**: Part 1 of 3

- **Part 1**: Last-Writer-Wins (this document) - The simplest case
- **Part 2**: Shallow Merge - Combining properties instead of replacing
- **Part 3**: Spatial Join - Using multiple indexes together

---

## The Problem

Imagine you're coloring cells in a spreadsheet. You color A1:C2 red, then you color B0:D2 blue. What happens to the cells that overlap (B1, C1, B2, C2)?

**With Last-Writer-Wins**: The blue overwrites the red. Simple!

Let's see how the spatial index makes this work...

---

## Step-by-Step Walkthrough

### Starting Point: Empty Grid

```
     A   B   C   D
   +---+---+---+---+
 0 |   |   |   |   |
   +---+---+---+---+
 1 |   |   |   |   |
   +---+---+---+---+
 2 |   |   |   |   |
   +---+---+---+---+
 3 |   |   |   |   |
   +---+---+---+---+

Storage: []
```

Nothing stored yet. Easy!

---

### Step 1: Color A1:C2 Red

**What we do**: `index.insert(A1:C2, 'RED')`

**What it means**: "Make cells A1, B1, C1, A2, B2, C2 all red"

**The result**:

```
     A   B   C   D
   +---+---+---+---+
 0 |   |   |   |   |
   +---+---+---+---+
 1 | R | R | R |   |  ← These cells are now red
   +---+---+---+---+
 2 | R | R | R |   |  ← These cells are now red
   +---+---+---+---+
 3 |   |   |   |   |
   +---+---+---+---+

Storage: [
  { range: A1:C2, color: 'RED' }
]

R = RED
```

Since nothing overlapped, we just store one rectangle. Simple!

---

### Step 2: Color B0:D2 Blue (The Interesting Part!)

**What we do**: `index.insert(B0:D2, 'BLUE')`

**What it means**: "Make cells B0, C0, D0, B1, C1, D1, B2, C2, D2 all blue"

**The question**: But wait - B1, C1, B2, C2 are already red! What happens?

**The overlap**:

```
     A   B   C   D
   +---+---+---+---+
 0 |   | B | B | B |  ← Only blue (no overlap)
   +---+---+---+---+
 1 | R |[?]|[?]| B |  ← B1 and C1: Were red, now blue?
   +---+---+---+---+
 2 | R |[?]|[?]| B |  ← B2 and C2: Were red, now blue?
   +---+---+---+---+
 3 |   |   |   |   |
   +---+---+---+---+

[?] = What color should these be?
```

---

### How Last-Writer-Wins Solves This

The spatial index uses a clever trick called **rectangle decomposition**:

**Step 1**: Find the overlap

- Old range A1:C2 overlaps with new range B0:D2
- The overlap region is B1:C2 (4 cells)

**Step 2**: Break the old range into pieces

- The old red range A1:C2 gets split into:
  - **Keep**: A1:A2 (the part that doesn't overlap) → stays RED
  - **Discard**: B1:C2 (the overlap region) → will be replaced

**Step 3**: Store the new range

- B0:D2 becomes BLUE (including the overlap region)

**The final result**:

```
     A   B   C   D
   +---+---+---+---+
 0 |   | B | B | B |  ← Blue (from new range)
   +---+---+---+---+
 1 | R | B | B | B |  ← A1 stayed red, B1:D1 became blue
   +---+---+---+---+
 2 | R | B | B | B |  ← A2 stayed red, B2:D2 became blue
   +---+---+---+---+
 3 |   |   |   |   |
   +---+---+---+---+

Storage: [
  { range: A1:A2, color: 'RED' },   // The leftover piece
  { range: B0:D2, color: 'BLUE' }   // The new range
]

R = RED
B = BLUE
```

---

## What Just Happened?

Think of it like cutting paper:

1. **Old rectangle** (A1:C2 in red) is lying on the table
2. **New rectangle** (B0:D2 in blue) comes in and overlaps it
3. We "cut out" the overlapping part from the old rectangle
4. What's left of the old rectangle (just A1:A2) stays red
5. The new blue rectangle covers where the overlap was

**Last-Writer-Wins** means: The newest value wins in the overlap region.

---

## Key Concepts

### Rectangle Decomposition

When rectangles overlap, we split the old one into **non-overlapping pieces**:

- ✅ Keep the pieces that don't overlap
- ❌ Discard the pieces that do overlap
- ➕ Add the new rectangle whole

In our example:

- Old: A1:C2 (one rectangle)
- After decomposition: A1:A2 (one smaller rectangle)
- Plus new: B0:D2 (one new rectangle)

### Why "Last-Writer-Wins"?

Because in the overlap region (B1:C2):

- First we wrote RED
- Then we wrote BLUE
- **Last writer (BLUE) wins!**

The cells remember the most recent value.

---

## Summary

**What we learned**:

1. Spatial indexes store non-overlapping rectangles
2. When ranges overlap, the old one gets "cut" into pieces
3. Last-Writer-Wins means the newest value replaces the old value in overlaps
4. The index keeps track of which cells have which values

**Complexity**:

- We stored 2 rectangles (not 10 individual cells!)
- Queries are fast: "What color is B1?" → Check which rectangle contains B1

**When to use this**:

- ✅ Cell values (replacing old data with new data)
- ✅ Anything where updates should overwrite completely

---

## What's Next?

**Part 2** (Shallow Merge): What if instead of replacing, we want to **combine** properties? Like having both a background color AND a font color on the same cell?

**Part 3** (Spatial Join): What if we want to keep background colors and font colors in **separate** indexes and combine them only when we need to?

Each approach has different tradeoffs - keep reading to learn when to use each one!
