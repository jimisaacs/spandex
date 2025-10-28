# GridRange Snapshot Tests

## Test: Single Cell Precision

```ascii
    B
  ┏━━━┓
2 ┃ C ┃
  ┗━━━┛

C = "CELL"
```

---

## Test: Boundary Touching Ranges

```ascii
    A   B   C   D
  ┏━━━┳━━━┳━━━┳━━━┓
1 ┃ 1 ┃ 1 ┃ 2 ┃ 2 ┃
  ┣━━━╋━━━╋━━━╋━━━┫
2 ┃ 1 ┃ 1 ┃ 2 ┃ 2 ┃
  ┣━━━╋━━━╋━━━╋━━━┫
3 ┃ 3 ┃ 3 ┃ 4 ┃ 4 ┃
  ┣━━━╋━━━╋━━━╋━━━┫
4 ┃ 3 ┃ 3 ┃ 4 ┃ 4 ┃
  ┗━━━┻━━━┻━━━┻━━━┛

1 = "quad-1"
2 = "quad-2"
3 = "quad-3"
4 = "quad-4"
```

---

## Test: Complex Fragmentation

```ascii
    A   B   C   D   E   F
  ┏━━━┳━━━┳━━━┳━━━┳━━━┓   ·
1 ┃ 1 ┃ 1 ┃ 1 ┃ 1 ┃ 1 ┃
  ┣━━━╋━━━╋━━━╋━━━╋━━━┫   ·
2 ┃ 1 ┃ 2 ┃ 2 ┃ 2 ┃ 1 ┃
  ┣━━━╋━━━╋━━━╋━━━╋━━━╋━━━┓
3 ┃ 1 ┃ 2 ┃ 3 ┃ 3 ┃ 3 ┃ 3 ┃
  ┗━━━╋━━━╋━━━╋━━━╋━━━╋━━━┫
4     ┃ 2 ┃ 3 ┃ 3 ┃ 3 ┃ 3 ┃
  ·   ┗━━━╋━━━╋━━━╋━━━╋━━━┫
5         ┃ 3 ┃ 3 ┃ 3 ┃ 3 ┃
  ·   ·   ┗━━━┻━━━┻━━━┻━━━┛

1 = "BASE"
2 = "OVERLAP1"
3 = "OVERLAP2"
```

---

## Test: Wide Column Range

```ascii
    C   D   E   F
  ┏━━━┳━━━┳━━━┳━━━┓
1 ┃ W ┃ W ┃ W ┃ W ┃
  ┣━━━╋━━━╋━━━╋━━━┫
2 ┃ W ┃ W ┃ W ┃ W ┃
  ┣━━━╋━━━╋━━━╋━━━┫
3 ┃ W ┃ W ┃ W ┃ W ┃
  ┣━━━╋━━━╋━━━╋━━━┫
4 ┃ W ┃ W ┃ W ┃ W ┃
  ┣━━━╋━━━╋━━━╋━━━┫
5 ┃ W ┃ W ┃ W ┃ W ┃
  ┣━━━╋━━━╋━━━╋━━━┫
6 ┃ W ┃ W ┃ W ┃ W ┃
  ┣━━━╋━━━╋━━━╋━━━┫
7 ┃ W ┃ W ┃ W ┃ W ┃
  ┣━━━╋━━━╋━━━╋━━━┫
8 ┃ W ┃ W ┃ W ┃ W ┃
  ┗━━━┻━━━┻━━━┻━━━┛

W = "WIDE"
```

---

## Test: Full Column Extent

```ascii
    B   C   D   E
  +   +   +   +   +
∞ │ C │   │ O │ O │
  +   +   +   +   +

C = "COL_B"
O = "COL_DE"

(∞ edges: top, bottom)
```

---

## Test: Full Row Extent

```ascii
    ∞
  +───+
2   R
  +───+
3
  +───+
4   O
  +───+
5   O
  +───+

O = "ROW_45"
R = "ROW_2"

(∞ edges: left, right)
```

---

## Test: Unbounded Columns

```ascii
    ∞
  +───+
3   U
  +───+
4   U
  +───+
5   U
  +───+

U = "UNBOUND_COLS"

(∞ edges: left, right)
```

---

## Test: Unbounded Rows

```ascii
    B   C   D
  +   +   +   +
∞ │ U │ U │ U │
  +   +   +   +

U = "UNBOUND_ROWS"

(∞ edges: top, bottom)
```

---

## Test: Unbounded Cross

```ascii
    C
  +   +
∞ │ C │
  ┗━━━┛
3   R
  ┏━━━┓
∞ │ C │
  +   +

C = "COL"
R = "ROW"

(∞ edges: left, top, right, bottom)
```
