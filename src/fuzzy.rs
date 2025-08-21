use alloc::{string::String, vec, vec::Vec};

/// Errors that can occur during fuzzy matching operations.
///
/// The functions in this module perform strict validation of their inputs and
/// return these errors rather than panicking, allowing callers to handle
/// invalid conditions gracefully.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FuzzyError {
    /// The supplied length for `pattern` does not match its UTF-8 code point
    /// count.  Callers must pre-compute the pattern length and pass it
    /// consistently to avoid redundant scans; mismatches are treated as usage
    /// errors and reported with this variant.
    InvalidLength,
    /// Either `pattern` or `text` exceeds [`MAX_INPUT_LENGTH`].  Limiting input
    /// size prevents excessive allocations from quadratic-time Levenshtein
    /// computations.
    InputTooLong,
}

#[cfg(feature = "std")]
impl std::error::Error for FuzzyError {}

impl core::fmt::Display for FuzzyError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            FuzzyError::InvalidLength => f.write_str("pattern length mismatch"),
            FuzzyError::InputTooLong => {
                write!(f, "input exceeds MAX_INPUT_LENGTH ({})", MAX_INPUT_LENGTH)
            }
        }
    }
}

/// Maximum allowed length for either the pattern or text.
///
/// The Levenshtein algorithm has quadratic complexity in the lengths of the
/// inputs.  Limiting those lengths prevents hostile or accidental oversized
/// values from causing excessive allocations or runtime blowups.
pub const MAX_INPUT_LENGTH: usize = 1024;

/// Divisor for determining the matching threshold.
///
/// A candidate is considered a match when the edit distance is less than or
/// equal to half the pattern length.  Exposing this divisor as a constant avoids
/// sprinkling the literal `2` throughout the code base and documents the scoring
/// policy in one place.
pub const MATCH_THRESHOLD_DIVISOR: usize = 2;

/// Compute the Levenshtein distance between two UTF-8 strings.
///
/// * `pattern` - Pattern string to compare against.
/// * `text` - Candidate string.
/// * `pattern_len` - Number of UTF-8 code points in `pattern` computed by the
///   caller.  Passing this value avoids rescanning the pattern when scoring many
///   candidates.
///
/// The implementation decodes the inputs into `Vec<char>` once to avoid
/// repeatedly traversing the UTF-8 data.  Early returns handle empty inputs
/// without performing any allocations.
///
/// # Errors
///
/// Returns [`FuzzyError::InvalidLength`] if `pattern_len` does not equal the
/// number of UTF-8 code points in `pattern`, or [`FuzzyError::InputTooLong`] if
/// either input exceeds [`MAX_INPUT_LENGTH`].
pub fn fuzzy_score(pattern: &str, text: &str, pattern_len: usize) -> Result<usize, FuzzyError> {
    let pattern_chars: Vec<char> = pattern.chars().collect();
    let actual_pattern_len = pattern_chars.len();

    if actual_pattern_len != pattern_len {
        return Err(FuzzyError::InvalidLength);
    }

    // Count characters without allocating to keep memory usage minimal.
    let text_len = text.chars().count();

    if actual_pattern_len > MAX_INPUT_LENGTH || text_len > MAX_INPUT_LENGTH {
        return Err(FuzzyError::InputTooLong);
    }
    if pattern_len == 0 {
        return Ok(text_len);
    }
    if text_len == 0 {
        return Ok(pattern_len);
    }

    let text_chars: Vec<char> = text.chars().collect();
    let text_len = text_chars.len();
    let mut prev: Vec<usize> = (0..=text_len).collect();
    let mut curr = vec![0; text_len + 1];

    for (i, &pc) in pattern_chars.iter().take(pattern_len).enumerate() {
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

    Ok(prev[text_len])
}

/// Determine if two strings match within half the pattern length.
///
/// The caller must supply the pre-computed `pattern_len` to avoid rescanning
/// the pattern on repeated calls.  This function delegates to [`fuzzy_score`]
/// for the heavy lifting and simply compares the resulting distance against the
/// threshold defined by [`MATCH_THRESHOLD_DIVISOR`].
pub fn fuzzy_match(pattern: &str, pattern_len: usize, text: &str) -> Result<bool, FuzzyError> {
    let score = fuzzy_score(pattern, text, pattern_len)?;
    Ok(score <= pattern_len / MATCH_THRESHOLD_DIVISOR)
}

/// Compute fuzzy scores for a batch of candidate strings.
///
/// `pattern_len` should be the length of `pattern` in UTF-8 code points,
/// pre-computed by the caller to avoid redundant work when scoring multiple
/// candidates.  The function simply maps [`fuzzy_score`] over the supplied
/// candidates and aggregates the results.  If any candidate fails validation,
/// the first error is returned immediately.
pub fn fuzzy_scores(
    pattern: &str,
    pattern_len: usize,
    candidates: &[String],
) -> Result<Vec<usize>, FuzzyError> {
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
        assert_eq!(fuzzy_score(pattern, "a-b-c", pattern_len).unwrap(), 2);
        assert_eq!(fuzzy_score(pattern, "abc", pattern_len).unwrap(), 0);
    }

    /// Ensure the match threshold uses the pre-computed pattern length.
    #[test]
    fn match_threshold() {
        let pattern = "abc";
        let pattern_len = pattern.chars().count();
        assert!(fuzzy_match(pattern, pattern_len, "ac").unwrap());
        assert!(!fuzzy_match(pattern, pattern_len, "xyz").unwrap());
    }

    /// Confirm batch scoring reuses the cached pattern length.
    #[test]
    fn batch_scores() {
        let pattern = "abc";
        let pattern_len = pattern.chars().count();
        let mut candidates: Vec<String> = (1..100).map(|i| format!("abc{0}", i)).collect();
        candidates.insert(0, String::from("abc"));
        let scores = fuzzy_scores(pattern, pattern_len, &candidates).unwrap();
        assert_eq!(scores[0], 0);
        assert_eq!(scores.len(), 100);
    }

    /// Distances involving empty strings should reflect the other input's length.
    #[test]
    fn empty_strings() {
        let pattern = "";
        let pattern_len = pattern.chars().count();
        assert_eq!(fuzzy_score(pattern, "", pattern_len).unwrap(), 0);
        assert_eq!(fuzzy_score(pattern, "test", pattern_len).unwrap(), 4);
    }

    /// Unicode characters must be handled as full code points rather than bytes.
    #[test]
    fn unicode_handling() {
        let pattern = "naïve"; // contains an umlaut
        let pattern_len = pattern.chars().count();
        assert_eq!(fuzzy_score(pattern, "naive", pattern_len).unwrap(), 1);
    }

    /// Inputs exceeding the configured limit should return an error rather than panic.
    #[test]
    fn long_input_error() {
        let pattern = "a".repeat(MAX_INPUT_LENGTH + 1);
        let pattern_len = pattern.chars().count();
        let err = fuzzy_score(&pattern, "", pattern_len).unwrap_err();
        assert_eq!(err, FuzzyError::InputTooLong);
    }

    /// Inputs with overly long text should also return an error.
    #[test]
    fn long_text_error() {
        let text = "a".repeat(MAX_INPUT_LENGTH + 1);
        let pattern = "a";
        let pattern_len = pattern.chars().count();
        let err = fuzzy_score(pattern, &text, pattern_len).unwrap_err();
        assert_eq!(err, FuzzyError::InputTooLong);
    }

    /// Very long but permitted inputs should still compute a score.
    #[test]
    fn long_input_valid() {
        let pattern = "a".repeat(MAX_INPUT_LENGTH);
        let pattern_len = pattern.chars().count();
        assert_eq!(fuzzy_score(&pattern, &pattern, pattern_len).unwrap(), 0);
    }

    /// `fuzzy_match` must reject patterns that exceed the length limit.
    #[test]
    fn fuzzy_match_long_pattern_error() {
        let pattern = "a".repeat(MAX_INPUT_LENGTH + 1);
        let pattern_len = pattern.chars().count();
        let err = fuzzy_match(&pattern, pattern_len, "").unwrap_err();
        assert_eq!(err, FuzzyError::InputTooLong);
    }

    /// Supplying an incorrect pre-computed length should yield an error.
    #[test]
    fn invalid_length_error() {
        let pattern = "abc";
        let pattern_len = pattern.chars().count() + 1;
        let err = fuzzy_score(pattern, "abc", pattern_len).unwrap_err();
        assert_eq!(err, FuzzyError::InvalidLength);
    }

    /// `fuzzy_match` should propagate length mismatches from `fuzzy_score`.
    #[test]
    fn fuzzy_match_invalid_length_error() {
        let pattern = "abc";
        let pattern_len = pattern.chars().count() + 1;
        let err = fuzzy_match(pattern, pattern_len, "abc").unwrap_err();
        assert_eq!(err, FuzzyError::InvalidLength);
    }

    /// `fuzzy_scores` must return the first error encountered.
    #[test]
    fn fuzzy_scores_error_propagation() {
        let pattern = "abc";
        let pattern_len = pattern.chars().count();
        // Include an invalid candidate exceeding the maximum length.
        let mut candidates: Vec<String> = vec!["a".repeat(MAX_INPUT_LENGTH + 1)];
        candidates.push(String::from("abc"));
        let err = fuzzy_scores(pattern, pattern_len, &candidates).unwrap_err();
        assert_eq!(err, FuzzyError::InputTooLong);
    }
}
