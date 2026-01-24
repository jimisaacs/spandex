# Interval Notation: Half-Open vs Closed

## What are Half-Open Intervals?

**Notation**: `[start, end)` where:

- `start` is **included** (closed bracket `[`)
- `end` is **excluded** (open parenthesis `)`)

## Visual Examples

### Example 1: Simple Range

```text
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
```text

### Example 2: Single Row

```text
GridRange: { startRowIndex: 3, endRowIndex: 4 }

Means: [3, 4) = row 3 ONLY

Visual:
Row  Included?
 2   ❌ NO
 3   ✅ YES (only this one!)
 4   ❌ NO  (excluded)
 5   ❌ NO
```text

### Example 3: Empty Range

```text
GridRange: { startRowIndex: 5, endRowIndex: 5 }

Means: [5, 5) = EMPTY (zero rows!)

This is VALID! Empty ranges are allowed.

Visual:
Row  Included?
 4   ❌ NO
 5   ❌ NO  (start == end → empty!)
 6   ❌ NO
```text

## Why Half-Open Intervals?

### 1. **Adjacent Ranges Don't Overlap**

```text
✅ Half-open:
Range A: [0, 5) = rows 0-4
Range B: [5, 10) = rows 5-9

        NO GAP, NO OVERLAP!

❌ Closed intervals:
Range A: [0, 4] = rows 0-4
Range B: [5, 9] = rows 5-9

        GAP at row 4.5? NO!

OR:

Range A: [0, 5] = rows 0-5
Range B: [5, 10] = rows 5-10

        OVERLAP at row 5! Ambiguous!
```text

### 2. **Range Length is Simple**

```text
✅ Half-open: length = end - start
   [0, 5) has length 5 - 0 = 5 ✓

❌ Closed: length = end - start + 1
   [0, 4] has length 4 - 0 + 1 = 5 (extra +1 is error-prone!)
```text

### 3. **Matches Programming Conventions**

```text
Array slicing:  arr[0:5] means indices 0-4
Python range:   range(0, 5) yields 0,1,2,3,4
Google Sheets:  GridRange uses half-open
Our library:    Matches the API!
```text

## Common Mistakes & How to Avoid

### Mistake 1: Including the End

```text
❌ WRONG:
"I want rows 0 through 5"
→ endRowIndex: 5

Result: Gets rows 0-4 (missing row 5!)

✅ CORRECT:
"I want rows 0 through 5"
→ endRowIndex: 6 (one more than you want!)

Result: [0, 6) = rows 0-5 ✓
```text

### Mistake 2: Off-by-One on Single Cell

```text
❌ WRONG:
"I want cell A1 (row 0, col 0)"
→ { startRowIndex: 0, endRowIndex: 0 }

Result: [0, 0) = EMPTY!

✅ CORRECT:
"I want cell A1"
→ { startRowIndex: 0, endRowIndex: 1 }

Result: [0, 1) = row 0 only ✓
```text

### Mistake 3: Assuming Inclusive

```text
❌ WRONG thinking:
endRowIndex: 5 means "up to and including row 5"

Result: Confusion when row 5 isn't included!

✅ CORRECT thinking:
endRowIndex: 5 means "up to but NOT including row 5"
          = "stop BEFORE row 5"
          = "last row is 4"

Mnemonic: "end is where you STOP, not where you INCLUDE"
```text

## 2D Example: Full Grid Range

```text
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
```text

## Converting Between Notations

### Half-Open → Inclusive (Internal Storage)

```typescript
// GridRange uses [start, end)
const gridRange = { startRowIndex: 0, endRowIndex: 5 };

// Convert to inclusive [min, max] for internal math
const inclusive = [
    gridRange.startRowIndex,      // 0 (same)
    gridRange.endRowIndex - 1     // 5-1 = 4 (subtract 1!)
];

Result: [0, 4] in inclusive notation
```text

### Inclusive → Half-Open (API Return)

```typescript
// Internal: [0, 4] inclusive
const inclusive = [0, 4];

// Convert to GridRange [start, end)
const gridRange = {
    startRowIndex: inclusive[0],      // 0 (same)
    endRowIndex: inclusive[1] + 1     // 4+1 = 5 (add 1!)
};

Result: [0, 5) in half-open notation
```text

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
