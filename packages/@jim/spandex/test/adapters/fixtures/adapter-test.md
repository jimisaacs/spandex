# GridRange Snapshot Tests

## Test: Single Cell Precision

```ascii
    B  
  +---+
1 | C |
  +---+

C = "CELL"
```

---

## Test: Boundary Touching Ranges

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

1 = "quad-1"
2 = "quad-2"
3 = "quad-3"
4 = "quad-4"
```

---

## Test: Complex Fragmentation

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

```ascii
    C   D   E   F  
  +---+---+---+---+
0 | W | W | W | W |
  +---+---+---+---+
1 | W | W | W | W |
  +---+---+---+---+
2 | W | W | W | W |
  +---+---+---+---+
3 | W | W | W | W |
  +---+---+---+---+
4 | W | W | W | W |
  +---+---+---+---+
5 | W | W | W | W |
  +---+---+---+---+
6 | W | W | W | W |
  +---+---+---+---+
7 | W | W | W | W |
  +---+---+---+---+

W = "WIDE"
```

---

## Test: Full Column Extent

```ascii
    B   C   D   E  
  +   +   +   +   +
∞ | C |   | O | O |
  +---+---+---+---+
∞ | C |   | O | O |
  +   +   +   +   +

C = "COL_B"
O = "COL_DE"

(∞ edges: top, bottom)
```

---

## Test: Full Row Extent

```ascii
    ∞   ∞ 
  +---+---+
1   R | R 
  +---+---+
2     |   
  +---+---+
3   O | O 
  +---+---+
4   O | O 
  +---+---+

O = "ROW_45"
R = "ROW_2"

(∞ edges: left, right)
```

---

## Test: Unbounded Columns

```ascii
    ∞   ∞ 
  +---+---+
2   U | U 
  +---+---+
3   U | U 
  +---+---+
4   U | U 
  +---+---+

U = "UNBOUND_COLS"

(∞ edges: left, right)
```

---

## Test: Unbounded Rows

```ascii
    B   C   D  
  +   +   +   +
∞ | U | U | U |
  +---+---+---+
∞ | U | U | U |
  +   +   +   +

U = "UNBOUND_ROWS"

(∞ edges: top, bottom)
```

---

## Test: Unbounded Cross

```ascii
    ∞   C   ∞ 
  +   +   +   +
∞     | C |   
  +---+---+---+
1     | C |   
  +---+---+---+
2   R | R | R 
  +---+---+---+
3     | C |   
  +---+---+---+
∞     | C |   
  +   +   +   +

C = "COL"
R = "ROW"

(∞ edges: left, top, right, bottom)
```
