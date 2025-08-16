use std::env;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;

fn main() {
    const SIZES: &[usize] = &[2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

    let out_dir = env::var("OUT_DIR").unwrap();
    let dest_path = PathBuf::from(out_dir).join("precomputed_twiddles.rs");
    let mut f = File::create(&dest_path).unwrap();

    writeln!(f, "use crate::num::{{Complex32, Complex64}};").unwrap();
    writeln!(f, "use alloc::sync::Arc;").unwrap();
    writeln!(f, "use std::sync::OnceLock;").unwrap();

    for &n in SIZES {
        let half = n / 2;
        // f32 data and once lock
        writeln!(
            f,
            "pub static TWIDDLES_F32_{n}_DATA: [Complex32; {half}] = ["
        )
        .unwrap();
        for k in 0..half {
            let angle = -2.0f32 * std::f32::consts::PI * k as f32 / n as f32;
            let re = angle.cos();
            let im = angle.sin();
            writeln!(
                f,
                "    Complex32 {{ re: {:.10}f32, im: {:.10}f32 }},",
                re, im
            )
            .unwrap();
        }
        writeln!(f, "];\n").unwrap();
        writeln!(
            f,
            "static TWIDDLES_F32_{n}: OnceLock<Arc<[Complex32]>> = OnceLock::new();\n"
        )
        .unwrap();

        // f64 data and once lock
        writeln!(
            f,
            "pub static TWIDDLES_F64_{n}_DATA: [Complex64; {half}] = ["
        )
        .unwrap();
        for k in 0..half {
            let angle = -2.0f64 * std::f64::consts::PI * k as f64 / n as f64;
            let re = angle.cos();
            let im = angle.sin();
            writeln!(
                f,
                "    Complex64 {{ re: {:.16}f64, im: {:.16}f64 }},",
                re, im
            )
            .unwrap();
        }
        writeln!(f, "];\n").unwrap();
        writeln!(
            f,
            "static TWIDDLES_F64_{n}: OnceLock<Arc<[Complex64]>> = OnceLock::new();\n"
        )
        .unwrap();
    }

    writeln!(
        f,
        "pub fn lookup_f32(n: usize) -> Option<Arc<[Complex32]>> {{ match n {{"
    )
    .unwrap();
    for &n in SIZES {
        writeln!(
            f,
            "    {n} => Some(TWIDDLES_F32_{n}.get_or_init(|| Arc::from(TWIDDLES_F32_{n}_DATA.to_vec())).clone()),"
        )
        .unwrap();
    }
    writeln!(f, "    _ => None, }} }}").unwrap();

    writeln!(
        f,
        "pub fn lookup_f64(n: usize) -> Option<Arc<[Complex64]>> {{ match n {{"
    )
    .unwrap();
    for &n in SIZES {
        writeln!(
            f,
            "    {n} => Some(TWIDDLES_F64_{n}.get_or_init(|| Arc::from(TWIDDLES_F64_{n}_DATA.to_vec())).clone()),"
        )
        .unwrap();
    }
    writeln!(f, "    _ => None, }} }}").unwrap();
}
