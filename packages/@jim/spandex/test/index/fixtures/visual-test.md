# Implementation Visual Axioms

Automatically generated fixture file.

## Test: LWW Example

```ascii
    A   B   C   D
  ·   ┏━━━┳━━━┳━━━┓
1     ┃ B ┃ B ┃ B ┃
  ┏━━━╋━━━╋━━━╋━━━┫
2 ┃ R ┃ B ┃ B ┃ B ┃
  ┣━━━╋━━━╋━━━╋━━━┫
3 ┃ R ┃ B ┃ B ┃ B ┃
  ┗━━━┻━━━┻━━━┻━━━┛

B = "BLUE"
R = "RED"
```

---

## Test: Single Rectangle

```ascii
    B   C   D
  ┏━━━┳━━━┳━━━┓
2 ┃ T ┃ T ┃ T ┃
  ┣━━━╋━━━╋━━━┫
3 ┃ T ┃ T ┃ T ┃
  ┗━━━┻━━━┻━━━┛

T = "TEST"
```

---

## Test: Horizontal Stripes

```ascii
    A   B   C   D   E
  ┏━━━┓   ┏━━━┓   ┏━━━┓
1 ┃ A ┃   ┃ B ┃   ┃ C ┃
  ┣━━━┫   ┣━━━┫   ┣━━━┫
2 ┃ A ┃   ┃ B ┃   ┃ C ┃
  ┣━━━┫   ┣━━━┫   ┣━━━┫
3 ┃ A ┃   ┃ B ┃   ┃ C ┃
  ┣━━━┫   ┣━━━┫   ┣━━━┫
4 ┃ A ┃   ┃ B ┃   ┃ C ┃
  ┗━━━┛   ┗━━━┛   ┗━━━┛

A = "A"
B = "B"
C = "C"
```

---

## Test: Complex Fragmentation (numeric values)

```ascii
    A   B   C   D   E
  ┏━━━┳━━━┳━━━┳━━━┳━━━┓
1 ┃ B ┃ B ┃ B ┃ B ┃ B ┃
  ┣━━━╋━━━╋━━━╋━━━╋━━━┫
2 ┃ B ┃ B ┃ B ┃ B ┃ B ┃
  ┣━━━╋━━━╋━━━╋━━━╋━━━┫
3 ┃ B ┃ B ┃ C ┃ B ┃ B ┃
  ┣━━━╋━━━╋━━━╋━━━╋━━━┫
4 ┃ B ┃ B ┃ B ┃ O ┃ O ┃
  ┣━━━╋━━━╋━━━╋━━━╋━━━┫
5 ┃ B ┃ B ┃ B ┃ O ┃ O ┃
  ┗━━━┻━━━┻━━━┻━━━┻━━━┛

B = "BASE"
C = "CENTER"
O = "CORNER"
```

---

## Test: Diagonal Pattern (numeric values)

```ascii
    A   B   C   D   E
  ┏━━━┓   ·   ·   ·   ·
1 ┃ 1 ┃
  ┗━━━╋━━━┓   ·   ·   ·
2     ┃ 2 ┃
  ·   ┗━━━╋━━━┓   ·   ·
3         ┃ 3 ┃
  ·   ·   ┗━━━╋━━━┓   ·
4             ┃ 4 ┃
  ·   ·   ·   ┗━━━╋━━━┓
5                 ┃ 5 ┃
  ·   ·   ·   ·   ┗━━━┛

1 = "one"
2 = "two"
3 = "three"
4 = "four"
5 = "five"
```

---

## Test: Progressive Overlap (numeric values)

```ascii
    A   B   C   D   E
  ┏━━━┳━━━┳━━━┳━━━┓   ·
1 ┃ f ┃ f ┃ f ┃ f ┃
  ┣━━━╋━━━╋━━━╋━━━╋━━━┓
2 ┃ f ┃ f ┃ s ┃ s ┃ s ┃
  ┣━━━╋━━━╋━━━╋━━━╋━━━┫
3 ┃ f ┃ t ┃ t ┃ t ┃ s ┃
  ┗━━━╋━━━╋━━━╋━━━╋━━━┫
4     ┃ t ┃ t ┃ t ┃ s ┃
  ·   ┣━━━╋━━━╋━━━╋━━━┛
5     ┃ t ┃ t ┃ t ┃
  ·   ┗━━━┻━━━┻━━━┛   ·

f = "first"
s = "second"
t = "third"
```
