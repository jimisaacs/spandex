# Google Sheets Adapter Test Fixtures

This file contains ASCII-art test fixtures for Google Sheets adapter tests (A1 notation).

---

## Test: A1 Notation - Cell Range

**Purpose**: Test Google Sheets A1 notation with cell ranges (e.g., "A1:C3")

**Test**: Insert using A1 notation "A1:C3" → internal bounds [0,0,2,2]

```ascii
    A   B   C  
  +---+---+---+
0 | D | D | D |
  +---+---+---+
1 | D | D | D |
  +---+---+---+
2 | D | D | D |
  +---+---+---+

D = "DATA"
```

---

## Test: A1 Notation - Column Range

**Purpose**: Test Google Sheets A1 notation with column ranges (e.g., "B:D")

**Test**: Insert column range "B:D" (columns 1-3, all rows)

```ascii
    A   B   C   D   E  
  +---+---+---+---+---+
0 |   | C | C | C |   |
  +---+---+---+---+---+
1 |   | C | C | C |   |
  +---+---+---+---+---+
2 |   | C | C | C |   |
  +---+---+---+---+---+

C = "COLS"
```

---

## Test: A1 Notation - Row Range

**Purpose**: Test Google Sheets A1 notation with row ranges (e.g., "2:4")

**Test**: Insert row range "2:4" (rows 2-4 in A1 notation = internal rows 1-3)

```ascii
    A   B   C  
  +---+---+---+
0 |   |   |   |
  +---+---+---+
1 | R | R | R |
  +---+---+---+
2 | R | R | R |
  +---+---+---+
3 | R | R | R |
  +---+---+---+

R = "ROWS"
```

---

## Test: A1 Notation - Overlapping Ranges

**Purpose**: Test last-writer-wins with A1 notation (e.g., "A1:B2" then "B2:C3")

**Test**: 1. Insert "A1:B2" with value 1
2. Insert "B2:C3" with value 2 (overlaps at B2)
3. Value 2 wins at B2 (last-writer-wins)

```ascii
    A   B   C  
  +---+---+---+
0 | 1 | 1 |   |
  +---+---+---+
1 | 1 | 2 | 2 |
  +---+---+---+
2 |   | 2 | 2 |
  +---+---+---+

1 = 1
2 = 2
```

---

## Usage

These fixtures are parsed by `src/conformance/ascii-snapshot.ts` and used by adapter tests in `test/adapters.test.ts`.

### Coordinate System

**A1 Notation** (Google Sheets):

- Columns: A, B, C, ... (1-indexed in display, 0-indexed internally)
- Rows: 1, 2, 3, ... (1-indexed in display)
- Example: "A1:C3" = columns A-C, rows 1-3

**Internal Representation** (Rectangle):

- Uses 0-indexed closed intervals [xmin, ymin, xmax, ymax]
- Example: A1:C3 → [0, 0, 2, 2]

**Conversion**:

- A1 row N → internal row N-1
- A1 column letter → internal column index (A=0, B=1, C=2, ...)
- A1 range is half-open [start, end) → closed [start, end-1]
