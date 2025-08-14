use kofft::fft::{FftPlan, FftStrategy};
use kofft::{Complex32, FftPlanner};

fn generate_input(n: usize) -> Vec<Complex32> {
    (0..n)
        .map(|i| Complex32::new(i as f32, (i * 2) as f32))
        .collect()
}

fn assert_parity(n: usize) {
    let mut radix2_data = generate_input(n);
    let mut radix4_data = radix2_data.clone();

    let plan_r2 = FftPlan::<f32>::new(n, FftStrategy::Radix2);
    let plan_r4 = FftPlan::<f32>::new(n, FftStrategy::Radix4);

    plan_r2.fft(&mut radix2_data).unwrap();
    plan_r4.fft(&mut radix4_data).unwrap();

    for (a, b) in radix2_data.iter().zip(radix4_data.iter()) {
        assert!((a.re - b.re).abs() < 1e-5 && (a.im - b.im).abs() < 1e-5);
    }
}

#[test]
fn parity_between_radix2_and_radix4() {
    for &n in &[16_usize, 64] {
        assert_parity(n);
    }
}

#[test]
fn planner_selects_radix2_for_mixed_radix() {
    let mut planner = FftPlanner::<f32>::new();
    assert_eq!(planner.plan_strategy(32), FftStrategy::Radix2);
}
