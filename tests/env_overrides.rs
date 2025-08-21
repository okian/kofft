// Test intent: verifies env overrides behavior including edge cases.
#![cfg(all(feature = "parallel", feature = "std", feature = "internal-tests"))]

use std::process::Command;

#[test]
fn print_threshold() {
    println!("{}", kofft::fft::__test_parallel_fft_threshold());
}

#[test]
fn env_par_fft_per_core_work_changes_threshold() {
    let exe = std::env::current_exe().unwrap();
    let output = Command::new(&exe)
        .env("KOFFT_PAR_FFT_THRESHOLD", "32")
        .args(["--exact", "print_threshold", "--nocapture"])
        .output()
        .expect("run threshold test");
    let stdout = String::from_utf8(output.stdout).unwrap();
    let t1: usize = stdout
        .lines()
        .rev()
        .find_map(|l| l.trim().parse().ok())
        .unwrap();
    assert_eq!(t1, 32);

    let output = Command::new(&exe)
        .env("KOFFT_PAR_FFT_THRESHOLD", "64")
        .args(["--exact", "print_threshold", "--nocapture"])
        .output()
        .expect("run threshold test");
    let stdout = String::from_utf8(output.stdout).unwrap();
    let t2: usize = stdout
        .lines()
        .rev()
        .find_map(|l| l.trim().parse().ok())
        .unwrap();
    assert_eq!(t2, 64);
}

#[test]
fn invalid_env_value_exits_with_error() {
    let exe = std::env::current_exe().unwrap();
    let output = Command::new(&exe)
        .env("KOFFT_PAR_FFT_THRESHOLD", "not-a-number")
        .args(["--exact", "print_threshold", "--nocapture"])
        .output()
        .expect("run threshold test");
    assert!(!output.status.success());
}
