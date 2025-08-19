use std::io::Write;
use std::path::PathBuf;

use kofft::media::MediaIndex;
use tempfile::NamedTempFile;

#[test]
fn metadata_lookup_without_hash_then_confirm() {
    let mut index = MediaIndex::new();
    let mut file = NamedTempFile::new().unwrap();
    writeln!(file, "hello world").unwrap();
    let path = file.into_temp_path();
    let name = path.file_name().unwrap().to_string_lossy().to_string();
    index.add_metadata(name.clone(), "song1");

    // Lookup using metadata only
    let id = index.identify(&path, false);
    assert_eq!(id.as_deref(), Some("song1"));
    assert_eq!(index.hash_count(), 0);
    assert!(index.hash_for_name(&name).is_none());

    // Now confirm to populate hash
    let id = index.identify(&path, true);
    assert_eq!(id.as_deref(), Some("song1"));
    assert_eq!(index.hash_count(), 1);
    assert!(index.hash_for_name(&name).is_some());
}

#[test]
fn hash_fallback_lookup() {
    let mut index = MediaIndex::new();

    // Create original file and insert with hash
    let mut orig = NamedTempFile::new().unwrap();
    writeln!(orig, "same content").unwrap();
    let orig_path = orig.into_temp_path();
    index.insert_with_hash(&orig_path, "track").unwrap();

    // Copy to new file with different name
    let mut new_path = PathBuf::from(orig_path.parent().unwrap());
    new_path.push("other_name.tmp");
    std::fs::copy(&orig_path, &new_path).unwrap();

    // Lookup should require hashing and populate metadata
    let id = index.identify(&new_path, false);
    assert_eq!(id.as_deref(), Some("track"));
    let new_name = new_path.file_name().unwrap().to_string_lossy().to_string();
    assert!(index.hash_for_name(&new_name).is_some());
}
