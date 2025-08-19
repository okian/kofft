use alloc::{string::String, vec, vec::Vec};

/// Compute the Levenshtein distance between two strings.
/// Lower scores indicate closer matches.
pub fn fuzzy_score(pattern: &str, text: &str) -> usize {
    let mut prev: Vec<usize> = (0..=text.chars().count()).collect();
    let mut curr = vec![0; text.chars().count() + 1];
    for (i, pc) in pattern.chars().enumerate() {
        curr[0] = i + 1;
        for (j, tc) in text.chars().enumerate() {
            let cost = if pc == tc { 0 } else { 1 };
            let insertion = curr[j] + 1;
            let deletion = prev[j + 1] + 1;
            let substitution = prev[j] + cost;
            curr[j + 1] = insertion.min(deletion).min(substitution);
        }
        prev.clone_from_slice(&curr);
    }
    prev[text.chars().count()]
}

/// Determine if two strings match within half the pattern length.
pub fn fuzzy_match(pattern: &str, text: &str) -> bool {
    fuzzy_score(pattern, text) <= pattern.chars().count() / 2
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
