use kofft::fft::{fft_parallel, Complex32};
use std::time::Instant;

#[cfg(feature = "parallel")]
use rayon::ThreadPoolBuilder;

fn main() {
    #[cfg(feature = "parallel")]
    {
        let size = 1 << 14; // 16384-point FFT
        let data: Vec<Complex32> = (0..size)
            .map(|i| Complex32::new((i as f32 * 0.1).sin(), (i as f32 * 0.1).cos()))
            .collect();

        let pool_single = ThreadPoolBuilder::new().num_threads(1).build().unwrap();
        let seq_time = {
            let mut buf = data.clone();
            let start = Instant::now();
            pool_single.install(|| fft_parallel(&mut buf).unwrap());
            start.elapsed()
        };

        let pool_multi = ThreadPoolBuilder::new().build().unwrap();
        let par_time = {
            let mut buf = data.clone();
            let start = Instant::now();
            pool_multi.install(|| fft_parallel(&mut buf).unwrap());
            start.elapsed()
        };

        println!("Sequential (1 thread): {:?}", seq_time);
        println!(
            "Parallel   ({} threads): {:?}",
            pool_multi.current_num_threads(),
            par_time
        );
    }
    #[cfg(not(feature = "parallel"))]
    {
        println!("Enable the `parallel` feature to run this example");
    }
}
