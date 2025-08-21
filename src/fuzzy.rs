use alloc::{string::String, vec, vec::Vec};

/// Divider for the fuzzy match threshold.
/// A candidate is considered a match when its edit distance
/// is no greater than half the pattern length. This constant
/// avoids magic numbers and makes the threshold explicit.
const MATCH_THRESHOLD_DIVISOR: usize = 2;

/// Compute the Levenshtein distance between two strings.
/// Lower scores indicate closer matches.
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

/// Determine if two strings match within half the pattern length.
///
/// The pattern length is computed once to avoid the cost of
/// iterating over the pattern multiple times. This improves
/// performance when matching repeatedly against the same pattern.
pub fn fuzzy_match(pattern: &str, text: &str) -> bool {
    let pattern_len = pattern.chars().count();
    fuzzy_score(pattern, text) <= pattern_len / MATCH_THRESHOLD_DIVISOR
}

/// Compute fuzzy scores for a batch of candidate strings.
pub fn fuzzy_scores(pattern: &str, candidates: &[String]) -> Vec<usize> {
    candidates.iter().map(|c| fuzzy_score(pattern, c)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::format;

    #[test]
    fn distance_basic() {
        assert_eq!(fuzzy_score("abc", "a-b-c"), 2);
        assert_eq!(fuzzy_score("abc", "abc"), 0);
    }

    #[test]
    fn match_threshold() {
        assert!(fuzzy_match("abc", "ac"));
        assert!(!fuzzy_match("abc", "xyz"));
    }

    #[test]
    fn batch_scores() {
        let mut candidates: Vec<String> = (1..100).map(|i| format!("abc{0}", i)).collect();
        candidates.insert(0, String::from("abc"));
        let scores = fuzzy_scores("abc", &candidates);
        assert_eq!(scores[0], 0);
        assert_eq!(scores.len(), 100);
    }
}
