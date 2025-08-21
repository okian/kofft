/// Tests for the [`DstPlanner`] ensuring table caching and input validation.
use kofft::dst::DstPlanner;

/// Verify that repeated DST-II planning reuses the cached table and does not panic.
#[test]
fn plan_dst2_reuses_cache() {
    let mut planner = DstPlanner::<f32>::new();
    let first_ptr = planner.plan_dst2(8).as_ptr();
    let second_ptr = planner.plan_dst2(8).as_ptr();
    assert_eq!(first_ptr, second_ptr);
}

/// Verify that DST-II planning panics when provided a zero length.
#[test]
#[should_panic(expected = "DST length must be non-zero")]
fn plan_dst2_panics_on_zero_length() {
    let mut planner = DstPlanner::<f32>::new();
    let _ = planner.plan_dst2(0);
}

/// Verify that repeated DST-III planning reuses the cached table and does not panic.
#[test]
fn plan_dst3_reuses_cache() {
    let mut planner = DstPlanner::<f32>::new();
    let first_ptr = planner.plan_dst3(8).as_ptr();
    let second_ptr = planner.plan_dst3(8).as_ptr();
    assert_eq!(first_ptr, second_ptr);
}

/// Verify that DST-III planning panics when provided a zero length.
#[test]
#[should_panic(expected = "DST length must be non-zero")]
fn plan_dst3_panics_on_zero_length() {
    let mut planner = DstPlanner::<f32>::new();
    let _ = planner.plan_dst3(0);
}

/// Verify that repeated DST-IV planning reuses the cached table and does not panic.
#[test]
fn plan_dst4_reuses_cache() {
    let mut planner = DstPlanner::<f32>::new();
    let first_ptr = planner.plan_dst4(8).as_ptr();
    let second_ptr = planner.plan_dst4(8).as_ptr();
    assert_eq!(first_ptr, second_ptr);
}

/// Verify that DST-IV planning panics when provided a zero length.
#[test]
#[should_panic(expected = "DST length must be non-zero")]
fn plan_dst4_panics_on_zero_length() {
    let mut planner = DstPlanner::<f32>::new();
    let _ = planner.plan_dst4(0);
}
