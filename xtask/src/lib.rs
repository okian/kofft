use std::process::Command;
use std::string::String;
use std::fs;
use std::env;
use anyhow::Result;
use std::path::PathBuf;

/// Options derived from the host machine used to configure cargo commands.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BuildConfig {
    pub features: Vec<String>,
    pub rustflags: Option<String>,
    pub example: String,
}

impl BuildConfig {
    /// Join features into a single string suitable for passing to cargo.
    pub fn features_arg(&self) -> Option<String> {
        if self.features.is_empty() {
            None
        } else {
            Some(self.features.join(" "))
        }
    }
}

/// Get the workspace root directory
fn workspace_root() -> PathBuf {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let mut path = PathBuf::from(manifest_dir);
    path.pop(); // Go up from xtask to workspace root
    path
}

/// Detect build configuration from the current machine.
pub fn detect_config() -> BuildConfig {
    let arch = detect_arch();
    let cpu_flags = detect_cpu_flags();
    let nproc = detect_nproc();
    let extra = env::var("KOFFT_FEATURES").unwrap_or_default();
    compute_config(&arch, &cpu_flags, nproc, &extra)
}

fn detect_arch() -> String {
    if let Ok(arch) = env::var("ARCH") {
        if !arch.trim().is_empty() {
            return arch;
        }
    }
    Command::new("uname")
        .arg("-m")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default()
}

fn detect_cpu_flags() -> String {
    if let Ok(out) = Command::new("lscpu").output() {
        let s = String::from_utf8_lossy(&out.stdout);
        for line in s.lines() {
            if line.to_lowercase().contains("flags") {
                return line.to_string();
            }
        }
    }
    if let Ok(out) = Command::new("sysctl")
        .args(["-n", "machdep.cpu.features"])
        .output()
    {
        return String::from_utf8_lossy(&out.stdout).to_string();
    }
    String::new()
}

fn detect_nproc() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1)
}

/// Compute a [`BuildConfig`] from supplied inputs. This is separated for testing.
pub fn compute_config(arch: &str, cpu_flags: &str, nproc: usize, extra: &str) -> BuildConfig {
    let mut features = Vec::new();
    let mut rustflags = None;

    if arch.contains("x86_64") {
        features.push("x86_64".into());
        if cpu_flags.contains("avx512f") {
            features.push("avx512".into());
            rustflags = Some("-C target-feature=+avx512f,+fma".into());
        } else if cpu_flags.contains("avx2") {
            features.push("avx2".into());
            rustflags = Some("-C target-feature=+avx2,+fma".into());
        } else if cpu_flags.contains("sse4_1") {
            features.push("sse".into());
        }
    } else if arch.contains("aarch64") || arch.contains("arm64") {
        features.push("aarch64".into());
    }

    if nproc > 1 {
        features.push("parallel".into());
    }

    for feat in extra.split_whitespace() {
        if !feat.is_empty() {
            features.push(feat.to_string());
        }
    }

    let example = if features.iter().any(|f| f == "parallel") {
        "parallel_benchmark".to_string()
    } else {
        "benchmark".to_string()
    };

    BuildConfig {
        features,
        rustflags,
        example,
    }
}

pub fn build_command(cfg: &BuildConfig) -> Command {
    let mut cmd = Command::new("cargo");
    cmd.arg("build");
    if let Some(f) = cfg.features_arg() {
        cmd.arg("--features").arg(f);
    }
    cmd
}

pub fn test_command(cfg: &BuildConfig) -> Command {
    let mut cmd = Command::new("cargo");
    cmd.arg("test");
    if let Some(f) = cfg.features_arg() {
        cmd.arg("--features").arg(f);
    }
    cmd
}

pub fn clippy_command() -> Command {
    let mut cmd = Command::new("cargo");
    cmd.args(["clippy", "--all-targets", "--all-features"]);
    cmd
}

pub fn fmt_command() -> Command {
    let mut cmd = Command::new("cargo");
    cmd.args(["fmt", "--all"]);
    cmd
}

pub fn benchmark_command(cfg: &BuildConfig) -> Command {
    let mut cmd = Command::new("cargo");
    if let Some(rf) = &cfg.rustflags {
        cmd.env("RUSTFLAGS", rf);
    }
    cmd.args(["run", "--example", &cfg.example, "--release"]);
    if let Some(f) = cfg.features_arg() {
        cmd.arg("--features").arg(f);
    }
    cmd
}

pub fn bench_libs_command(cfg: &BuildConfig) -> Command {
    let mut cmd = Command::new("cargo");
    if let Some(rf) = &cfg.rustflags {
        cmd.env("RUSTFLAGS", rf);
    }
    cmd.args(["bench", "--manifest-path", "kofft-bench/Cargo.toml"]);
    if let Some(f) = cfg.features_arg() {
        cmd.arg("--features").arg(f);
    }
    cmd
}

pub fn update_bench_readme_command(cfg: &BuildConfig) -> Command {
    let mut cmd = Command::new("cargo");
    if let Some(rf) = &cfg.rustflags {
        cmd.env("RUSTFLAGS", rf);
    }
    cmd.args([
        "run",
        "--manifest-path",
        "kofft-bench/Cargo.toml",
        "--example",
        "update_bench_readme",
        "--release",
    ]);
    if let Some(f) = cfg.features_arg() {
        cmd.arg("--features").arg(f);
    }
    cmd
}

pub fn sanity_command(input: &str, output: &str) -> Command {
    let mut cmd = Command::new("cargo");
    cmd.args(["run", "-r", "-p", "sanity-check", "--", input, output]);
    cmd
}

pub fn web_spectrogram_command() -> Result<()> {
    let web_spectrogram_dir = workspace_root().join("web-spectrogram");
    
    // Build WebAssembly module directly with cargo
    let status = Command::new("cargo")
        .args(&["build", "--lib", "--release", "--target", "wasm32-unknown-unknown", "--no-default-features"])
        .current_dir(&web_spectrogram_dir)
        .status()?;
    
    if !status.success() {
        anyhow::bail!("Failed to build WebAssembly module");
    }
    
    // Copy the built WASM files to pkg directory
    let pkg_dir = web_spectrogram_dir.join("pkg");
    if !pkg_dir.exists() {
        fs::create_dir(&pkg_dir)?;
    }
    
    // Copy the built .wasm file
    let wasm_source = workspace_root()
        .join("target")
        .join("wasm32-unknown-unknown")
        .join("release")
        .join("web_spectrogram.wasm");
    let wasm_dest = pkg_dir.join("web_spectrogram.wasm");
    fs::copy(wasm_source, wasm_dest)?;
    
    // Generate the JavaScript bindings using wasm-bindgen CLI
    let status = Command::new("wasm-bindgen")
        .args(&[
            "--target", "web",
            "--out-dir", "pkg",
            "--out-name", "web_spectrogram",
            "../target/wasm32-unknown-unknown/release/web_spectrogram.wasm"
        ])
        .current_dir(&web_spectrogram_dir)
        .status()?;
    
    if !status.success() {
        anyhow::bail!("Failed to generate JavaScript bindings");
    }
    
    // Build and run the server
    let status = Command::new("cargo")
        .args(&["run", "--bin", "web-spectrogram-server", "--features", "server"])
        .current_dir(&web_spectrogram_dir)
        .status()?;
    
    if !status.success() {
        anyhow::bail!("Failed to run web-spectrogram server");
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_compute_x86_avx512() {
        let cfg = compute_config("x86_64", "flags: avx512f sse4_1", 4, "simd");
        assert!(cfg.features.contains(&"x86_64".into()));
        assert!(cfg.features.contains(&"avx512".into()));
        assert!(cfg.features.contains(&"parallel".into()));
        assert!(cfg.features.contains(&"simd".into()));
        assert_eq!(cfg.example, "parallel_benchmark");
        assert_eq!(
            cfg.rustflags.as_deref(),
            Some("-C target-feature=+avx512f,+fma")
        );
    }

    #[test]
    fn test_compute_x86_avx2() {
        let cfg = compute_config("x86_64", "flags: avx2", 1, "");
        assert!(cfg.features.contains(&"avx2".into()));
        assert_eq!(cfg.example, "benchmark");
        assert_eq!(
            cfg.rustflags.as_deref(),
            Some("-C target-feature=+avx2,+fma")
        );
    }

    #[test]
    fn test_compute_x86_sse() {
        let cfg = compute_config("x86_64", "flags: sse4_1", 1, "");
        assert!(cfg.features.contains(&"sse".into()));
        assert!(cfg.rustflags.is_none());
    }

    #[test]
    fn test_compute_aarch64() {
        let cfg = compute_config("aarch64", "", 1, "feat1 feat2");
        assert!(cfg.features.contains(&"aarch64".into()));
        assert!(cfg.features.contains(&"feat1".into()));
        assert!(cfg.features.contains(&"feat2".into()));
    }

    #[test]
    fn test_commands_include_features() {
        let cfg = compute_config("x86_64", "flags: avx2", 2, "simd");
        let cmd = build_command(&cfg);
        let args: Vec<_> = cmd
            .get_args()
            .map(|a| a.to_str().unwrap().to_string())
            .collect();
        assert!(args.contains(&"build".to_string()));
        assert!(args.contains(&"--features".to_string()));
        assert!(args.iter().any(|a| a.contains("avx2")));
    }

    #[test]
    fn test_benchmark_env() {
        let cfg = compute_config("x86_64", "flags: avx2", 2, "");
        let cmd = benchmark_command(&cfg);
        let envs: Vec<_> = cmd
            .get_envs()
            .map(|(k, v)| {
                (
                    k.to_str().unwrap().to_string(),
                    v.unwrap().to_str().unwrap().to_string(),
                )
            })
            .collect();
        assert!(envs
            .iter()
            .any(|(k, v)| k == "RUSTFLAGS" && v.contains("avx2")));
    }

    #[test]
    fn test_other_commands() {
        let cfg = compute_config("x86_64", "flags: avx2", 2, "");
        let tcmd = test_command(&cfg);
        assert!(tcmd.get_args().any(|a| a == "test"));
        let ccmd = clippy_command();
        assert!(ccmd.get_args().any(|a| a == "clippy"));
        let fcmd = fmt_command();
        assert!(fcmd.get_args().any(|a| a == "fmt"));
        let bcmd = bench_libs_command(&cfg);
        assert!(bcmd.get_args().any(|a| a == "bench"));
        let ucmd = update_bench_readme_command(&cfg);
        assert!(ucmd.get_args().any(|a| a == "update_bench_readme"));
        let scmd = sanity_command("in.flac", "out.png");
        let args: Vec<_> = scmd
            .get_args()
            .map(|a| a.to_str().unwrap().to_string())
            .collect();
        assert!(args.contains(&"sanity-check".to_string()));
        assert!(args.contains(&"in.flac".to_string()));
        assert!(args.contains(&"out.png".to_string()));
        let wcmd = web_spectrogram_command();
        assert_eq!(wcmd.get_program(), "sh");
        let wargs: Vec<_> = wcmd
            .get_args()
            .map(|a| a.to_str().unwrap().to_string())
            .collect();
        assert!(wargs.contains(&"-c".to_string()));
        assert!(wargs
            .iter()
            .any(|a| a.contains("wasm-pack build --target web")));
        assert!(wargs.iter().all(|a| !a.contains("npm")));
        assert!(wargs.iter().any(|a| a.contains("cp index.html")));
    }

    #[test]
    fn test_detect_functions() {
        let arch = detect_arch();
        let _flags = detect_cpu_flags();
        let nproc = detect_nproc();
        let cfg = detect_config();
        assert!(!arch.is_empty());
        assert!(nproc >= 1);
        // ensure config uses detected values
        assert!(!cfg.features.is_empty());
    }

    #[test]
    fn test_detect_arch_override() {
        env::set_var("ARCH", "arm64");
        assert_eq!(super::detect_arch(), "arm64");
        env::remove_var("ARCH");
    }
}
