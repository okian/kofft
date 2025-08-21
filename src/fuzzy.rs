use alloc::{string::String, vec, vec::Vec};

/// Divisor controlling the maximum allowed edit distance for a fuzzy match.
/// A candidate matches when its Levenshtein score is less than or equal to
/// `pattern_len / MAX_DISTANCE_DIVISOR`.
const MAX_DISTANCE_DIVISOR: usize = 2;

/// Compute the Levenshtein distance between two strings and return both the
/// distance score and the length of the pattern. Returning the length avoids
/// recomputing it in callers that also need it for threshold calculations.
pub fn fuzzy_score_with_len(pattern: &str, text: &str) -> (usize, usize) {
    if pattern.is_empty() {
        return (text.chars().count(), 0);
    }
    if text.is_empty() {
        let len = pattern.chars().count();
        return (len, len);
    }

    let pattern_chars: Vec<char> = pattern.chars().collect();
    let text_chars: Vec<char> = text.chars().collect();
    let text_len = text_chars.len();

    let mut prev: Vec<usize> = (0..=text_len).collect();
    let mut curr = vec![0; text_len + 1];

    for (i, &pc) in pattern_chars.iter().enumerate() {
        curr[0] = i + 1;
        for (j, &tc) in text_chars.iter().enumerate() {
            let cost = usize::from(pc != tc);
            let insertion = curr[j] + 1;
            let deletion = prev[j + 1] + 1;
            let substitution = prev[j] + cost;
            curr[j + 1] = insertion.min(deletion).min(substitution);
        }
        core::mem::swap(&mut prev, &mut curr);
    }

    (prev[text_len], pattern_chars.len())
}

/// Compute only the Levenshtein distance between two strings.
/// Lower scores indicate closer matches.
pub fn fuzzy_score(pattern: &str, text: &str) -> usize {
    fuzzy_score_with_len(pattern, text).0
}

/// Determine if two strings match within the permitted edit distance.
/// Uses a precomputed pattern length to avoid repeated scanning.
pub fn fuzzy_match(pattern: &str, text: &str) -> bool {
    let (score, pattern_len) = fuzzy_score_with_len(pattern, text);
    score <= pattern_len / MAX_DISTANCE_DIVISOR
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

    #[test]
    fn score_with_len_matches() {
        let (score, len) = fuzzy_score_with_len("kitten", "sitting");
        assert_eq!(score, fuzzy_score("kitten", "sitting"));
        assert_eq!(len, "kitten".chars().count());
    }

    #[test]
    fn very_long_pattern() {
        let long_pattern = "a".repeat(10_000);
        // Text deliberately short to keep runtime reasonable while exercising
        // the long-pattern code path.
        assert!(!fuzzy_match(&long_pattern, "b"));
    }
}
