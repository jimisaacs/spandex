# Google Sheets Adapter Test Fixtures

Comprehensive fixtures for A1 notation and GridRange adapters.
Tests coordinate conversion correctness, boundary precision, and edge cases.

---

## Test: Single Cell Precision

**Purpose**: Verify single-cell ranges convert correctly (catches off-by-one errors)

**A1**: "B2" (single cell) → internal [1,1,1,1]\
**GridRange**: `{startRowIndex: 1, endRowIndex: 2, startColumnIndex: 1, endColumnIndex: 2}` → internal [1,1,1,1]

```ascii
    A   B   C   D  
  +---+---+---+---+
0 |   |   |   |   |
  +---+---+---+---+
1 |   | C |   |   |
  +---+---+---+---+
2 |   |   |   |   |
  +---+---+---+---+
3 |   |   |   |   |
  +---+---+---+---+

C = "CELL"
```

---

## Test: Boundary Touching Ranges

**Purpose**: Verify adjacent ranges don't overlap (half-open interval correctness)

**A1**: "A1:B2", "C1:D2", "A3:B4", "C3:D4" (touching but not overlapping)\
**GridRange**: Four 2×2 grids: `{0,2,0,2}`, `{0,2,2,4}`, `{2,4,0,2}`, `{2,4,2,4}`

```ascii
    A   B   C   D  
  +---+---+---+---+
0 | 1 | 1 | 2 | 2 |
  +---+---+---+---+
1 | 1 | 1 | 2 | 2 |
  +---+---+---+---+
2 | 3 | 3 | 4 | 4 |
  +---+---+---+---+
3 | 3 | 3 | 4 | 4 |
  +---+---+---+---+

1 = 1
2 = 2
3 = 3
4 = 4
```

---

## Test: Full Column Extent

**Purpose**: Test column-only ranges with infinite row extent

**A1**: "B:B", "D:E" (full columns)\
**GridRange**: `{startColumnIndex: 1, endColumnIndex: 2}`, `{startColumnIndex: 3, endColumnIndex: 5}`

```ascii
    A   B   C   D   E   F  
  +---+---+---+---+---+---+
0 |   | C |   | C | C |   |
  +---+---+---+---+---+---+
1 |   | C |   | C | C |   |
  +---+---+---+---+---+---+
2 |   | C |   | C | C |   |
  +---+---+---+---+---+---+
3 |   | C |   | C | C |   |
  +---+---+---+---+---+---+

C = "COL_B", "COL_DE"
```

---

## Test: Full Row Extent

**Purpose**: Test row-only ranges with infinite column extent

**A1**: "2:2", "4:5" (full rows)\
**GridRange**: `{startRowIndex: 1, endRowIndex: 2}`, `{startRowIndex: 3, endRowIndex: 5}`

```ascii
    A   B   C   D   E  
  +---+---+---+---+---+
0 |   |   |   |   |   |
  +---+---+---+---+---+
1 | R | R | R | R | R |
  +---+---+---+---+---+
2 |   |   |   |   |   |
  +---+---+---+---+---+
3 | R | R | R | R | R |
  +---+---+---+---+---+
4 | R | R | R | R | R |
  +---+---+---+---+---+

R = "ROW_2", "ROW_45"
```

---

## Test: Complex Fragmentation

**Purpose**: Test realistic scenario with multiple overlapping ranges (exposes decomposition bugs)

**A1**: "A1:E3" (base), "B2:D4" (overlap), "C3:F5" (second overlap)\
**GridRange**: `{0,3,0,5}` (base), `{1,4,1,4}` (overlap), `{2,5,2,6}` (second overlap)

```ascii
    A   B   C   D   E   F  
  +---+---+---+---+---+---+
0 | 1 | 1 | 1 | 1 | 1 |   |
  +---+---+---+---+---+---+
1 | 1 | 2 | 2 | 2 | 1 |   |
  +---+---+---+---+---+---+
2 | 1 | 2 | 3 | 3 | 3 | 3 |
  +---+---+---+---+---+---+
3 |   | 2 | 3 | 3 | 3 | 3 |
  +---+---+---+---+---+---+
4 |   |   | 3 | 3 | 3 | 3 |
  +---+---+---+---+---+---+

1 = "BASE"
2 = "OVERLAP1"
3 = "OVERLAP2"
```

---

## Test: Wide Column Range

**Purpose**: Test multi-column range (verifies endColumnIndex calculation)

**A1**: "C1:F8" (4 columns × 8 rows)\
**GridRange**: `{startRowIndex: 0, endRowIndex: 8, startColumnIndex: 2, endColumnIndex: 6}`

```ascii
    A   B   C   D   E   F   G  
  +---+---+---+---+---+---+---+
0 |   |   | W | W | W | W |   |
  +---+---+---+---+---+---+---+
1 |   |   | W | W | W | W |   |
  +---+---+---+---+---+---+---+
2 |   |   | W | W | W | W |   |
  +---+---+---+---+---+---+---+
3 |   |   | W | W | W | W |   |
  +---+---+---+---+---+---+---+
4 |   |   | W | W | W | W |   |
  +---+---+---+---+---+---+---+
5 |   |   | W | W | W | W |   |
  +---+---+---+---+---+---+---+
6 |   |   | W | W | W | W |   |
  +---+---+---+---+---+---+---+
7 |   |   | W | W | W | W |   |
  +---+---+---+---+---+---+---+

W = "WIDE"
```

---

## Test: Unbounded Columns

**Purpose**: Visualize infinite column extent (GridRange-only feature)

**GridRange**: `{startRowIndex: 2, endRowIndex: 5}` (rows 2-4, columns omitted = infinite)

Note: This represents rows 2-4 extending infinitely in both column directions. The viewport clips to [0,5]×[0,5].

```ascii
    A   B   C   D   E   F  
  +---+---+---+---+---+---+
0 |   |   |   |   |   |   |
  +---+---+---+---+---+---+
1 |   |   |   |   |   |   |
  +---+---+---+---+---+---+
2 | U | U | U | U | U | U |
  +---+---+---+---+---+---+
3 | U | U | U | U | U | U |
  +---+---+---+---+---+---+
4 | U | U | U | U | U | U |
  +---+---+---+---+---+---+
5 |   |   |   |   |   |   |
  +---+---+---+---+---+---+

U = "UNBOUND_COLS"
```

---

## Test: Unbounded Rows

**Purpose**: Visualize infinite row extent (GridRange-only feature)

**GridRange**: `{startColumnIndex: 1, endColumnIndex: 4}` (columns 1-3, rows omitted = infinite)

Note: This represents columns 1-3 extending infinitely in both row directions. The viewport clips to [0,5]×[0,5].

```ascii
    A   B   C   D   E   F  
  +---+---+---+---+---+---+
0 |   | U | U | U |   |   |
  +---+---+---+---+---+---+
1 |   | U | U | U |   |   |
  +---+---+---+---+---+---+
2 |   | U | U | U |   |   |
  +---+---+---+---+---+---+
3 |   | U | U | U |   |   |
  +---+---+---+---+---+---+
4 |   | U | U | U |   |   |
  +---+---+---+---+---+---+
5 |   | U | U | U |   |   |
  +---+---+---+---+---+---+

U = "UNBOUND_ROWS"
```

---

## Test: Unbounded Cross

**Purpose**: Visualize overlapping infinite extents (last-writer-wins with unbounded ranges)

**GridRange**:

1. `{startColumnIndex: 2, endColumnIndex: 3}` (full column 2, value "COL")
2. `{startRowIndex: 2, endRowIndex: 3}` (full row 2, value "ROW")

Note: Column 2 extends infinitely in rows, row 2 extends infinitely in columns. At intersection (2,2), last writer wins. Viewport clips to [0,4]×[0,4].

```ascii
    A   B   C   D   E  
  +---+---+---+---+---+
0 |   |   | C |   |   |
  +---+---+---+---+---+
1 |   |   | C |   |   |
  +---+---+---+---+---+
2 | R | R | R | R | R |
  +---+---+---+---+---+
3 |   |   | C |   |   |
  +---+---+---+---+---+
4 |   |   | C |   |   |
  +---+---+---+---+---+

C = "COL"
R = "ROW"
```

---

## Usage

These fixtures are parsed by `packages/@local/spandex-testing/src/ascii/fixtures.ts` and used by:

- `test/adapters/ai.test.ts` (A1 notation adapter)
- `test/adapters/gridrange.test.ts` (GridRange adapter)

### Coordinate Systems

**A1 Notation** (human-readable):

- Columns: A, B, C, ... (letters)
- Rows: 1, 2, 3, ... (1-indexed)
- Example: "A1:C3" = columns A-C, rows 1-3

**GridRange** (Google Sheets API):

- Half-open intervals: `[startIndex, endIndex)` where `endIndex` is exclusive
- Both rows and columns are 0-indexed
- Example: `{startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 3}` = 3×3 grid

**Internal Rectangle** (core library):

- Closed intervals: `[xmin, ymin, xmax, ymax]` where all bounds are inclusive
- Example: Both "A1:C3" and `{0,3,0,3}` → `[0, 0, 2, 2]`

**Conversion**:

- A1 row N → internal row N-1
- A1 column letter → internal column index (A=0, B=1, ...)
- GridRange endIndex N → internal max N-1
- Half-open `[start, end)` → closed `[start, end-1]`
