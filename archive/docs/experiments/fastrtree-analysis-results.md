# FastRTree Benchmark Analysis

**Status**: ❌ REJECTED (Competitive but not adopted - full R\* chosen for production)

**Date**: 2025-10-04T22:42:25.726Z
**Runs**: 5
**Method**: Statistical analysis with mean ± stddev, CV%

## Hypothesis

Can R\* axis selection + midpoint split achieve better performance than:

1. Full R\* (slower construction, best tree quality)
2. Simple midpoint (fastest construction, worst tree quality)

## Results

### write: sparse-sequential (n=50)

```
Implementation          Mean (µs)    ±Stddev    CV%   Relative
----------------------------------------------------------------------
ArrayBufferLinearScan       21.7  ±    1.0    4.4   1.09x
ArrayBufferRTree            11.7  ±    0.5    4.0   0.59x
CompactLinearScan           10.4  ±    0.1    1.2   0.52x
CompactRTree                13.0  ±    0.3    2.3   0.66x
FastRTree                   18.1  ±    0.5    2.5   0.91x
LinearScan                  14.7  ±    0.3    2.3   0.74x
OptimizedLinearScan         11.5  ±    0.3    2.3   0.58x
RTree                       19.8  ±    0.4    2.1   (baseline)
```

### write: sparse-overlapping (n=40)

```
Implementation          Mean (µs)    ±Stddev    CV%   Relative
----------------------------------------------------------------------
ArrayBufferLinearScan       16.3  ±    1.0    5.8   0.23x
ArrayBufferRTree            47.8  ±    1.2    2.5   0.67x
CompactLinearScan           15.4  ±    0.2    1.6   0.21x
CompactRTree                68.0  ±    1.5    2.2   0.95x
FastRTree                   75.4  ±    1.9    2.5   1.05x
LinearScan                  18.3  ±    0.5    2.5   0.26x
OptimizedLinearScan         11.5  ±    0.3    2.4   0.16x
RTree                       71.7  ±    2.0    2.8   (baseline)
```

### write: large-sequential (n=2500)

```
Implementation          Mean (µs)    ±Stddev    CV%   Relative
----------------------------------------------------------------------
ArrayBufferLinearScan    30539.7  ±  267.4    0.9   15.14x
ArrayBufferRTree          1587.4  ±   32.4    2.0   0.79x
CompactLinearScan        43233.7  ±  192.5    0.4   21.44x
CompactRTree              1923.0  ±   43.7    2.3   0.95x
FastRTree                 1851.4  ±   40.5    2.2   0.92x
LinearScan               42047.3  ±  434.0    1.0   20.85x
OptimizedLinearScan      31291.4  ±  665.8    2.1   15.51x
RTree                     2016.9  ±   15.2    0.8   (baseline)
```

### write: large-overlapping (n=1250)

```
Implementation          Mean (µs)    ±Stddev    CV%   Relative
----------------------------------------------------------------------
ArrayBufferLinearScan     8410.9  ±  131.8    1.6   2.44x
ArrayBufferRTree          3407.8  ±   56.6    1.7   0.99x
CompactLinearScan        17130.2  ±  249.6    1.5   4.97x
CompactRTree             44566.2  ±  609.5    1.4   12.94x
FastRTree                 3800.8  ±  137.0    3.6   1.10x
LinearScan               15967.2  ±  147.9    0.9   4.64x
OptimizedLinearScan       9103.9  ±  153.8    1.7   2.64x
RTree                     3444.7  ±   24.2    0.7   (baseline)
```

## Conclusion

FastRTree vs RTree:

- Faster: 7/20 scenarios
- Average: 1.03x

FastRTree vs ArrayBufferRTree:

- Faster: 1/20 scenarios
- Average: 1.29x

**Verdict**: ✅ FastRTree is competitive with R\*

```
```
