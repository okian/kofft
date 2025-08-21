use kofft::fft::ScalarFftImpl;
use kofft::rfft::{irfft_stack, rfft_stack, RfftPlanner};
use kofft::Complex32;

fn main() {
    // Planner-based real FFT
    let fft = ScalarFftImpl::<f32>::default();
    let mut planner = RfftPlanner::new().expect("planner creation");
    let mut input = vec![1.0f32, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let mut spectrum = vec![Complex32::new(0.0, 0.0); input.len() / 2 + 1];
    let mut scratch = vec![Complex32::new(0.0, 0.0); input.len() / 2];
    planner
        .rfft_with_scratch(&fft, &mut input, &mut spectrum, &mut scratch)
        .unwrap();

    let mut output = vec![0.0f32; input.len()];
    planner
        .irfft_with_scratch(&fft, &mut spectrum, &mut output, &mut scratch)
        .unwrap();
    println!("Input: {:?}\nReconstructed: {:?}", input, output);

    // Stack-only helpers
    let stack_input = [1.0f32, 2.0, 3.0, 4.0];
    let mut stack_freq = [Complex32::new(0.0, 0.0); 3];
    rfft_stack(&stack_input, &mut stack_freq).unwrap();
    let mut stack_out = [0.0f32; 4];
    irfft_stack(&stack_freq, &mut stack_out).unwrap();
    println!(
        "Stack input: {:?}\nStack output: {:?}",
        stack_input, stack_out
    );
}
