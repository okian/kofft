use alloc::{string::String, vec, vec::Vec};

/// Maximum allowed length for either the pattern or text.
///
/// The Levenshtein algorithm is quadratic in the worst case.  Restricting the
/// inputs guards against excessive allocations and runaway runtimes that could
/// otherwise be triggered by untrusted data.
pub const MAX_INPUT_LENGTH: usize = 1024;

/// Divisor for determining the matching threshold.
///
/// A candidate is considered a match when the edit distance is less than or
/// equal to half the pattern length.  Exposing this divisor as a constant avoids
/// sprinkling the literal `2` throughout the code base.
pub const MATCH_THRESHOLD_DIVISOR: usize = 2;

/// Compute the Levenshtein distance between two strings.
///
/// `pattern_len` must be the number of UTF-8 code points in `pattern`.  The
/// text is collected once into a `Vec<char>` to allow indexed access while the
/// pattern is streamed directly, avoiding repeated scans and extra allocations.
///
/// # Panics
///
/// Panics if either input exceeds [`MAX_INPUT_LENGTH`].
pub fn fuzzy_score(pattern: &str, text: &str, pattern_len: usize) -> usize {
    let text_len = text.chars().count();

    if pattern_len > MAX_INPUT_LENGTH || text_len > MAX_INPUT_LENGTH {
        panic!(
            "input too long; maximum supported length is {}",
            MAX_INPUT_LENGTH
        );
    }

    let text_chars: Vec<char> = text.chars().collect();
    let text_len = text_chars.len();

    let mut prev: Vec<usize> = (0..=text_len).collect();
    let mut curr = vec![0; text_len + 1];

    for (i, pc) in pattern.chars().enumerate().take(pattern_len) {
        curr[0] = i + 1;
        for (j, &tc) in text_chars.iter().enumerate() {
            let cost = if pc == tc { 0 } else { 1 };
            let insertion = curr[j] + 1;
            let deletion = prev[j + 1] + 1;
            let substitution = prev[j] + cost;
            curr[j + 1] = insertion.min(deletion).min(substitution);
        }
        core::mem::swap(&mut prev, &mut curr);
    }

    prev[text_len]
}

/// Determine if two strings match within half the pattern length.
///
/// The caller must supply the pre-computed `pattern_len` to avoid rescanning
/// the pattern on repeated calls.
pub fn fuzzy_match(pattern: &str, pattern_len: usize, text: &str) -> bool {
    if pattern_len > MAX_INPUT_LENGTH {
        panic!(
            "pattern too long; maximum supported length is {}",
            MAX_INPUT_LENGTH
        );
    }

    fuzzy_score(pattern, text, pattern_len) <= pattern_len / MATCH_THRESHOLD_DIVISOR
}

/// Compute fuzzy scores for a batch of candidate strings.
///
/// `pattern_len` should be the length of `pattern` in UTF-8 code points,
/// pre-computed by the caller to avoid redundant work when scoring multiple
/// candidates.
pub fn fuzzy_scores(pattern: &str, pattern_len: usize, candidates: &[String]) -> Vec<usize> {
    candidates
        .iter()
        .map(|c| fuzzy_score(pattern, c, pattern_len))
        .collect()
}

#[cfg(test)]
/// Tests for the fuzzy matching utilities.
mod tests {
    use super::*;
    use alloc::format;

    /// Verify basic distance calculations with simple ASCII inputs.
    #[test]
    fn distance_basic() {
        let pattern = "abc";
        let pattern_len = pattern.chars().count();
        assert_eq!(fuzzy_score(pattern, "a-b-c", pattern_len), 2);
        assert_eq!(fuzzy_score(pattern, "abc", pattern_len), 0);
    }

    /// Ensure the match threshold uses the pre-computed pattern length.
    #[test]
    fn match_threshold() {
        let pattern = "abc";
        let pattern_len = pattern.chars().count();
        assert!(fuzzy_match(pattern, pattern_len, "ac"));
        assert!(!fuzzy_match(pattern, pattern_len, "xyz"));
    }

    /// Confirm batch scoring reuses the cached pattern length.
    #[test]
    fn batch_scores() {
        let pattern = "abc";
        let pattern_len = pattern.chars().count();
        let mut candidates: Vec<String> = (1..100).map(|i| format!("abc{0}", i)).collect();
        candidates.insert(0, String::from("abc"));
        let scores = fuzzy_scores(pattern, pattern_len, &candidates);
        assert_eq!(scores[0], 0);
        assert_eq!(scores.len(), 100);
    }

    /// Distances involving empty strings should reflect the other input's length.
    #[test]
    fn empty_strings() {
        let pattern = "";
        let pattern_len = pattern.chars().count();
        assert_eq!(fuzzy_score(pattern, "", pattern_len), 0);
        assert_eq!(fuzzy_score(pattern, "test", pattern_len), 4);
    }

    /// Unicode characters must be handled as full code points rather than bytes.
    #[test]
    fn unicode_handling() {
        let pattern = "naïve"; // contains an umlaut
        let pattern_len = pattern.chars().count();
        assert_eq!(fuzzy_score(pattern, "naive", pattern_len), 1);
    }

    /// Inputs exceeding the configured limit should trigger a panic.
    #[test]
    #[should_panic]
    fn long_input_panics() {
        let pattern = "a".repeat(MAX_INPUT_LENGTH + 1);
        let pattern_len = pattern.chars().count();
        let _ = fuzzy_score(&pattern, "", pattern_len);
    }

    /// Very long but permitted inputs should still compute a score.
    #[test]
    fn long_input_valid() {
        let pattern = "a".repeat(MAX_INPUT_LENGTH);
        let pattern_len = pattern.chars().count();
        assert_eq!(fuzzy_score(&pattern, &pattern, pattern_len), 0);
    }

    /// `fuzzy_match` must reject patterns that exceed the length limit.
    #[test]
    #[should_panic]
    fn fuzzy_match_panics_on_long_pattern() {
        let pattern = "a".repeat(MAX_INPUT_LENGTH + 1);
        let pattern_len = pattern.chars().count();
        let _ = fuzzy_match(&pattern, pattern_len, "");
    }
}
