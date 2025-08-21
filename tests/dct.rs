use kofft::dct::{self, DctPlanner, MAX_DCT_LEN};

/// Ensure DCT-I works for even and odd lengths
#[test]
fn dct1_even_and_odd() {
    let even = vec![1.0f32, 2.0, 3.0, 4.0];
    let odd = vec![1.0f32, 2.0, 3.0];
    let out_even = dct::dct1(&even);
    let out_odd = dct::dct1(&odd);
    assert_eq!(out_even.len(), even.len());
    assert_eq!(out_odd.len(), odd.len());
}

/// DCT-II followed by DCT-III should reproduce the input (up to scaling)
#[test]
fn dct2_3_roundtrip() {
    let n = 5; // odd length
    let input: Vec<f32> = (0..n).map(|v| v as f32).collect();
    let d2 = dct::dct2(&input);
    let d3 = dct::dct3(&d2);
    for (orig, recon) in input.iter().zip(d3.iter()) {
        assert!((orig - recon / (n as f32 / 2.0)).abs() < 1e-3);
    }
}

/// DCT-IV is its own inverse
#[test]
fn dct4_self_inverse_even() {
    let input = vec![1.0f32, 2.0, 3.0, 4.0];
    let y = dct::dct4(&input);
    let n = input.len() as f32;
    let z = dct::dct4(&y);
    for (a, b) in input.iter().zip(z.iter()) {
        assert!((a - b / (n / 2.0)).abs() < 1e-3);
    }
}

/// Planner handles even and odd lengths and matches the naive implementation
#[test]
fn planner_handles_even_and_odd() {
    let mut planner = DctPlanner::new();
    let mut input_even = vec![1.0f32, 2.0, 3.0, 4.0];
    let mut out_even = vec![0.0f32; 4];
    let mut plan_even = planner.plan_dct2(4);
    plan_even(&mut input_even, &mut out_even).unwrap();
    let expect_even = dct::dct2(&[1.0, 2.0, 3.0, 4.0]);
    for (a, b) in out_even.iter().zip(expect_even.iter()) {
        assert!((a - b).abs() < 1e-4);
    }
    drop(plan_even);

    let n = 5;
    let mut input_odd: Vec<f32> = (0..n).map(|v| v as f32).collect();
    let expect_odd = dct::dct2(&input_odd);
    let mut out_odd = vec![0.0f32; n];
    let mut plan_odd = planner.plan_dct2(n);
    plan_odd(&mut input_odd, &mut out_odd).unwrap();
    for (a, b) in out_odd.iter().zip(expect_odd.iter()) {
        assert!((a - b).abs() < 1e-4);
    }
}

/// Planning a transform that is too large should error
#[test]
#[should_panic]
fn planner_rejects_oversize() {
    let mut planner = DctPlanner::new();
    let _ = planner.plan_dct2(MAX_DCT_LEN + 1);
}

/// Planning length zero should error
#[test]
#[should_panic]
fn planner_rejects_zero() {
    let mut planner = DctPlanner::new();
    let _ = planner.plan_dct2(0);
}

/// DCT implementations should panic on oversized input
#[test]
#[should_panic]
fn dct2_panics_on_large_input() {
    let input = vec![0.0f32; MAX_DCT_LEN + 1];
    let _ = dct::dct2(&input);
}

/// DCT implementations should panic on zero-length input
#[test]
#[should_panic]
fn dct1_panics_on_zero() {
    let input: Vec<f32> = vec![];
    let _ = dct::dct1(&input);
}
