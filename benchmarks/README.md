# Benchmarks

Latest benchmarks on an Intel Xeon Platinum 8370C show:

- 1024-point complex FFT: ~7.1 µs
- 4096-point complex FFT: ~28 µs
- 1,048,576-point real FFT: ~11 ms
- Spectrogram (65k samples, 1024 window) memory growth: ~0 MB

See [latest.json](latest.json) for full results.

## Detailed Results
<!-- BENCH_START -->
Last run: 2025-08-14T12:04:00.734481659+00:00 on local (Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz; rustc 1.87.0 (17067e9ac 2025-05-09); flags: ``)

| Library | Transform | Size (N) | Mode | Time/op | Ops/sec | Allocations | Date/Runner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| kofft | Complex | 1024 | Single | 0.081 ms | 12334.56 | 3 | 2025-08-14 local |
| kofft | Complex | 1024 | Parallel | 0.040 ms | 24846.57 | 3 | 2025-08-14 local |
| rustfft | Complex | 1024 | Single | 0.026 ms | 38292.17 | 1 | 2025-08-14 local |
| kofft | Real | 1024 | Single | 0.060 ms | 16627.59 | 4 | 2025-08-14 local |
| realfft | Real | 1024 | Single | 0.004 ms | 258933.20 | 0 | 2025-08-14 local |
| kofft | Complex | 2048 | Single | 0.075 ms | 13320.37 | 3 | 2025-08-14 local |
| kofft | Complex | 2048 | Parallel | 0.085 ms | 11782.59 | 3 | 2025-08-14 local |
| rustfft | Complex | 2048 | Single | 0.009 ms | 112917.80 | 1 | 2025-08-14 local |
| kofft | Real | 2048 | Single | 0.098 ms | 10237.41 | 4 | 2025-08-14 local |
| realfft | Real | 2048 | Single | 0.007 ms | 134102.19 | 0 | 2025-08-14 local |
| kofft | Complex | 4096 | Single | 1.046 ms | 955.65 | 3 | 2025-08-14 local |
| kofft | Complex | 4096 | Parallel | 2.799 ms | 357.33 | 4 | 2025-08-14 local |
| rustfft | Complex | 4096 | Single | 0.024 ms | 41382.16 | 1 | 2025-08-14 local |
| kofft | Real | 4096 | Single | 1.171 ms | 853.74 | 4 | 2025-08-14 local |
| realfft | Real | 4096 | Single | 0.015 ms | 64951.94 | 0 | 2025-08-14 local |
| kofft | Complex | 8192 | Single | 2.378 ms | 420.60 | 3 | 2025-08-14 local |
| kofft | Complex | 8192 | Parallel | 2.194 ms | 455.88 | 3 | 2025-08-14 local |
| rustfft | Complex | 8192 | Single | 0.036 ms | 28052.85 | 1 | 2025-08-14 local |
| kofft | Real | 8192 | Single | 1.225 ms | 816.26 | 4 | 2025-08-14 local |
| realfft | Real | 8192 | Single | 0.031 ms | 32217.53 | 0 | 2025-08-14 local |
| kofft | Complex | 16384 | Single | 3.120 ms | 320.51 | 3 | 2025-08-14 local |
| kofft | Complex | 16384 | Parallel | 3.706 ms | 269.86 | 3 | 2025-08-14 local |
| rustfft | Complex | 16384 | Single | 0.049 ms | 20264.66 | 1 | 2025-08-14 local |
| kofft | Real | 16384 | Single | 2.298 ms | 435.16 | 4 | 2025-08-14 local |
| realfft | Real | 16384 | Single | 0.027 ms | 36964.48 | 0 | 2025-08-14 local |
| kofft | Complex | 32768 | Single | 3.654 ms | 273.68 | 3 | 2025-08-14 local |
| kofft | Complex | 32768 | Parallel | 4.138 ms | 241.63 | 3 | 2025-08-14 local |
| rustfft | Complex | 32768 | Single | 0.105 ms | 9564.16 | 1 | 2025-08-14 local |
| kofft | Real | 32768 | Single | 3.871 ms | 258.33 | 4 | 2025-08-14 local |
| realfft | Real | 32768 | Single | 0.076 ms | 13146.31 | 0 | 2025-08-14 local |
| kofft | Complex | 65536 | Single | 4.232 ms | 236.32 | 3 | 2025-08-14 local |
| kofft | Complex | 65536 | Parallel | 2.834 ms | 352.88 | 3 | 2025-08-14 local |
| rustfft | Complex | 65536 | Single | 0.249 ms | 4015.79 | 1 | 2025-08-14 local |
| kofft | Real | 65536 | Single | 2.854 ms | 350.41 | 4 | 2025-08-14 local |
| realfft | Real | 65536 | Single | 0.140 ms | 7142.30 | 0 | 2025-08-14 local |
| kofft | Complex | 131072 | Single | 5.810 ms | 172.11 | 4 | 2025-08-14 local |
| kofft | Complex | 131072 | Parallel | 4.891 ms | 204.47 | 3 | 2025-08-14 local |
| rustfft | Complex | 131072 | Single | 1.374 ms | 728.06 | 1 | 2025-08-14 local |
| kofft | Real | 131072 | Single | 6.192 ms | 161.51 | 5 | 2025-08-14 local |
| realfft | Real | 131072 | Single | 0.554 ms | 1806.64 | 0 | 2025-08-14 local |
| kofft | Complex | 262144 | Single | 15.280 ms | 65.45 | 3 | 2025-08-14 local |
| kofft | Complex | 262144 | Parallel | 9.065 ms | 110.32 | 3 | 2025-08-14 local |
| rustfft | Complex | 262144 | Single | 7.525 ms | 132.88 | 1 | 2025-08-14 local |
| kofft | Real | 262144 | Single | 21.934 ms | 45.59 | 4 | 2025-08-14 local |
| realfft | Real | 262144 | Single | 0.733 ms | 1364.44 | 0 | 2025-08-14 local |
| kofft | Complex | 524288 | Single | 29.240 ms | 34.20 | 3 | 2025-08-14 local |
| kofft | Complex | 524288 | Parallel | 29.209 ms | 34.24 | 3 | 2025-08-14 local |
| rustfft | Complex | 524288 | Single | 14.538 ms | 68.78 | 1 | 2025-08-14 local |
| kofft | Real | 524288 | Single | 37.093 ms | 26.96 | 4 | 2025-08-14 local |
| realfft | Real | 524288 | Single | 1.982 ms | 504.63 | 0 | 2025-08-14 local |
| kofft | Complex | 1048576 | Single | 59.265 ms | 16.87 | 3 | 2025-08-14 local |
| kofft | Complex | 1048576 | Parallel | 60.507 ms | 16.53 | 4 | 2025-08-14 local |
| rustfft | Complex | 1048576 | Single | 30.361 ms | 32.94 | 1 | 2025-08-14 local |
| kofft | Real | 1048576 | Single | 66.946 ms | 14.94 | 4 | 2025-08-14 local |
| realfft | Real | 1048576 | Single | 4.361 ms | 229.31 | 0 | 2025-08-14 local |
<!-- BENCH_END -->

