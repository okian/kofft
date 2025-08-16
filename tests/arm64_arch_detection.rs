use std::process::Command;

fn extract_cargo_line(output: &str) -> Option<&str> {
    output.lines().find(|line| line.contains("cargo"))
}

#[test]
fn arm64_triggers_aarch64_feature() {
    let output = Command::new("make")
        .args(["ARCH=arm64", "-pn", "build"])
        .output()
        .expect("failed to run make");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let build_line = extract_cargo_line(&stdout).expect("missing cargo command");
    assert!(
        build_line.contains("aarch64"),
        "aarch64 feature not enabled: {}",
        build_line
    );
}

#[test]
fn aarch64_triggers_aarch64_feature() {
    let output = Command::new("make")
        .args(["ARCH=aarch64", "-pn", "build"])
        .output()
        .expect("failed to run make");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let build_line = extract_cargo_line(&stdout).expect("missing cargo command");
    assert!(
        build_line.contains("aarch64"),
        "aarch64 feature not enabled: {}",
        build_line
    );
}

#[test]
fn arm64_enables_neon_rustflags() {
    let output = Command::new("make")
        .args(["ARCH=arm64", "-pn", "bench-libs"])
        .output()
        .expect("failed to run make");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let build_line = extract_cargo_line(&stdout).expect("missing cargo command");
    assert!(
        build_line.contains("neon"),
        "neon feature not enabled: {}",
        build_line
    );
    assert!(
        build_line.contains("-C target-feature=+neon"),
        "neon RUSTFLAGS missing: {}",
        build_line
    );
}

#[test]
fn aarch64_enables_neon_rustflags() {
    let output = Command::new("make")
        .args(["ARCH=aarch64", "-pn", "bench-libs"])
        .output()
        .expect("failed to run make");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let build_line = extract_cargo_line(&stdout).expect("missing cargo command");
    assert!(
        build_line.contains("neon"),
        "neon feature not enabled: {}",
        build_line
    );
    assert!(
        build_line.contains("-C target-feature=+neon"),
        "neon RUSTFLAGS missing: {}",
        build_line
    );
}
