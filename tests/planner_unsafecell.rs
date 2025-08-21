// Test intent: verifies planner unsafecell behavior including edge cases.
use kofft::fft::{Complex32, FftImpl, ScalarFftImpl};

#[test]
fn planner_allows_sequential_mutation_without_refcell_overhead() {
    let fft = ScalarFftImpl::<f32>::default();
    let mut data: Vec<Complex32> = (0..8)
        .map(|i| Complex32::new(i as f32, -(i as f32)))
        .collect();
    let original = data.clone();

    fft.fft(&mut data).unwrap();
    fft.ifft(&mut data).unwrap();

    for (a, b) in data.iter().zip(original.iter()) {
        assert!((a.re - b.re).abs() < 1e-5);
        assert!((a.im - b.im).abs() < 1e-5);
    }
}
