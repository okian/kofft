fn main() {
    #[cfg(all(feature = "parallel", feature = "std", feature = "internal-tests"))]
    {
        println!("{}", kofft::fft::__test_parallel_fft_threshold());
    }
    #[cfg(not(all(feature = "parallel", feature = "std", feature = "internal-tests")))]
    {
        // Example requires parallel + std + internal-tests
        println!("0");
    }
}
