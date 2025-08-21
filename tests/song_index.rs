use kofft::media::index::SongIndex;
use std::io::Write;
use std::path::PathBuf;
use tempfile::NamedTempFile;

/// Sample content used across tests.
const SONG_DATA: &[u8] = b"data";

/// Index a song then identify it using only metadata after the file is removed.
#[test]
fn metadata_only_identification() {
    let mut idx = SongIndex::new();
    let mut file = NamedTempFile::new().expect("create temp file");
    file.write_all(SONG_DATA).expect("write data");
    let path = file.path().to_path_buf();
    let id = idx.index_song(&path).expect("index song");
    std::fs::remove_file(&path).expect("remove file");
    let id2 = idx.identify(&path).expect("identify by metadata");
    assert_eq!(id, id2);
}

/// Identify a song using only its hash when metadata lookup fails.
#[test]
fn hash_only_identification() {
    let mut idx = SongIndex::new();
    let mut f1 = NamedTempFile::new().expect("create first file");
    f1.write_all(SONG_DATA).expect("write first content");
    let p1 = f1.path().to_path_buf();
    let id1 = idx.index_song(&p1).expect("index first song");

    let mut f2 = NamedTempFile::new().expect("create second file");
    f2.write_all(SONG_DATA).expect("write second content");
    let p2 = f2.path().to_path_buf();
    let id2 = idx.identify(&p2).expect("identify by hash");
    assert_eq!(id1, id2);
}

/// Ensure hashing rejects zero-length buffers.
#[test]
fn empty_buffer_rejected() {
    let mut file = NamedTempFile::new().expect("create file");
    file.write_all(SONG_DATA).expect("write data");
    // Use an explicit empty Vec<u8> as buffer for clarity.
    let mut buf: Vec<u8> = Vec::with_capacity(0);
    assert!(SongIndex::hash_file_with_buffer(file.path(), &mut buf).is_err());
}

/// Calls to `identify` should fail fast on nonexistent paths.
#[test]
fn invalid_path_errors() {
    let path: PathBuf = {
        let tmp = NamedTempFile::new().expect("create temp");
        tmp.path().to_path_buf()
    }; // `tmp` is dropped here, deleting the file.
    let mut idx = SongIndex::new();
    assert!(idx.identify(&path).is_err());
}
