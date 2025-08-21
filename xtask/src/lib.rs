use anyhow::{anyhow, Result};
use std::env;
use std::process::Command;
use std::string::String;

/// Environment variable allowing users to append additional feature flags.
pub const FEATURES_ENV_VAR: &str = "KOFFT_FEATURES";
/// Environment variable that overrides detected architecture.
pub const ARCH_ENV_VAR: &str = "ARCH";
/// Default parallelism used when the system cannot determine CPU count.
pub const DEFAULT_PARALLELISM: usize = 1;
/// Cargo feature enabling parallel benchmarks and tests.
pub const PARALLEL_FEATURE: &str = "parallel";
/// Example name executed for a single-threaded benchmark run.
pub const BENCHMARK_EXAMPLE: &str = "benchmark";
/// Example name executed when the `parallel` feature is enabled.
pub const PARALLEL_BENCHMARK_EXAMPLE: &str = "parallel_benchmark";
/// Manifest path for the benchmark crate used by several subcommands.
pub const KOFFT_BENCH_MANIFEST: &str = "kofft-bench/Cargo.toml";
/// Example responsible for updating the benchmark README document.
pub const UPDATE_BENCH_README_EXAMPLE: &str = "update_bench_readme";
/// Cargo package executed by the `sanity` subcommand.
pub const SANITY_CHECK_PACKAGE: &str = "sanity-check";

/// Options derived from the host machine used to configure cargo commands.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BuildConfig {
    /// Cargo feature flags enabled for the invocation.
    pub features: Vec<String>,
    /// Optional extra `rustc` flags enabling CPU-specific optimizations.
    pub rustflags: Option<String>,
    /// Benchmark example to run when executing performance tests.
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

/// Detect build configuration from the current machine.
pub fn detect_config() -> BuildConfig {
    let arch = detect_arch();
    let cpu_flags = detect_cpu_flags();
    let nproc = detect_nproc();
    let extra = env::var(FEATURES_ENV_VAR).unwrap_or_default();
    compute_config(&arch, &cpu_flags, nproc, &extra)
}

/// Determine CPU architecture, honoring the [`ARCH_ENV_VAR`] override when
/// present.
fn detect_arch() -> String {
    if let Ok(arch) = env::var(ARCH_ENV_VAR) {
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

/// Query CPU feature flags using platform-specific utilities.
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

/// Determine hardware concurrency, falling back to a safe default to avoid
/// unbounded thread creation.
fn detect_nproc() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(DEFAULT_PARALLELISM)
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
        features.push(PARALLEL_FEATURE.into());
    }

    for feat in extra.split_whitespace() {
        if !feat.is_empty() {
            features.push(feat.to_string());
        }
    }

    let example = if features.iter().any(|f| f == PARALLEL_FEATURE) {
        PARALLEL_BENCHMARK_EXAMPLE.to_string()
    } else {
        BENCHMARK_EXAMPLE.to_string()
    };

    BuildConfig {
        features,
        rustflags,
        example,
    }
}

/// Construct a `cargo build` command with the specified feature set.
pub fn build_command(cfg: &BuildConfig) -> Command {
    let mut cmd = Command::new("cargo");
    cmd.arg("build");
    if let Some(f) = cfg.features_arg() {
        cmd.arg("--features").arg(f);
    }
    cmd
}

/// Construct a `cargo test` command that respects configured features.
pub fn test_command(cfg: &BuildConfig) -> Command {
    let mut cmd = Command::new("cargo");
    cmd.arg("test");
    if let Some(f) = cfg.features_arg() {
        cmd.arg("--features").arg(f);
    }
    cmd
}

/// Construct a `cargo clippy` command that lints all targets and features.
pub fn clippy_command() -> Command {
    let mut cmd = Command::new("cargo");
    cmd.args(["clippy", "--all-targets", "--all-features"]);
    cmd
}

/// Construct a `cargo fmt` command that formats the entire workspace.
pub fn fmt_command() -> Command {
    let mut cmd = Command::new("cargo");
    cmd.args(["fmt", "--all"]);
    cmd
}

/// Construct a command to run the project's benchmark example under `cargo`.
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

/// Construct a command that benchmarks external libraries.
pub fn bench_libs_command(cfg: &BuildConfig) -> Command {
    let mut cmd = Command::new("cargo");
    if let Some(rf) = &cfg.rustflags {
        cmd.env("RUSTFLAGS", rf);
    }
    cmd.args(["bench", "--manifest-path", KOFFT_BENCH_MANIFEST]);
    if let Some(f) = cfg.features_arg() {
        cmd.arg("--features").arg(f);
    }
    cmd
}

/// Construct a command that regenerates the benchmark README.
pub fn update_bench_readme_command(cfg: &BuildConfig) -> Command {
    let mut cmd = Command::new("cargo");
    if let Some(rf) = &cfg.rustflags {
        cmd.env("RUSTFLAGS", rf);
    }
    cmd.args([
        "run",
        "--manifest-path",
        KOFFT_BENCH_MANIFEST,
        "--example",
        UPDATE_BENCH_README_EXAMPLE,
        "--release",
    ]);
    if let Some(f) = cfg.features_arg() {
        cmd.arg("--features").arg(f);
    }
    cmd
}

/// Create a command that generates a spectrogram for manual sanity checking.
/// The function validates paths to ensure clear, fail-fast errors on user
/// mistakes.
pub fn sanity_command(input: &str, output: &str) -> Result<Command> {
    if input.trim().is_empty() || output.trim().is_empty() {
        return Err(anyhow!("input and output paths must be provided"));
    }
    let mut cmd = Command::new("cargo");
    cmd.args(["run", "-r", "-p", SANITY_CHECK_PACKAGE, "--", input, output]);
    Ok(cmd)
}

/// Execute a command and return an error if it fails. This ensures all tasks
/// abort immediately on failures.
pub fn run_command(mut cmd: Command) -> Result<()> {
    let status = cmd.status()?;
    if status.success() {
        Ok(())
    } else {
        Err(anyhow!("command exited with {status}"))
    }
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
    fn test_build_command_respects_features() {
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
    fn test_test_command_respects_features() {
        let cfg = compute_config("x86_64", "flags: avx2", 2, "");
        let cmd = test_command(&cfg);
        let args: Vec<_> = cmd
            .get_args()
            .map(|a| a.to_str().unwrap().to_string())
            .collect();
        assert!(args.contains(&"test".to_string()));
        assert!(args.contains(&"--features".to_string()));
        assert!(args.iter().any(|a| a.contains("avx2")));
    }

    #[test]
    fn test_clippy_command_flags() {
        let cmd = clippy_command();
        let args: Vec<_> = cmd
            .get_args()
            .map(|a| a.to_str().unwrap().to_string())
            .collect();
        assert!(args.contains(&"--all-targets".to_string()));
        assert!(args.contains(&"--all-features".to_string()));
    }

    #[test]
    fn test_fmt_command_flags() {
        let cmd = fmt_command();
        let args: Vec<_> = cmd
            .get_args()
            .map(|a| a.to_str().unwrap().to_string())
            .collect();
        assert!(args.contains(&"--all".to_string()));
    }

    #[test]
    fn test_benchmark_command_env_and_features() {
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
        let args: Vec<_> = cmd
            .get_args()
            .map(|a| a.to_str().unwrap().to_string())
            .collect();
        assert!(args.contains(&"--example".to_string()));
    }

    #[test]
    fn test_bench_libs_command_features() {
        let cfg = compute_config("x86_64", "flags: avx2", 2, "");
        let cmd = bench_libs_command(&cfg);
        let args: Vec<_> = cmd
            .get_args()
            .map(|a| a.to_str().unwrap().to_string())
            .collect();
        assert!(args.contains(&"bench".to_string()));
        assert!(args.contains(&KOFFT_BENCH_MANIFEST.to_string()));
    }

    #[test]
    fn test_update_bench_readme_command_features() {
        let cfg = compute_config("x86_64", "flags: avx2", 2, "");
        let cmd = update_bench_readme_command(&cfg);
        let args: Vec<_> = cmd
            .get_args()
            .map(|a| a.to_str().unwrap().to_string())
            .collect();
        assert!(args.contains(&UPDATE_BENCH_README_EXAMPLE.to_string()));
        assert!(args.contains(&KOFFT_BENCH_MANIFEST.to_string()));
    }

    #[test]
    fn test_sanity_command_validation() {
        assert!(sanity_command("", "out").is_err());
        assert!(sanity_command("in", "").is_err());
        let cmd = sanity_command("in.flac", "out.png").unwrap();
        let args: Vec<_> = cmd
            .get_args()
            .map(|a| a.to_str().unwrap().to_string())
            .collect();
        assert!(args.contains(&SANITY_CHECK_PACKAGE.to_string()));
    }

    #[test]
    fn test_run_command_fail_fast() {
        assert!(run_command(Command::new("true")).is_ok());
        assert!(run_command(Command::new("false")).is_err());
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
