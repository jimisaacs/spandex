# Rectangle Decomposition with Spatial Join

**What you'll learn**: How to use multiple simple indexes (one per property) and combine them only when you need the full picture.

**Series**: Part 3 of 3

- **Part 1**: Last-Writer-Wins - The simplest case
- **Part 2**: Shallow Merge - Combining properties
- **Part 3**: Spatial Join (this document) - Using multiple indexes

---

## The Problem

In Part 2, we saw that Shallow Merge creates complexity - you have to store explicit overlap regions with combined properties. That's 4 rectangles instead of 2!

**Question**: What if we want cells to have multiple properties (background AND font color), but we don't want the merge complexity during inserts?

**With Spatial Join**: Keep background colors and font colors in SEPARATE simple indexes. Only combine them when you need to!

Let's see how this works...

---

## Step-by-Step Walkthrough

### Starting Point: Two Empty Indexes

Instead of one unified index, we create TWO separate indexes:

- **backgrounds index**: Stores only background colors (uses simple LWW)
- **fontColors index**: Stores only font colors (uses simple LWW)

Each index is independent and simple!

---

### Step 1: Set Background Colors (First Index)

**What we do**: `backgrounds.insert(A1:C2, 'RED')`

Then: `backgrounds.insert(B0:D2, 'GREEN')`

**What it means**: Same as Part 1 - just normal LWW in the backgrounds index!

**The result**:

```
     A   B   C   D
   +---+---+---+---+
 0 |   | G | G | G |
   +---+---+---+---+
 1 | R | G | G | G |  ← B1:C1 now GREEN (LWW)
   +---+---+---+---+
 2 | R | G | G | G |  ← B2:C2 now GREEN (LWW)
   +---+---+---+---+
 3 |   |   |   |   |
   +---+---+---+---+

Storage in backgrounds index: [
  { bounds: A1:A2, value: 'RED' },    // Left fragment
  { bounds: B0:D2, value: 'GREEN' }   // New range (LWW)
]

R = RED background
G = GREEN background
```

Notice: Just 2 ranges! Simple LWW decomposition, exactly like Part 1.

**No merge complexity** - the backgrounds index doesn't know or care about font colors!

---

### Step 2: Set Font Colors (Second Index)

**What we do**: `fontColors.insert(B1:D2, 'BLUE')`

**What it means**: Give cells B1, C1, D1, B2, C2, D2 blue font color - but store it in a DIFFERENT index!

**The result**:

```
     A   B   C   D
   +---+---+---+---+
 0 |   |   |   |   |
   +---+---+---+---+
 1 |   | B | B | B |
   +---+---+---+---+
 2 |   | B | B | B |
   +---+---+---+---+
 3 |   |   |   |   |
   +---+---+---+---+

Storage in fontColors index: [
  { bounds: B1:D2, value: 'BLUE' }
]

B = BLUE font color
```

Again, simple! Just 1 range in this index.

**Key insight**: We now have TWO simple indexes instead of ONE complex index!

- backgrounds index: 2 ranges (simple LWW)
- fontColors index: 1 range (simple LWW)
- **Total storage**: 3 ranges across 2 indexes

Compare to Shallow Merge (Part 2): 4 ranges in 1 unified index.

---

## The Magic: Spatial Join at Query Time

Now here's where it gets interesting! When you want to see what properties a cell has, you **combine the indexes on the fly**.

**The question**: What are the properties for cells in viewport A0:D3?

**Step 1**: Query each index separately

```typescript
const bgResults = backgrounds.query(A0:D3);
// Returns: [
//   { bounds: A1:A2, value: 'RED' },
//   { bounds: B0:D2, value: 'GREEN' }
// ]

const fontResults = fontColors.query(A0:D3);
// Returns: [
//   { bounds: B1:D2, value: 'BLUE' }
// ]
```

Easy! Each index just returns its own ranges.

**Step 2**: Spatial join - combine the results

Now we **find where the ranges overlap** and combine the properties:

```typescript
function spatialJoin(bgResults, fontResults) {
  // For each distinct region in the viewport, find which properties apply
  const joined = [];

  // Process all unique regions (areas where coverage changes)
  for each distinct region in union(bgResults, fontResults) {
    const bg = findCoveringRange(region, bgResults);
    const font = findCoveringRange(region, fontResults);

    joined.push({
      bounds: region,
      background: bg?.value,    // undefined if no background
      fontColor: font?.value    // undefined if no font color
    });
  }

  return joined;
}
```

Think of it like putting two transparency sheets on top of each other - you see both!

**Step 3**: The combined result

```
     A   B   C   D
   +---+---+---+---+
 0 |   | G | G | G |  ← { background: GREEN }
   +---+---+---+---+
 1 | R |R+B|R+B|G+B|  ← A1={ bg: RED }, B1:C1={ bg: GREEN, font: BLUE }, D1={ bg: GREEN, font: BLUE }
   +---+---+---+---+
 2 | R |R+B|R+B|G+B|  ← A2={ bg: RED }, B2:C2={ bg: GREEN, font: BLUE }, D2={ bg: GREEN, font: BLUE }
   +---+---+---+---+
 3 |   |   |   |   |
   +---+---+---+---+

Joined result: [
  { bounds: A1:A2, background: 'RED', fontColor: undefined },
  { bounds: B0:D0, background: 'GREEN', fontColor: undefined },
  { bounds: B1:C2, background: 'GREEN', fontColor: 'BLUE' },  ← Joined!
  { bounds: D1:D2, background: 'GREEN', fontColor: 'BLUE' }   ← Joined!
]

R = { background: RED }
G = { background: GREEN }
B = { fontColor: BLUE }
R+B = { background: RED, fontColor: BLUE } (from join, not storage!)
G+B = { background: GREEN, fontColor: BLUE } (from join, not storage!)
```

**Key insight**: Combined properties only exist in the query result, NOT in storage!

---

## What Just Happened?

Think of spatial join like organizing books:

**Shallow Merge approach** (Part 2):

- ONE bookshelf with books labeled "Red+Blue", "Red", "Blue"
- Every time you add a book, you might need to relabel existing books
- Complex to maintain, but easy to read

**Spatial Join approach** (Part 3):

- TWO bookshelves: "Background Colors" and "Font Colors"
- Adding books is simple - just put them on the right shelf
- When you need to find "what does B1 have?", you check BOTH shelves

**The tradeoff**:

- ✅ Simple inserts (just normal LWW in each index)
- ✅ Less total storage (3 ranges vs 4)
- ❌ Slightly more work at query time (check multiple indexes)

But here's the thing: In spreadsheets, you **insert operations OFTEN** (user edits) but **query RARELY** (only when rendering). So this tradeoff makes sense!

---

## Key Concepts

### Separate Indexes = Simple Inserts

Each property gets its own index:

- Background colors → backgrounds index
- Font colors → fontColors index
- Borders → borders index
- etc.

Each index uses simple LWW (exactly like Part 1!). No merge complexity!

### Spatial Join = Combining at Query Time

When you need to see cell properties:

1. Query each index independently
2. Find where the results overlap
3. Combine properties from all indexes for each region

The combination happens **during the query**, not during insert.

### The Tradeoff

**Compared to LWW** (Part 1):

- More indexes to manage
- Slightly more complex queries
- But you GET multiple properties per cell!

**Compared to Shallow Merge** (Part 2):

- Simpler inserts (just normal LWW)
- Less total storage (3 ranges vs 4)
- Slightly more work at query time (join operation)

### Why "Spatial" Join?

It's called **spatial** because we're joining based on **where things are in space** (which cells they cover), not on some ID or key field.

Academic term from spatial databases (like PostGIS for geographic data).

---

## Summary

**What we learned**:

1. Spatial join uses multiple simple indexes instead of one complex index
2. Each index stores one property type using simple LWW
3. Properties are combined at query time by finding overlaps
4. Simpler inserts, slightly more complex queries

**The tradeoff**:

- ✅ **Pro**: Simple inserts (no merge logic), less storage per index
- ✅ **Pro**: Properties updated independently (changing background doesn't touch font colors)
- ❌ **Con**: Query requires joining multiple indexes

**When to use this**:

- ✅ Multiple independent properties (background, font, borders)
- ✅ Properties updated separately (user changes background, later changes font)
- ✅ Inserts more frequent than queries (batch edits, render once)
- ✅ Google Sheets batch API (separate request types per property)

**Comparison table**:

| Approach                   | Insert  | Query  | Storage (example)           | Best for                   |
| -------------------------- | ------- | ------ | --------------------------- | -------------------------- |
| **LWW** (Part 1)           | Simple  | Simple | 2 ranges                    | Single property only       |
| **Shallow Merge** (Part 2) | Complex | Simple | 4 ranges                    | Properties always together |
| **Spatial Join** (Part 3)  | Simple  | Join   | 3 ranges (across 2 indexes) | Independent properties     |

---

## What's Next?

You've now seen all three approaches! Each has different tradeoffs:

- **Part 1 (LWW)**: Use when you only have one property (like cell values)
- **Part 2 (Shallow Merge)**: Use when properties are always updated together
- **Part 3 (Spatial Join)**: Use when properties are updated independently

For real-world spreadsheet systems (like Google Sheets), **Spatial Join** is often the best choice because:

- Users edit different properties at different times
- API has separate request types for each property
- Insert performance matters more than query performance

This is a standard technique in spatial databases and GIS systems!

```
```
