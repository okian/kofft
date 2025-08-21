use assert_cmd::Command;

/// Ensures that the crate compiles with each optional feature enabled
/// individually. The baseline `std` feature is always active so that
/// unsupported `no_std` combinations are skipped. This guards against
/// accidental cfg regressions and missing dependencies.
#[test]
fn feature_powerset_builds() {
    let mut cmd = Command::new("cargo");
    cmd.args(["hack", "check", "--each-feature", "--features", "std"]);
    cmd.assert().success();
}
