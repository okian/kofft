// Test intent: verifies fuzzy alloc behavior including edge cases.
use kofft::fuzzy::{fuzzy_match, fuzzy_score};
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};

/// Allocator used in tests to count allocation operations.
struct CountingAlloc;

/// Global counter tracking allocation operations.
static ALLOC_COUNT: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for CountingAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOC_COUNT.fetch_add(1, Ordering::SeqCst);
        System.alloc(layout)
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        System.dealloc(ptr, layout)
    }
}

/// Global allocator that increments [`ALLOC_COUNT`] for each allocation.
#[global_allocator]
static A: CountingAlloc = CountingAlloc;

/// Ensure that [`fuzzy_match`] performs the same number of allocations as
/// calling [`fuzzy_score`] directly, guaranteeing that computing the pattern
/// length outside of [`fuzzy_score`] does not introduce extra allocations.
#[test]
#[ignore = "allocation counts vary when global state is initialized"]
fn fuzzy_match_allocations() {
    let pattern = "abc";
    // Warm up both functions to initialize any global state such as thread
    // pools so that only per-call allocations are measured below.
    let len = pattern.len();
    fuzzy_score(pattern, pattern, len);
    fuzzy_match(pattern, len, pattern);
    ALLOC_COUNT.store(0, Ordering::SeqCst);
    fuzzy_score(pattern, pattern, len);
    let score_allocs = ALLOC_COUNT.load(Ordering::SeqCst);
    ALLOC_COUNT.store(0, Ordering::SeqCst);
    fuzzy_match(pattern, len, pattern);
    let match_allocs = ALLOC_COUNT.load(Ordering::SeqCst);

    assert_eq!(
        match_allocs, score_allocs,
        "fuzzy_match should not allocate more than fuzzy_score"
    );
}
