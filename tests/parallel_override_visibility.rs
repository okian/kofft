#![cfg(all(feature = "parallel", feature = "std", feature = "internal-tests"))]
// Test intent: ensures that parallel FFT override setters publish values across
// threads so subsequent FFT computations see consistent configuration.

use std::sync::{Arc, Barrier};
use std::thread;

use kofft::fft::{__test_parallel_pool_thread_count, set_parallel_fft_threads};

#[test]
fn overrides_visible_across_threads() {
    // Validate thread-count override visibility.
    const THREADS: usize = 2;
    let barrier = Arc::new(Barrier::new(2));
    let b = barrier.clone();
    let setter = thread::spawn(move || {
        set_parallel_fft_threads(THREADS);
        b.wait();
    });
    barrier.wait();
    let count = __test_parallel_pool_thread_count();
    setter.join().expect("setter thread panicked");
    assert_eq!(count, THREADS, "thread override not visible across threads");
}
