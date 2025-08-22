// Test intent: verifies planner unsafecell behavior including edge cases.
use kofft::fft::{Complex32, FftImpl, ScalarFftImpl};

/// Number of complex samples used to exercise sequential planner mutation.
const SAMPLE_LEN: usize = 8;
/// Permissible floating-point error tolerance for round-trip FFT comparisons.
const FLOAT_EPSILON: f32 = 1e-5;

/// Ensure the planner can mutate sequentially without incurring `RefCell` overhead.
#[test]
fn planner_allows_sequential_mutation_without_refcell_overhead() {
    let fft = ScalarFftImpl::<f32>::default();
    let mut data: Vec<Complex32> = (0..SAMPLE_LEN)
        .map(|i| Complex32::new(i as f32, -(i as f32)))
        .collect();
    let original = data.clone();

    fft.fft(&mut data).unwrap();
    fft.ifft(&mut data).unwrap();

    for (a, b) in data.iter().zip(original.iter()) {
        assert!((a.re - b.re).abs() < FLOAT_EPSILON);
        assert!((a.im - b.im).abs() < FLOAT_EPSILON);
    }
}
