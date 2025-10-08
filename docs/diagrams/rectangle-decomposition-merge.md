# Rectangle Decomposition with Shallow Merge

**What you'll learn**: How to combine multiple properties (like background color AND font color) on the same cells when ranges overlap.

**Series**: Part 2 of 3

- **Part 1**: Last-Writer-Wins - The simplest case
- **Part 2**: Shallow Merge (this document) - Combining properties
- **Part 3**: Spatial Join - Using multiple indexes

---

## The Problem

In Part 1, we learned that Last-Writer-Wins replaces values in overlaps. But what if you want cells to have BOTH a background color AND a font color?

**Example**:

- First, make A1:C2 have a red background
- Then, make B0:D2 have blue font color
- **Question**: Should B1, C1, B2, C2 have BOTH red background AND blue font? Or just blue font?

**With Shallow Merge**: They get BOTH properties! Let's see how...

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

Same starting point as Part 1!

---

### Step 1: Set Background Color to Red

**What we do**: `index.insert(A1:C2, { background: 'RED' })`

**What it means**: "Give cells A1, B1, C1, A2, B2, C2 a red background"

**The result**:

```
     A   B   C   D
   +---+---+---+---+
 0 |   |   |   |   |
   +---+---+---+---+
 1 | R | R | R |   |  ← Red background
   +---+---+---+---+
 2 | R | R | R |   |  ← Red background
   +---+---+---+---+
 3 |   |   |   |   |
   +---+---+---+---+

Storage: [
  { range: A1:C2, properties: { background: 'RED' } }
]

R = { background: 'RED' }
```

Nothing new here - one rectangle with one property.

---

### Step 2: Set Font Color to Blue (Now It Gets Interesting!)

**What we do**: `index.insert(B0:D2, { fontColor: 'BLUE' })`

**What it means**: "Give cells B0, C0, D0, B1, C1, D1, B2, C2, D2 blue font color"

**The question**: B1, C1, B2, C2 already have red backgrounds. Do they:

- **Lose the red background** (like LWW)? OR
- **Keep red background AND add blue font**?

**With Shallow Merge, they get BOTH!**

**The overlap**:

```
     A   B   C   D
   +---+---+---+---+
 0 |   | B | B | B |  ← Only blue font (no background)
   +---+---+---+---+
 1 | R |[?]|[?]| B |  ← B1, C1: Should have BOTH red bg + blue font?
   +---+---+---+---+
 2 | R |[?]|[?]| B |  ← B2, C2: Should have BOTH red bg + blue font?
   +---+---+---+---+
 3 |   |   |   |   |
   +---+---+---+---+

[?] = The magic happens here!
```

---

### How Shallow Merge Works

Instead of replacing like LWW, Shallow Merge **combines** properties:

**Step 1**: Find the overlap (same as LWW)

- Old range A1:C2 overlaps with new range B0:D2
- Overlap region is B1:C2

**Step 2**: Merge the properties in the overlap

```javascript
existing = { background: 'RED' };
incoming = { fontColor: 'BLUE' };
merged = { ...existing, ...incoming }; // JavaScript spread operator
// Result: { background: 'RED', fontColor: 'BLUE' }
```

**Step 3**: Store THREE types of regions

- **Non-overlap (old)**: A1:A2 keeps `{ background: 'RED' }` only
- **Overlap (merged)**: B1:C2 gets `{ background: 'RED', fontColor: 'BLUE' }` ← Combined!
- **Non-overlap (new)**: B0:D0, D1:D2 get `{ fontColor: 'BLUE' }` only

**The final result**:

```
     A   B   C   D
   +---+---+---+---+
 0 |   | B | B | B |  ← { fontColor: BLUE }
   +---+---+---+---+
 1 | R |R+B|R+B| B |  ← A1={ bg:RED }, B1:C1={ bg:RED, font:BLUE }, D1={ font:BLUE }
   +---+---+---+---+
 2 | R |R+B|R+B| B |  ← A2={ bg:RED }, B2:C2={ bg:RED, font:BLUE }, D2={ font:BLUE }
   +---+---+---+---+
 3 |   |   |   |   |
   +---+---+---+---+

Storage: [
  { range: A1:A2, properties: { background: 'RED' } },
  { range: B1:C2, properties: { background: 'RED', fontColor: 'BLUE' } },  ← MERGED!
  { range: B0:D0, properties: { fontColor: 'BLUE' } },
  { range: D1:D2, properties: { fontColor: 'BLUE' } }
]

R = { background: 'RED' }
B = { fontColor: 'BLUE' }
R+B = { background: 'RED', fontColor: 'BLUE' } ← Both properties!
```

---

## What Just Happened?

Think of it like transparencies stacked on top of each other:

1. **First transparency** (A1:C2): Red background
2. **Second transparency** (B0:D2): Blue font color
3. **Where they overlap** (B1:C2): You see BOTH the red background AND the blue font

Unlike LWW (which throws away the first transparency), Shallow Merge **keeps both** and combines them!

---

## Key Concepts

### Property Combination vs Replacement

**LWW** (Part 1):

```javascript
old = 'RED'
new = 'BLUE'
result = new  // Just 'BLUE' (replaced)
```

**Shallow Merge** (Part 2):

```javascript
old = { background: 'RED' }
new = { fontColor: 'BLUE' }
result = { background: 'RED', fontColor: 'BLUE' }  // Combined!
```

### More Fragments = More Storage

Notice we stored **4 rectangles** instead of 2 (from Part 1):

- LWW: 2 rectangles (simpler)
- Shallow Merge: 4 rectangles (explicit overlap region)

The overlap region (B1:C2) is stored separately with its merged value.

### Why "Shallow"?

It only merges the **top level** properties:

```javascript
{ background: 'RED' } + { fontColor: 'BLUE' }
= { background: 'RED', fontColor: 'BLUE' }  ✅
```

It doesn't merge **nested** objects (that would be "deep merge"):

```javascript
{ style: { color: 'RED' } } + { style: { weight: 'bold' } }
= { style: { weight: 'bold' } }  // style.color lost!
```

For our spreadsheet use case, shallow is perfect because cell properties are flat.

---

## Summary

**What we learned**:

1. Shallow Merge combines properties from overlapping ranges
2. Cells in the overlap region get properties from BOTH operations
3. More storage is needed (4 rectangles vs 2), but we get richer data
4. Perfect for cell formatting where you want properties to accumulate

**The tradeoff**:

- ✅ **Pro**: Cells can have multiple properties (background AND font AND borders, etc.)
- ❌ **Con**: More complex inserts, more storage fragments

**When to use this**:

- ✅ Cell formatting (background, font, borders)
- ✅ Any case where properties should accumulate
- ❌ NOT for cell values (use LWW instead - you don't want formula AND value!)

---

## What's Next?

**Part 3** (Spatial Join): What if we don't want the complexity of Shallow Merge? What if we keep background colors and font colors in **separate, simple indexes** and only combine them when we render?

That's what Spatial Join does - simple inserts, slightly more complex queries. Let's see how it compares!
