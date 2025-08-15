use core::f32::consts::PI;
use kofft::dst::dst2;

fn dst2_naive(input: &[f32]) -> Vec<f32> {
    let n = input.len();
    let mut output = vec![0.0f32; n];
    if n == 0 {
        return output;
    }
    let factor = PI / n as f32;
    for (k, out) in output.iter_mut().enumerate() {
        let mut sum = 0.0;
        for (i, &x) in input.iter().enumerate() {
            sum += x * (factor * (i as f32 + 0.5) * (k as f32 + 1.0)).sin();
        }
        *out = sum;
    }
    output
}

#[test]
fn dst2_matches_naive() {
    let cases: &[&[f32]] = &[
        &[],
        &[1.0],
        &[1.0, 2.0],
        &[1.0, 2.0, 3.0, 4.0],
        &[0.5, -1.0, 3.5, -2.5, 0.25],
    ];
    for &case in cases {
        let expected = dst2_naive(case);
        let result = dst2(case);
        assert_eq!(expected.len(), result.len());
        for (a, b) in expected.iter().zip(result.iter()) {
            assert!((a - b).abs() < 1e-4, "{} vs {}", a, b);
        }
    }
}
