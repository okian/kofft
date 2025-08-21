use std::env;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;

/// FFT sizes for which precomputed twiddle factors are generated.
///
/// Powers of two up to 1024 cover the small transform sizes used in tests and
/// examples. Larger sizes are computed at runtime.
const TWIDDLE_SIZES: &[usize] = &[2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

/// Build script entry point.
///
/// Generates Rust source containing precomputed FFT twiddle factors when the
/// `precomputed-twiddles` feature is enabled. Skipping generation avoids
/// unnecessary compile-time work for users who do not require these tables.
fn main() {
    // Abort early if the feature is not enabled.
    if env::var_os("CARGO_FEATURE_PRECOMPUTED_TWIDDLES").is_none() {
        return;
    }

    let out_dir = env::var("OUT_DIR").expect("OUT_DIR not set by cargo");
    let dest_path = PathBuf::from(out_dir).join("precomputed_twiddles.rs");
    let mut file = File::create(&dest_path).expect("unable to create twiddle file");

    // Emit headers required by the generated module.
    writeln!(file, "use crate::num::{{Complex32, Complex64}};").unwrap();
    writeln!(file, "use alloc::sync::Arc;").unwrap();
    writeln!(file, "use std::sync::OnceLock;").unwrap();

    for &n in TWIDDLE_SIZES {
        let half = n / 2;
        // f32 data and once lock
        writeln!(
            file,
            "pub static TWIDDLES_F32_{n}_DATA: [Complex32; {half}] = [",
        )
        .unwrap();
        for k in 0..half {
            let angle = -2.0f32 * std::f32::consts::PI * k as f32 / n as f32;
            let re = angle.cos();
            let im = angle.sin();
            writeln!(
                file,
                "    Complex32 {{ re: {:.10}f32, im: {:.10}f32 }},",
                re, im
            )
            .unwrap();
        }
        writeln!(file, "];\n").unwrap();
        writeln!(
            file,
            "static TWIDDLES_F32_{n}: OnceLock<Arc<[Complex32]>> = OnceLock::new();\n",
        )
        .unwrap();

        // f64 data and once lock
        writeln!(
            file,
            "pub static TWIDDLES_F64_{n}_DATA: [Complex64; {half}] = [",
        )
        .unwrap();
        for k in 0..half {
            let angle = -2.0f64 * std::f64::consts::PI * k as f64 / n as f64;
            let re = angle.cos();
            let im = angle.sin();
            writeln!(
                file,
                "    Complex64 {{ re: {:.16}f64, im: {:.16}f64 }},",
                re, im
            )
            .unwrap();
        }
        writeln!(file, "];\n").unwrap();
        writeln!(
            file,
            "static TWIDDLES_F64_{n}: OnceLock<Arc<[Complex64]>> = OnceLock::new();\n",
        )
        .unwrap();
    }

    writeln!(
        file,
        "pub fn lookup_f32(n: usize) -> Option<Arc<[Complex32]>> {{ match n {{",
    )
    .unwrap();
    for &n in TWIDDLE_SIZES {
        writeln!(
            file,
            "    {n} => Some(TWIDDLES_F32_{n}.get_or_init(|| Arc::from(TWIDDLES_F32_{n}_DATA.to_vec())).clone()),",
        )
        .unwrap();
    }
    writeln!(file, "    _ => None, }} }}").unwrap();

    writeln!(
        file,
        "pub fn lookup_f64(n: usize) -> Option<Arc<[Complex64]>> {{ match n {{",
    )
    .unwrap();
    for &n in TWIDDLE_SIZES {
        writeln!(
            file,
            "    {n} => Some(TWIDDLES_F64_{n}.get_or_init(|| Arc::from(TWIDDLES_F64_{n}_DATA.to_vec())).clone()),",
        )
        .unwrap();
    }
    writeln!(file, "    _ => None, }} }}").unwrap();
}
