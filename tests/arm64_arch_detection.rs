use std::process::Command;

fn extract_build_line(output: &str) -> Option<&str> {
    output.lines().find(|line| line.contains("cargo build"))
}

#[test]
fn arm64_triggers_aarch64_feature() {
    let output = Command::new("make")
        .args(["ARCH=arm64", "-pn", "build"])
        .output()
        .expect("failed to run make");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let build_line = extract_build_line(&stdout).expect("missing build command");
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
    let build_line = extract_build_line(&stdout).expect("missing build command");
    assert!(
        build_line.contains("aarch64"),
        "aarch64 feature not enabled: {}",
        build_line
    );
}
