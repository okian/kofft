use std::fs::{self, Permissions};
use std::os::unix::fs::PermissionsExt;
use std::process::Command;

#[test]
fn cpuflags_detects_neon_features() {
    let dir = tempfile::tempdir().expect("tempdir");
    let lscpu_path = dir.path().join("lscpu");
    fs::write(
        &lscpu_path,
        "#!/bin/sh\necho 'Architecture: aarch64'\necho 'Features: fp asimd evtstrm crc32'\n",
    )
    .expect("write script");
    fs::set_permissions(&lscpu_path, Permissions::from_mode(0o755)).expect("perm");

    let path_env = format!(
        "{}:{}",
        dir.path().display(),
        std::env::var("PATH").unwrap()
    );
    let output = Command::new("make")
        .args(["-pn", "build"])
        .env("PATH", path_env)
        .output()
        .expect("run make");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let cpuflags_line = stdout
        .lines()
        .find(|l| l.starts_with("CPUFLAGS :="))
        .expect("missing CPUFLAGS");
    assert!(
        cpuflags_line.contains("asimd"),
        "NEON feature missing: {}",
        cpuflags_line
    );
}
