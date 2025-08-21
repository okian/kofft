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
// Compile-time verification that the buffer size is non-zero. A zero-sized
// buffer would cause hashing to fail and is therefore rejected at build time.
const _: () = {
    assert!(HASH_BUF_SIZE > 0, "HASH_BUF_SIZE must be greater than zero");
};

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
///
/// The identifier currently stores the canonical path to the song file.
/// Additional metadata may be added in the future if needed.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct SongId(PathBuf);

#[cfg(feature = "std")]
/// Index mapping metadata and hashes to song identifiers.
///
/// This structure maintains two lookup tables: one keyed by file name metadata
/// and another keyed by BLAKE3 hashes of file contents.
#[derive(Default)]
pub struct SongIndex {
    /// Map from file name (metadata) to song identifier.
    by_name: HashMap<String, SongId>,
    /// Map from BLAKE3 hash to song identifier.
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
    pub fn hash_file_with_buffer(path: &Path, buf: &mut [u8]) -> io::Result<[u8; 32]> {
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

    /// Extract a UTF-8 file name from a path.
    ///
    /// Returns [`io::ErrorKind::InvalidInput`] if the path does not terminate
    /// in a valid UTF-8 file name.
    fn file_name_str(path: &Path) -> io::Result<&str> {
        path.file_name()
            .and_then(|s| s.to_str())
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "invalid file name"))
    }

    /// Add a song to the index, computing its hash and storing it by name and hash.
    pub fn index_song(&mut self, path: &Path) -> io::Result<SongId> {
        let hash = Self::hash_file(path)?;
        let id = SongId(path.to_path_buf());
        if let Ok(name) = Self::file_name_str(path) {
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
        if let Ok(name) = Self::file_name_str(path) {
            if let Some(id) = self.by_name.get(name) {
                return Ok(id.clone());
            }
        }
        let hash = Self::hash_file(path)?;
        if let Some(id) = self.by_hash.get(&hash) {
            return Ok(id.clone());
        }
        let id = SongId(path.to_path_buf());
        if let Ok(name) = Self::file_name_str(path) {
            self.by_name.insert(name.to_string(), id.clone());
        }
        self.by_hash.insert(hash, id.clone());
        Ok(id)
    }
}
