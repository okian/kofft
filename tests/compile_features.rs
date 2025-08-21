use assert_cmd::Command;
use std::process::Command as StdCommand;

/// Ensures that the crate compiles with each optional feature enabled
/// individually. The baseline `std` feature is always active so that
/// unsupported `no_std` combinations are skipped. This guards against
/// accidental cfg regressions and missing dependencies.
/// Verifies that each optional feature compiles in isolation. The check uses
/// the `cargo-hack` subcommand when available and otherwise skips to avoid
/// false negatives on systems lacking that tool.
#[test]
fn feature_powerset_builds() {
    // Skip when the `cargo-hack` subcommand is unavailable to prevent spurious
    // failures on systems without it.
    if StdCommand::new("cargo")
        .arg("hack")
        .arg("--version")
        .status()
        .map(|s| !s.success())
        .unwrap_or(true)
    {
        eprintln!("cargo-hack not installed; skipping feature checks");
        return;
    }

    let mut cmd = Command::new("cargo");
    cmd.args(["hack", "check", "--each-feature", "--features", "std"]);
    cmd.assert().success();
}
