use alloc::{string::String, vec, vec::Vec};

/// Divisor used to determine the maximum allowed edit distance as a fraction
/// of the pattern length. A value of `2` restricts matches to an edit distance
/// of at most half the pattern length.
const MATCH_THRESHOLD_DIVISOR: usize = 2;

/// Compute the Levenshtein distance between two strings.
///
/// Lower scores indicate closer matches.
///
/// # Complexity
/// - Time: `O(p * t)` where `p` is the pattern length and `t` is the text length.
/// - Space: `O(t)` for the dynamic programming rows.
pub fn fuzzy_score(pattern: &str, text: &str) -> usize {
    let pattern_chars: Vec<char> = pattern.chars().collect();
    let text_chars: Vec<char> = text.chars().collect();
    let text_len = text_chars.len();

    let mut prev: Vec<usize> = (0..=text_len).collect();
    let mut curr = vec![0; text_len + 1];

    for (i, &pc) in pattern_chars.iter().enumerate() {
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

/// Determine if two strings are similar enough that the edit distance does not
/// exceed half the pattern length. The pattern length is computed once and
/// reused to avoid redundant iteration.
///
/// # Complexity
/// - Time: `O(p * t)` delegated to [`fuzzy_score`].
/// - Space: `O(t)` delegated to [`fuzzy_score`].
pub fn fuzzy_match(pattern: &str, text: &str) -> bool {
    let len = pattern.chars().count();
    fuzzy_score(pattern, text) <= len / MATCH_THRESHOLD_DIVISOR
}

/// Compute fuzzy scores for a batch of candidate strings.
///
/// # Complexity
/// - Time: `O(n * p * t)` where `n` is the number of candidates.
/// - Space: `O(n)` for the resulting vector plus `O(t)` per call to
///   [`fuzzy_score`].
pub fn fuzzy_scores(pattern: &str, candidates: &[String]) -> Vec<usize> {
    candidates.iter().map(|c| fuzzy_score(pattern, c)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::format;

    /// Validate basic Levenshtein distance cases.
    #[test]
    fn distance_basic() {
        assert_eq!(fuzzy_score("abc", "a-b-c"), 2);
        assert_eq!(fuzzy_score("abc", "abc"), 0);
    }

    /// Ensure the matching threshold correctly filters distant strings.
    #[test]
    fn match_threshold() {
        assert!(fuzzy_match("abc", "ac"));
        assert!(!fuzzy_match("abc", "xyz"));
    }

    /// Check batch scoring of multiple candidates.
    #[test]
    fn batch_scores() {
        let mut candidates: Vec<String> = (1..100).map(|i| format!("abc{0}", i)).collect();
        candidates.insert(0, String::from("abc"));
        let scores = fuzzy_scores("abc", &candidates);
        assert_eq!(scores[0], 0);
        assert_eq!(scores.len(), 100);
    }
}
