use kofft::fuzzy::{fuzzy_match, fuzzy_score};

/// Candidates within the threshold should be reported as matches.
#[test]
fn close_match_succeeds() {
    let pattern = "kitten";
    let pattern_len = pattern.chars().count();
    assert!(fuzzy_match(pattern, pattern_len, "kittin").unwrap()); // distance 1
    assert_eq!(fuzzy_score(pattern, "kittin", pattern_len).unwrap(), 1);
}

/// Candidates beyond the threshold must be rejected.
#[test]
fn distant_match_fails() {
    let pattern = "kitten";
    let pattern_len = pattern.chars().count();
    assert!(!fuzzy_match(pattern, pattern_len, "puppy").unwrap());
    assert!(fuzzy_score(pattern, "puppy", pattern_len).unwrap() > pattern_len / 2);
}

/// Non-ASCII characters should be handled as full code points.
#[test]
fn unicode_strings() {
    let pattern = "naïve";
    let pattern_len = pattern.chars().count();
    assert!(fuzzy_match(pattern, pattern_len, "naive").unwrap());
    assert_eq!(fuzzy_score(pattern, "naive", pattern_len).unwrap(), 1);
}
