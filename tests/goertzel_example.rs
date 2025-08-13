use kofft::goertzel::goertzel_f32;

#[test]
fn goertzel_example_runs() {
    let signal = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let sample_rate = 8000.0;
    let target_freq = 1000.0;
    let mag = goertzel_f32(&signal, sample_rate, target_freq);
    assert!(mag.is_finite());
}
