// Test intent: verifies thread-count limits and calibration behavior via environment overrides.
#![cfg(all(feature = "parallel", feature = "std"))]

use std::process::Command;

/// Thread count deliberately exceeding typical core counts to test clamping.
const EXCESSIVE_THREADS: usize = 10_000;
/// Arbitrary per-core work value used to validate environment overrides.
const CUSTOM_WORK: usize = 12345;

#[test]
/// Ensure the `KOFFT_PAR_FFT_THREADS` environment variable is capped at the
/// number of logical cores to prevent oversubscription.
fn env_thread_override_capped() {
    let exe = std::env::current_exe().expect("Invariant: operation should succeed");
    let output = Command::new(&exe)
        .env("KOFFT_PAR_FFT_THREADS", EXCESSIVE_THREADS.to_string())
        .args(["--exact", "print_thread_count", "--nocapture"])
        .output()
        .expect("run thread count test");
    let stdout = String::from_utf8(output.stdout).expect("Invariant: operation should succeed");
    let count: usize = stdout
        .lines()
        .rev()
        .find_map(|l| l.trim().parse().ok())
        .expect("Invariant: operation should succeed");
    assert_eq!(count, num_cpus::get().max(1));
}

#[test]
/// Confirm that `set_parallel_fft_threads` also clamps to the number of
/// available logical cores.
fn override_thread_count_capped() {
    let exe = std::env::current_exe().expect("Invariant: operation should succeed");
    let output = Command::new(&exe)
        .args([
            "--exact",
            "print_thread_count_after_override",
            "--nocapture",
        ])
        .output()
        .expect("run override test");
    let stdout = String::from_utf8(output.stdout).expect("Invariant: operation should succeed");
    let count: usize = stdout
        .lines()
        .rev()
        .find_map(|l| l.trim().parse().ok())
        .expect("Invariant: operation should succeed");
    assert_eq!(count, num_cpus::get().max(1));
}

#[test]
/// Verify `KOFFT_PAR_FFT_PER_CORE_WORK` is respected verbatim when provided.
fn env_per_core_work_respected() {
    let exe = std::env::current_exe().expect("Invariant: operation should succeed");
    let output = Command::new(&exe)
        .env("KOFFT_PAR_FFT_PER_CORE_WORK", CUSTOM_WORK.to_string())
        .args(["--exact", "print_env_per_core_work", "--nocapture"])
        .output()
        .expect("run per-core work test");
    let stdout = String::from_utf8(output.stdout).expect("Invariant: operation should succeed");
    let work: usize = stdout
        .lines()
        .rev()
        .find_map(|l| l.trim().parse().ok())
        .expect("Invariant: operation should succeed");
    assert_eq!(work, CUSTOM_WORK);
}

#[test]
/// Confirm the calibrated per-core work estimate never drops below the
/// documented minimum.
fn calibration_minimum_enforced() {
    let exe = std::env::current_exe().expect("Invariant: operation should succeed");
    let output = Command::new(&exe)
        .args(["--exact", "print_calibrated_work", "--nocapture"])
        .output()
        .expect("run calibration test");
    let stdout = String::from_utf8(output.stdout).expect("Invariant: operation should succeed");
    let work: usize = stdout
        .lines()
        .rev()
        .find_map(|l| l.trim().parse().ok())
        .expect("Invariant: operation should succeed");
    assert!(work >= kofft::fft::__TEST_MIN_CALIBRATED_WORK);
}

#[test]
/// Helper test that prints the current thread-pool size for child-process
/// assertions.
fn print_thread_count() {
    println!("{}", kofft::fft::__test_parallel_pool_thread_count());
}

#[test]
/// Helper test that sets an oversized override and prints the resulting thread
/// count for verification.
fn print_thread_count_after_override() {
    kofft::fft::set_parallel_fft_threads(EXCESSIVE_THREADS);
    println!("{}", kofft::fft::__test_parallel_pool_thread_count());
}

#[test]
/// Helper test that prints the per-core work value obtained from the
/// environment.
fn print_env_per_core_work() {
    println!("{}", kofft::fft::__test_env_parallel_fft_per_core_work());
}

#[test]
/// Helper test that prints the calibrated per-core work value for assertions.
fn print_calibrated_work() {
    println!("{}", kofft::fft::__test_calibrated_per_core_work());
}
