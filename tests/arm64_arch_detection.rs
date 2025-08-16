use std::env;
use xtask::detect_config;

#[test]
fn arm64_triggers_aarch64_feature() {
    env::set_var("ARCH", "arm64");
    let cfg = detect_config();
    env::remove_var("ARCH");
    assert!(
        cfg.features.contains(&"aarch64".to_string()),
        "aarch64 feature not enabled: {:?}",
        cfg.features
    );
}

#[test]
fn aarch64_triggers_aarch64_feature() {
    env::set_var("ARCH", "aarch64");
    let cfg = detect_config();
    env::remove_var("ARCH");
    assert!(
        cfg.features.contains(&"aarch64".to_string()),
        "aarch64 feature not enabled: {:?}",
        cfg.features
    );
}
