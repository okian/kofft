use kofft::fft::ScalarFftImpl;
use kofft::rfft::{irfft_stack, rfft_stack, RealFftImpl};
use kofft::Complex32;

fn main() {
    // Planner-based real FFT
    let fft = ScalarFftImpl::<f32>::default();
    let mut input = vec![1.0f32, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let mut spectrum = vec![Complex32::new(0.0, 0.0); input.len() / 2 + 1];
    fft.rfft(&mut input, &mut spectrum).unwrap();

    let mut output = vec![0.0f32; input.len()];
    fft.irfft(&mut spectrum, &mut output).unwrap();
    println!("Input: {:?}\nReconstructed: {:?}", input, output);

    // Stack-only helpers
    let stack_input = [1.0f32, 2.0, 3.0, 4.0];
    let mut stack_freq = [Complex32::new(0.0, 0.0); 3];
    rfft_stack(&stack_input, &mut stack_freq).unwrap();
    let mut stack_out = [0.0f32; 4];
    irfft_stack(&stack_freq, &mut stack_out).unwrap();
    println!("Stack input: {:?}\nStack output: {:?}", stack_input, stack_out);
}
