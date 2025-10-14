# Regression - Round-trip Scenarios

## Test: Coordinate System Modes

```ascii
Viewport Mode

     F   G   
   +---+---+ 
10 | D | D | 
   +---+---+ 

D = "DATA"

---

         Absolute Mode          

     A   B   C   D   E   F   G  
   *---+---+---+---+---+---+---+
 0 |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+
 1 |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+
 2 |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+
 3 |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+
 4 |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+
 5 |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+
 6 |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+
 7 |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+
 8 |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+
 9 |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+
10 |   |   |   |   |   | D | D |
   +---+---+---+---+---+---+---+

D = "DATA"

---

      Negative Coords       

    -E  -D  -C  -B  -A   A  
   +---+---+---+---+---+---+
-3 | D | D | D | D |   |   |
   +---+---+---+---+---+---+
-2 | D | D | D | D |   |   |
   +---+---+---+---+---+---+
-1 | D | D | D | D |   |   |
   +---+---+---+---+---*---+
 0 |   |   |   |   |   |   |
   +---+---+---+---+---+---+

D = "DATA"
```

---

## Test: Infinity Edges (all directions)

```ascii
 Top ∞      Right ∞     Bottom ∞     Left ∞   

    A         A   ∞         A          ∞   A  
  +   +     +---+---+     +---+      +---+---+
∞ | T |   0 | R | R     0 | B |    0   L | L |
  +---+     +---+---+     +---+      +---+---+
0 | T |                 ∞ | B |               
  +---+                   +   +               

B = "BOTTOM"
L = "LEFT"
R = "RIGHT"
T = "TOP"
```

---

## Test: Infinity Corners

```ascii
 Top-Left      Top-Right    Bottom-Left   Bottom-Right

    ∞   C         A   ∞         ∞   C         A   ∞   
  +   +   +     +   +   +     +---+---+     +---+---+ 
∞   1 | 1 |   ∞ | 2 | 2     0   3 | 3 |   0 | 4 | 4   
  +---+---+     +---+---+     +---+---+     +---+---+ 
2   1 | 1 |   2 | 2 | 2     ∞   3 | 3 |   ∞ | 4 | 4   
  +---+---+     +---+---+     +   +   +     +   +   + 

1 = "TOP-LEFT"
2 = "TOP-RIGHT"
3 = "BOTTOM-LEFT"
4 = "BOTTOM-RIGHT"
```

---

## Test: Infinity Bands (3 edges)

```ascii
Horizontal Band   Vertical Band

    ∞   ∞             ∞   C    
  +   +   +         +   +   +  
∞   H | H         ∞   V | V |  
  +---+---+         +---+---+  
2   H | H         ∞   V | V |  
  +---+---+         +   +   +  

H = "HBAND"
V = "VBAND"
```

---

## Test: Data Density Variations

```ascii
Single Cell               Sparse                     Dense 4×4     

    B             A   B   C   D   E   F   G         A   B   C   D  
  +---+         +---+---+---+---+---+---+---+     +---+---+---+---+
1 | X |       0 | A |   |   |   |   |   |   |   0 | D | D | D | D |
  +---+         +---+---+---+---+---+---+---+     +---+---+---+---+
              1 |   |   |   |   |   |   |   |   1 | D | D | D | D |
                +---+---+---+---+---+---+---+     +---+---+---+---+
              2 |   |   |   |   |   |   |   |   2 | D | D | D | D |
                +---+---+---+---+---+---+---+     +---+---+---+---+
              3 |   |   |   | B |   |   |   |   3 | D | D | D | D |
                +---+---+---+---+---+---+---+     +---+---+---+---+
              4 |   |   |   |   |   |   |   |                      
                +---+---+---+---+---+---+---+                      
              5 |   |   |   |   |   |   |   |                      
                +---+---+---+---+---+---+---+                      
              6 |   |   |   |   |   |   | C |                      
                +---+---+---+---+---+---+---+                      

A = "A"
B = "B"
C = "C"
D = "D"
X = "X"
```

---

## Test: Cross Formation (LWW decomposition)

```ascii
 Empty    Add Horizontal     Add Vertical (LWW)   

    A         ∞   ∞            ∞   A   B   C   ∞  
  +---+     +---+---+        +   +   +   +   +   +
0 |   |   1   H | H        ∞     |   | V |   |    
  +---+     +---+---+        +---+---+---+---+---+
                           1   H | H | V | H | H  
                             +---+---+---+---+---+
                           ∞     |   | V |   |    
                             +   +   +   +   +   +

H = "H"
V = "V"
```

---

## Test: Global Override Evolution

```ascii
Global Fill   Positive Local Wins         Negative Local Wins       

    ∞             ∞   C   ∞              ∞  -B  -A   A   B   C   ∞  
  +   +         +   +   +   +          +   +   +   +   +   +   +   +
∞   G         ∞   G | G | G          ∞   G | G | G | G | G | G | G  
  +   +         +---+---+---+          +---+---+---+---+---+---+---+
              2   G | + | G         -2   G | - | G | G | G | G | G  
                +---+---+---+          +---+---+---+---+---+---+---+
              ∞   G | G | G         -1   G | G | G | G | G | G | G  
                +   +   +   +          +---+---+---+---+---+---+---+
                                     0   G | G | G | G | G | G | G  
                                       +---+---+---+---+---+---+---+
                                     1   G | G | G | G | G | G | G  
                                       +---+---+---+---+---+---+---+
                                     2   G | G | G | G | G | + | G  
                                       +---+---+---+---+---+---+---+
                                     ∞   G | G | G | G | G | G | G  
                                       +   +   +   +   +   +   +   +

- = "LOCAL-"
+ = "LOCAL+"
G = "GLOBAL"
```

---

## Test: Overlap Decomposition (fragments)

```ascii
    Shape A       Add B (decomposes A)   Add C (further decomp)

    A   B   C         A   B   C   D          A   B   C   D     
  +---+---+---+     +---+---+---+---+      +---+---+---+---+   
0 | A | A | A |   0 | A | A | A |   |    0 | A | A | C |   |   
  +---+---+---+     +---+---+---+---+      +---+---+---+---+   
1 | A | A | A |   1 | A | B | B | B |    1 | A | B | C | B |   
  +---+---+---+     +---+---+---+---+      +---+---+---+---+   
2 | A | A | A |   2 | A | B | B | B |    2 | A | B | C | B |   
  +---+---+---+     +---+---+---+---+      +---+---+---+---+   
                  3 |   | B | B | B |    3 |   | B | C | B |   
                    +---+---+---+---+      +---+---+---+---+   

A = "A"
B = "B"
C = "C"
```

---

## Test: Empty Index

```ascii
 Empty 

    A  
  +---+
0 |   |
  +---+
```

---

## Test: All Infinity (no finite data)

```ascii
Infinite Everywhere

    ∞              
  +   +            
∞   ∞              
  +   +            

∞ = "EVERYWHERE"
```

---

## Test: Two-state progression

```ascii
  After H             After V        

    ∞   ∞         ∞   A   B   C   ∞  
  +---+---+     +   +   +   +   +   +
1   H | H     ∞     |   | V |   |    
  +---+---+     +---+---+---+---+---+
              1   H | H | V | H | H  
                +---+---+---+---+---+
              ∞     |   | V |   |    
                +   +   +   +   +   +

H = "HORIZONTAL"
V = "VERTICAL"
```

---

## Test: Three-state progression with empty state

```ascii
 Empty      After H             After V        

    A         ∞   ∞         ∞   A   B   C   ∞  
  +---+     +---+---+     +   +   +   +   +   +
0 |   |   1   H | H     ∞     |   | V |   |    
  +---+     +---+---+     +---+---+---+---+---+
                        1   H | H | V | H | H  
                          +---+---+---+---+---+
                        ∞     |   | V |   |    
                          +   +   +   +   +   +

H = "HORIZONTAL"
V = "VERTICAL"
```

---

## Test: Custom spacing between grids

```ascii
   A             B     

    A           A   B  
  +---+       +---+---+
0 | X |     0 | X | Y |
  +---+       +---+---+

X = "X"
Y = "Y"
```

---

## Test: Independent states (non-cumulative)

```ascii
  Index A       Index B  

    A   B         A   B  
  +---+---+     +---+---+
0 | R | R |   0 | B | B |
  +---+---+     +---+---+

B = "BLUE"
R = "RED"
```
