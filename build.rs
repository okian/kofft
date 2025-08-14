use std::env;

fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    let _target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();

    #[cfg(feature = "x86_64")]
    {
        let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
        if target_arch == "x86_64" {
            // Detect AVX2 and FMA support at build time
            if std::arch::is_x86_feature_detected!("avx2") && std::arch::is_x86_feature_detected!("fma") {
                println!("cargo:rustc-flags=-C target-feature=+avx2,+fma");
            }
        }
    }

    #[cfg(all(feature = "sse", not(feature = "x86_64")))]
    {
        let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
        if target_arch == "x86_64" {
            // Enable SSE2 when AVX2/FMA are not enabled
            println!("cargo:rustc-flags=-C target-feature=+sse2");
        }
    }

    #[cfg(feature = "aarch64")]
    {
        let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
        if target_arch == "aarch64" {
            // Explicitly enable NEON on AArch64 targets
            println!("cargo:rustc-flags=-C target-feature=+neon");
        }
    }
}

