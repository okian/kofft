//! Song identification index using filename metadata and BLAKE3 hashes.
//!
//! This module provides a hybrid lookup strategy that first attempts to
//! identify songs by metadata such as file name. Only if metadata lookup fails
//! does it compute a BLAKE3 hash of the file to confirm identity or add a new
//! entry.

#[cfg(feature = "std")]
/// Default buffer size, in bytes, used when hashing files.
///
/// A larger buffer may improve I/O throughput at the cost of stack space.
/// Adjust this constant if profiling indicates different tuning is required
/// for your target environment.
pub const HASH_BUF_SIZE: usize = 8192;

#[cfg(feature = "std")]
use std::collections::HashMap;
#[cfg(feature = "std")]
use std::fs::File;
#[cfg(feature = "std")]
use std::io::{self, Read};
#[cfg(feature = "std")]
use std::path::{Path, PathBuf};
#[cfg(feature = "std")]
use std::string::{String, ToString};

#[cfg(feature = "std")]
/// Unique identifier for a song.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct SongId(PathBuf);

#[cfg(feature = "std")]
/// Index mapping metadata and hashes to song identifiers.
#[derive(Default)]
pub struct SongIndex {
    by_name: HashMap<String, SongId>,
    by_hash: HashMap<[u8; 32], SongId>,
}

#[cfg(feature = "std")]
impl SongIndex {
    /// Create an empty [`SongIndex`].
    pub fn new() -> Self {
        Self::default()
    }

    /// Compute the BLAKE3 hash of a file using the default buffer size
    /// [`HASH_BUF_SIZE`].
    fn hash_file(path: &Path) -> io::Result<[u8; 32]> {
        let mut buf = [0u8; HASH_BUF_SIZE];
        Self::hash_file_with_buffer(path, &mut buf)
    }

    /// Compute the BLAKE3 hash of a file using the caller-provided buffer.
    ///
    /// Supplying a custom buffer allows tuning of I/O performance for
    /// different environments while avoiding repeated allocations.
    ///
    /// # Errors
    /// Returns an [`io::Error`] with [`io::ErrorKind::InvalidInput`] if the
    /// provided buffer is empty or if reading the file fails.
    fn hash_file_with_buffer(path: &Path, buf: &mut [u8]) -> io::Result<[u8; 32]> {
        if buf.is_empty() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "buffer must not be empty",
            ));
        }

        let mut file = File::open(path)?;
        let mut hasher = blake3::Hasher::new();
        loop {
            let n = file.read(buf)?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
        }
        Ok(*hasher.finalize().as_bytes())
    }

    /// Add a song to the index, computing its hash and storing it by name and hash.
    pub fn index_song(&mut self, path: &Path) -> io::Result<SongId> {
        let hash = Self::hash_file(path)?;
        let id = SongId(path.to_path_buf());
        if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
            self.by_name.insert(name.to_string(), id.clone());
        }
        self.by_hash.insert(hash, id.clone());
        Ok(id)
    }

    /// Identify a song, preferring metadata lookup before hashing.
    ///
    /// If the file name matches an existing entry, the song is returned
    /// without hashing. Otherwise, a BLAKE3 hash is computed and used for
    /// lookup. If still not found, the song is hashed and added to the index.
    pub fn identify(&mut self, path: &Path) -> io::Result<SongId> {
        if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
            if let Some(id) = self.by_name.get(name) {
                return Ok(id.clone());
            }
        }
        let hash = Self::hash_file(path)?;
        if let Some(id) = self.by_hash.get(&hash) {
            return Ok(id.clone());
        }
        let id = SongId(path.to_path_buf());
        if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
            self.by_name.insert(name.to_string(), id.clone());
        }
        self.by_hash.insert(hash, id.clone());
        Ok(id)
    }
}

#[cfg(all(feature = "std", test))]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn metadata_lookup_skips_hash() {
        let mut idx = SongIndex::new();
        let mut file = NamedTempFile::new().unwrap();
        writeln!(file, "song").unwrap();
        let path = file.path().to_path_buf();
        idx.index_song(&path).unwrap();
        // Remove the file to ensure identify does not attempt to hash
        std::fs::remove_file(&path).unwrap();
        let id = idx.identify(&path).unwrap();
        assert_eq!(id, SongId(path));
    }

    #[test]
    fn hash_lookup_identifies_same_content() {
        let mut idx = SongIndex::new();
        let mut f1 = NamedTempFile::new().unwrap();
        f1.write_all(b"data").unwrap();
        let p1 = f1.path().to_path_buf();
        let id1 = idx.index_song(&p1).unwrap();

        let mut f2 = NamedTempFile::new().unwrap();
        f2.write_all(b"data").unwrap();
        let p2 = f2.path().to_path_buf();
        let id2 = idx.identify(&p2).unwrap();
        assert_eq!(id1, id2);
    }

    #[test]
    fn hash_lookup_inserts_new_entry() {
        let mut idx = SongIndex::new();
        let mut f = NamedTempFile::new().unwrap();
        f.write_all(b"unique").unwrap();
        let p = f.path().to_path_buf();
        let id1 = idx.identify(&p).unwrap();
        // Subsequent lookup should use metadata
        std::fs::remove_file(&p).unwrap();
        let id2 = idx.identify(&p).unwrap();
        assert_eq!(id1, id2);
    }

    #[test]
    fn empty_buffer_errors() {
        let mut idx = SongIndex::new();
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(b"data").unwrap();
        let mut buf: [u8; 0] = [];
        assert!(SongIndex::hash_file_with_buffer(file.path(), &mut buf).is_err());
        // ensure normal hashing still works after error case
        assert!(idx.index_song(file.path()).is_ok());
    }
}
