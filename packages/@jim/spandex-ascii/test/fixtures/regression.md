# ASCII Rendering Examples

Every example below is rendered by `@jim/spandex-ascii` from a real index, and
regenerated whenever the renderer changes. They double as the package's
regression snapshots, so what you see here is exactly what the current code
produces.

Each one shows a short sequence of inserts and the resulting grid. Where a new
rectangle overlaps an existing one, the old region has decomposed into disjoint
fragments and the newer value has won the overlap. Rows are numbered from 1 and
columns are lettered from A.

## Example: Overlap Decomposition (fragments)

```ascii
    Shape A       Add B (decomposes A)   Add C (further decomp)

    A   B   C         A   B   C   D          A   B   C   D
  ┏━━━┳━━━┳━━━┓     ┏━━━┳━━━┳━━━┓   ·      ┏━━━┳━━━┳━━━┓   ·
1 ┃ A ┃ A ┃ A ┃   1 ┃ A ┃ A ┃ A ┃        1 ┃ A ┃ A ┃ C ┃
  ┣━━━╋━━━╋━━━┫     ┣━━━╋━━━╋━━━╋━━━┓      ┣━━━╋━━━╋━━━╋━━━┓
2 ┃ A ┃ A ┃ A ┃   2 ┃ A ┃ B ┃ B ┃ B ┃    2 ┃ A ┃ B ┃ C ┃ B ┃
  ┣━━━╋━━━╋━━━┫     ┣━━━╋━━━╋━━━╋━━━┫      ┣━━━╋━━━╋━━━╋━━━┫
3 ┃ A ┃ A ┃ A ┃   3 ┃ A ┃ B ┃ B ┃ B ┃    3 ┃ A ┃ B ┃ C ┃ B ┃
  ┗━━━┻━━━┻━━━┛     ┗━━━╋━━━╋━━━╋━━━┫      ┗━━━╋━━━╋━━━╋━━━┫
                  4     ┃ B ┃ B ┃ B ┃    4     ┃ B ┃ C ┃ B ┃
                    ·   ┗━━━┻━━━┻━━━┛      ·   ┗━━━┻━━━┻━━━┛

A = "A"
B = "B"
C = "C"
```

---

## Example: Cross Formation (LWW decomposition)

```ascii
 Empty    Add Horizontal   Add Vertical (LWW)

    ∅         ∞                ∞   B   ∞
  ·   ·     +───+            +───┓   ┏───+
∅         2   H            2   H ┃ V ┃ H
  ·   ·     +───+            +───┛   ┗───+

H = "H"
V = "V"
```

---

## Example: Data Density Variations

```ascii
Single Cell               Sparse                     Dense 4×4

    B             A   B   C   D   E   F   G         A   B   C   D
  ┏━━━┓         ┏━━━┓   ·   ·   ·   ·   ·   ·     ┏━━━┳━━━┳━━━┳━━━┓
2 ┃ X ┃       1 ┃ A ┃                           1 ┃ D ┃ D ┃ D ┃ D ┃
  ┗━━━┛         ┗━━━┛   ·   ·   ·   ·   ·   ·     ┣━━━╋━━━╋━━━╋━━━┫
              2                                 2 ┃ D ┃ D ┃ D ┃ D ┃
                ·   ·   ·   ·   ·   ·   ·   ·     ┣━━━╋━━━╋━━━╋━━━┫
              3                                 3 ┃ D ┃ D ┃ D ┃ D ┃
                ·   ·   ·   ┏━━━┓   ·   ·   ·     ┣━━━╋━━━╋━━━╋━━━┫
              4             ┃ B ┃               4 ┃ D ┃ D ┃ D ┃ D ┃
                ·   ·   ·   ┗━━━┛   ·   ·   ·     ┗━━━┻━━━┻━━━┻━━━┛
              5
                ·   ·   ·   ·   ·   ·   ·   ·
              6
                ·   ·   ·   ·   ·   ·   ┏━━━┓
              7                         ┃ C ┃
                ·   ·   ·   ·   ·   ·   ┗━━━┛

A = "A"
B = "B"
C = "C"
D = "D"
X = "X"
```

---

## Example: Partitioned Index - Multiple attributes

```ascii
    Add BG              Add FG              Override BG

    A   B   C         A   B   C   D         A   B   C   D
  ┏━━━┳━━━┳━━━┓     ┏━━━┳━━━┳━━━┓   ·     ┏━━━┳━━━┳━━━┓   ·
1 ┃ B ┃ B ┃ B ┃   1 ┃ B ┃ B ┃ B ┃       1 ┃ B ┃ B ┃ B ┃
  ┣━━━╋━━━╋━━━┫     ┣━━━╋━━━╋━━━╋━━━┓     ┣━━━╋━━━╋━━━╋━━━┓
2 ┃ B ┃ B ┃ B ┃   2 ┃ B ┃ X ┃ X ┃ F ┃   2 ┃ B ┃ D ┃ D ┃ F ┃
  ┣━━━╋━━━╋━━━┫     ┣━━━╋━━━╋━━━╋━━━┫     ┣━━━╋━━━╋━━━╋━━━┫
3 ┃ B ┃ B ┃ B ┃   3 ┃ B ┃ X ┃ X ┃ F ┃   3 ┃ B ┃ D ┃ D ┃ F ┃
  ┗━━━┻━━━┻━━━┛     ┗━━━╋━━━╋━━━╋━━━┫     ┗━━━╋━━━╋━━━╋━━━┫
                  4     ┃ F ┃ F ┃ F ┃   4     ┃ F ┃ F ┃ F ┃
                    ·   ┗━━━┻━━━┻━━━┛     ·   ┗━━━┻━━━┻━━━┛

B = { "bg": "BACK" }
D = { "bg": "DARK", "fg": "FORE" }
F = { "fg": "FORE" }
X = { "bg": "BACK", "fg": "FORE" }
```

---

## Example: Partitioned Index - Attribute override

```ascii
          Set RED                    Override BLUE

    A   B   C   D   E   F         A   B   C   D   E   F
  ┏━━━┳━━━┳━━━┳━━━┳━━━┳━━━┓     ┏━━━┳━━━┳━━━┳━━━┳━━━┳━━━┓
1 ┃ R ┃ R ┃ R ┃ R ┃ R ┃ R ┃   1 ┃ R ┃ R ┃ B ┃ B ┃ R ┃ R ┃
  ┗━━━┻━━━┻━━━┻━━━┻━━━┻━━━┛     ┗━━━┻━━━┻━━━┻━━━┻━━━┻━━━┛

B = { "color": "BLUE" }
R = { "color": "RED" }
```

---

## Example: Global Override Evolution

```ascii
Global Fill   Positive Local Wins         Negative Local Wins

    ∞             ∞   C   ∞              ∞  -B  -A   A   B   C   ∞
  ·   ·         ·   +   +   ·          ·   +   +   +   +   +   +   ·
∞   G         ∞   G │ G │ G          ∞   G │ G │ G │ G │ G │ G │ G
  ·   ·         +───╋━━━╋───+          +───╋━━━╋━━━╋━━━╋━━━╋━━━╋───+
              3   G ┃ + ┃ G         -2   G ┃ - ┃ G ┃ G ┃ G ┃ G ┃ G
                +───╋━━━╋───+          +───╋━━━╋━━━╋━━━╋━━━╋━━━╋───+
              ∞   G │ G │ G         -1   G ┃ G ┃ G ┃ G ┃ G ┃ G ┃ G
                ·   +   +   ·          +───╋━━━╋━━━╋━━━╋━━━╋━━━╋───+
                                     1   G ┃ G ┃ G ┃ G ┃ G ┃ G ┃ G
                                       +───╋━━━╋━━━╋━━━╋━━━╋━━━╋───+
                                     2   G ┃ G ┃ G ┃ G ┃ G ┃ G ┃ G
                                       +───╋━━━╋━━━╋━━━╋━━━╋━━━╋───+
                                     3   G ┃ G ┃ G ┃ G ┃ G ┃ + ┃ G
                                       +───╋━━━╋━━━╋━━━╋━━━╋━━━╋───+
                                     ∞   G │ G │ G │ G │ G │ G │ G
                                       ·   +   +   +   +   +   +   ·

- = "LOCAL-"
+ = "LOCAL+"
G = "GLOBAL"
```

---

## Example: Origin Excluded

```ascii
No Origin 1   No Origin 2       No Origin 3

    F   G         F   G         -E  -D  -C  -B
  ┏━━━┳━━━┓     ┏━━━┳━━━┓      ┏━━━┳━━━┳━━━┳━━━┓
8 ┃ D ┃ D ┃   8 ┃ D ┃ D ┃   -3 ┃ D ┃ D ┃ D ┃ D ┃
  ┗━━━┻━━━┛     ┗━━━┻━━━┛      ┣━━━╋━━━╋━━━╋━━━┫
                            -2 ┃ D ┃ D ┃ D ┃ D ┃
                               ┣━━━╋━━━╋━━━╋━━━┫
                            -1 ┃ D ┃ D ┃ D ┃ D ┃
                               ┗━━━┻━━━┻━━━┻━━━┛

D = "DATA"
```

---

## Example: Origin Included

```ascii
       Origin Included 1                 Origin Included 2               Origin Included 3

    A   B   C   D   E   F   G         A   B   C   D   E   F   G         -E  -D  -C  -B  -A   A
  *   ·   ·   ·   ·   ·   ·   ·     *   ·   ·   ·   ·   ·   ·   ·      ┏━━━┳━━━┳━━━┳━━━┓   ·   ·
1                                 1                                 -3 ┃ D ┃ D ┃ D ┃ D ┃
  ·   ·   ·   ·   ·   ·   ·   ·     ·   ·   ·   ·   ·   ·   ·   ·      ┣━━━╋━━━╋━━━╋━━━┫   ·   ·
2                                 2                                 -2 ┃ D ┃ D ┃ D ┃ D ┃
  ·   ·   ·   ·   ·   ·   ·   ·     ·   ·   ·   ·   ·   ·   ·   ·      ┣━━━╋━━━╋━━━╋━━━┫   ·   ·
3                                 3                                 -1 ┃ D ┃ D ┃ D ┃ D ┃
  ·   ·   ·   ·   ·   ·   ·   ·     ·   ·   ·   ·   ·   ·   ·   ·      ┗━━━┻━━━┻━━━┻━━━┛   *   ·
4                                 4                                  1
  ·   ·   ·   ·   ·   ·   ·   ·     ·   ·   ·   ·   ·   ·   ·   ·      ·   ·   ·   ·   ·   ·   ·
5                                 5
  ·   ·   ·   ·   ·   ·   ·   ·     ·   ·   ·   ·   ·   ·   ·   ·
6                                 6
  ·   ·   ·   ·   ·   ·   ·   ·     ·   ·   ·   ·   ·   ·   ·   ·
7                                 7
  ·   ·   ·   ·   ·   ┏━━━┳━━━┓     ·   ·   ·   ·   ·   ┏━━━┳━━━┓
8                     ┃ D ┃ D ┃   8                     ┃ D ┃ D ┃
  ·   ·   ·   ·   ·   ┗━━━┻━━━┛     ·   ·   ·   ·   ·   ┗━━━┻━━━┛

D = "DATA"
```

---

## Example: Infinity Edges (all directions)

```ascii
 Top ∞    Right ∞   Bottom ∞   Left ∞

    A         A         A          A
  +   +     ┏───+     ┏━━━┓      +───┓
1 │ T │   1 ┃ R     1 │ B │    1   L ┃
  ┗━━━┛     ┗───+     +   +      +───┛

B = "BOTTOM"
L = "LEFT"
R = "RIGHT"
T = "TOP"
```

---

## Example: Infinity Corners

```ascii
Top-Left   Top-Right   Bottom-Left   Bottom-Right

    C          A           C             A
  ·   +      +   ·       +───┓         ┏───+
3   1 │    3 │ 2       1   3 │       1 │ 4
  +───┛      ┗───+       ·   +         +   ·

1 = "TOP-LEFT"
2 = "TOP-RIGHT"
3 = "BOTTOM-LEFT"
4 = "BOTTOM-RIGHT"
```

---

## Example: Infinity Bands (3 edges)

```ascii
Horizontal Band   Vertical Band

    ∞                 C
  ·   ·             ·   +
3   H             ∞   V │
  +───+             ·   +

H = "HBAND"
V = "VBAND"
```

---

## Example: Empty Index

```ascii
 Empty

    ∅
  ·   ·
∅
  ·   ·
```

---

## Example: All Infinity (no finite data)

```ascii
Origin Excluded   Origin Included

    ∞                 ∞
  ·   ·             *   ·
∞   ∞             ∞   ∞
  ·   ·             ·   ·

∞ = "EVERYWHERE"
```

---

## Example: Two-state progression

```ascii
After H       After V

    ∞         ∞   B   ∞
  +───+     +───┓   ┏───+
2   H     2   H ┃ V ┃ H
  +───+     +───┛   ┗───+

H = "HORIZONTAL"
V = "VERTICAL"
```

---

## Example: Three-state progression with empty state

```ascii
 Empty    After H       After V

    ∅         ∞         ∞   B   ∞
  ·   ·     +───+     +───┓   ┏───+
∅         2   H     2   H ┃ V ┃ H
  ·   ·     +───+     +───┛   ┗───+

H = "HORIZONTAL"
V = "VERTICAL"
```

---

## Example: Custom spacing between grids

```ascii
   A             B

    A           A   B
  ┏━━━┓       ┏━━━┳━━━┓
1 ┃ X ┃     1 ┃ X ┃ Y ┃
  ┗━━━┛       ┗━━━┻━━━┛

X = "X"
Y = "Y"
```

---

## Example: Independent states (non-cumulative)

```ascii
  Index A         Index B

    A   B           A   B
  ┏━━━┳━━━┓       ┏━━━┳━━━┓
1 ┃ R ┃ R ┃     1 ┃ B ┃ B ┃
  ┗━━━┻━━━┛       ┗━━━┻━━━┛

B = "BLUE"
R = "RED"
```
