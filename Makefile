# Simple Makefile for kofft development
ARCH := $(shell uname -m)
CPUFLAGS := $(shell lscpu | grep -i flags)
NPROC := $(shell nproc)

SIMD_FEATURES :=
RUSTFLAGS_ADD :=

ifeq ($(findstring x86_64,$(ARCH)),x86_64)
  ifneq ($(findstring avx2,$(CPUFLAGS)),)
    SIMD_FEATURES += avx2
    RUSTFLAGS_ADD += -C target-feature=+avx2,+fma
  else ifneq ($(findstring sse4_1,$(CPUFLAGS)),)
    SIMD_FEATURES += sse
  endif
else ifeq ($(ARCH),aarch64)
  SIMD_FEATURES += aarch64
endif

PAR_FEATURE :=
EXAMPLE := benchmark
ifneq ($(shell [ $(NPROC) -gt 1 ] && echo yes),)
  PAR_FEATURE += parallel
  EXAMPLE := parallel_benchmark
endif

FEATURES := $(strip $(SIMD_FEATURES) $(PAR_FEATURE))

.PHONY: build test clippy fmt analyze benchmark bench-libs sanity

build:
	cargo build $(if $(FEATURES),--features "$(FEATURES)")

test:
	cargo test $(if $(FEATURES),--features "$(FEATURES)")

clippy:
	cargo clippy --all-targets --all-features

fmt:
	cargo fmt --all

analyze: fmt clippy

benchmark:
        RUSTFLAGS="$(RUSTFLAGS_ADD)" cargo run --example $(EXAMPLE) $(if $(FEATURES),--features "$(FEATURES)") --release

# Run criterion benchmarks comparing kofft with other FFT libraries
bench-libs:
	RUSTFLAGS="$(RUSTFLAGS_ADD)" cargo bench --manifest-path kofft-bench/Cargo.toml $(if $(FEATURES),--features "$(FEATURES)")

sanity:
	cargo run -p sanity-check -- $(FLAC)
