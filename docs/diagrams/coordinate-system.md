# Interval Conversion at the Adapter Boundary

Spandex stores closed intervals. `[0, 0, 4, 4]` includes both endpoints, so it
covers five columns and five rows. Google Sheets `GridRange` uses half-open
intervals, where `endRowIndex: 5` stops before row 5 and covers four.

Neither notation is better, and you are not asked to pick one. The core uses
closed intervals because the geometry is simpler without `+1` and `-1`
corrections in every comparison. `GridRange` uses half-open intervals because
adjacent ranges then meet without overlapping. The adapter converts between them,
and it is the only place in the library where that conversion happens.

This page is about getting the conversion right, which means reading the
half-open side well enough to hand it correct input.

## Reading a Half-Open Range

`[start, end)` includes `start` and excludes `end`.

### Example 1: Simple Range

```
GridRange: { startRowIndex: 0, endRowIndex: 5 }

Means: [0, 5) = rows 0, 1, 2, 3, 4

Visual:
Row  Included?
 0   ✅ YES (>= start)
 1   ✅ YES
 2   ✅ YES
 3   ✅ YES
 4   ✅ YES
 5   ❌ NO  (>= end, excluded!)
 6   ❌ NO

Common mistake: Thinking row 5 is included!
```

### Example 2: Single Row

```
GridRange: { startRowIndex: 3, endRowIndex: 4 }

Means: [3, 4) = row 3 ONLY

Visual:
Row  Included?
 2   ❌ NO
 3   ✅ YES (only this one!)
 4   ❌ NO  (excluded)
 5   ❌ NO
```

### Example 3: Empty Range

```
GridRange: { startRowIndex: 5, endRowIndex: 5 }

Means: [5, 5) = EMPTY (zero rows!)

This is VALID! Empty ranges are allowed.

Visual:
Row  Included?
 4   ❌ NO
 5   ❌ NO  (start == end → empty!)
 6   ❌ NO
```

## Why the Two Notations Differ

Half-open ranges make adjacency free. `[0, 5)` and `[5, 10)` sit next to each
other with no gap and no overlap, and one number ends the first and starts the
second. Length is `end - start`, with nothing to remember. Array slices, Python's
`range`, and `GridRange` all work this way.

Closed intervals make geometry free, which is what the index does all day. Two
rectangles intersect when `aMin <= bMax && bMin <= aMax`, with no corrections. A
decomposition fragment that stops one cell short of its neighbour is `max - 1`,
and that arithmetic is the same whether the edge is finite or infinite. Half-open
storage would put a `+1` or a `-1` on nearly every comparison in the hot path,
and each one is somewhere to be off by one.

So the library keeps closed intervals inside and converts at the edge.

## Common Mistakes & How to Avoid

These are mistakes on the half-open side, which is the side you write when you
are talking to the Sheets API.

### Mistake 1: Including the End

```
❌ WRONG:
"I want rows 0 through 5"
→ endRowIndex: 5

Result: Gets rows 0-4 (missing row 5!)

✅ CORRECT:
"I want rows 0 through 5"
→ endRowIndex: 6 (one more than you want!)

Result: [0, 6) = rows 0-5 ✓
```

### Mistake 2: Off-by-One on Single Cell

```
❌ WRONG:
"I want cell A1 (row 0, col 0)"
→ { startRowIndex: 0, endRowIndex: 0 }

Result: [0, 0) = EMPTY!

✅ CORRECT:
"I want cell A1"
→ { startRowIndex: 0, endRowIndex: 1 }

Result: [0, 1) = row 0 only ✓
```

### Mistake 3: Assuming Inclusive

```
❌ WRONG thinking:
endRowIndex: 5 means "up to and including row 5"

Result: Confusion when row 5 isn't included!

✅ CORRECT thinking:
endRowIndex: 5 means "up to but NOT including row 5"
          = "stop BEFORE row 5"
          = "last row is 4"

Mnemonic: "end is where you STOP, not where you INCLUDE"
```

## 2D Example: Full Grid Range

```
GridRange:
{
    startRowIndex: 2,
    endRowIndex: 5,
    startColumnIndex: 1,
    endColumnIndex: 4
}

Means: [2, 5) × [1, 4)
     = rows 2,3,4 × columns 1,2,3

Visual Grid:
       col 0   col 1   col 2   col 3   col 4
row 0    ·       ·       ·       ·       ·
row 1    ·       ·       ·       ·       ·
row 2    ·       ✅      ✅      ✅      ·
row 3    ·       ✅      ✅      ✅      ·
row 4    ·       ✅      ✅      ✅      ·
row 5    ·       ·       ·       ·       ·

Covers 3 rows × 3 columns = 9 cells
```

## Converting Between Notations

You should not need to do this by hand. `createGridRangeAdapter` wraps an index
so that it takes and returns `GridRange` objects, and the two conversion
functions are exported if you need them directly.

```typescript
import { gridRangeToRectangle, rectangleToGridRange } from '@jim/spandex/adapter/gridrange';

gridRangeToRectangle({ startRowIndex: 0, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 10 });
// [0, 0, 9, 4]   — each end index loses one

rectangleToGridRange([0, 0, 9, 4]);
// { startColumnIndex: 0, startRowIndex: 0, endColumnIndex: 10, endRowIndex: 5 }
```

The start indices carry across unchanged. Each end index gains one going out and
loses one coming in, which is the whole of the conversion for a bounded range.

### Unbounded Edges

`GridRange` marks an unbounded edge by leaving the field out, and the index marks
it with an infinity. That is the part worth remembering, because an omitted field
does not mean zero.

```typescript
gridRangeToRectangle({ startRowIndex: 2 });
// [-Infinity, 2, Infinity, Infinity]  — an unbounded band from row 2 down

rectangleToGridRange([-Infinity, 2, Infinity, Infinity]);
// { startRowIndex: 2 }
```

Round-tripping is exact for any rectangle the adapter can produce. A finite
negative coordinate has no `GridRange` spelling, so it is refused rather than
written out as an omitted field that would read back as unbounded.

## Quick Reference

| Want                | GridRange Setting       | Result  |
| ------------------- | ----------------------- | ------- |
| Single cell (0,0)   | start: 0, end: 1        | [0, 1)  |
| Row 5 only          | startRow: 5, endRow: 6  | [5, 6)  |
| Rows 0-9 (10 rows)  | startRow: 0, endRow: 10 | [0, 10) |
| Entire column A (0) | startCol: 0, endCol: 1  | [0, 1)  |
| Empty range         | startRow: 5, endRow: 5  | [5, 5)  |
| Adjacent ranges     | [0,5) then [5,10)       | No gap! |

**Remember**: `end` is always "one past" what you want!

---

**See Also**:

- [theoretical-foundation.md](../core/theoretical-foundation.md) - Formal mathematical model
- Google Apps Script `GridRange` API documentation
