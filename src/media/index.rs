//! Media index for song identification using metadata and BLAKE3 hashing.

use alloc::borrow::ToOwned;
use alloc::string::{String, ToString};
use std::fs::File;
use std::io::{Read, Result};
use std::path::{Path, PathBuf};

use hashbrown::HashMap;

/// Information about a song entry.
#[derive(Clone, Debug)]
pub struct SongEntry {
    /// Application-specific identifier for the song.
    pub id: String,
    /// Optional BLAKE3 hash of the audio file.
    pub hash: Option<String>,
    /// Original path used when inserting the song.
    pub path: Option<PathBuf>,
}

impl SongEntry {
    fn new(id: String) -> Self {
        Self {
            id,
            hash: None,
            path: None,
        }
    }
}

/// Index that stores songs by metadata and hash for hybrid lookup.
#[derive(Default)]
pub struct MediaIndex {
    by_name: HashMap<String, SongEntry>,
    by_hash: HashMap<String, String>,
}

impl MediaIndex {
    /// Create an empty index.
    pub fn new() -> Self {
        Self::default()
    }

    /// Insert a song using only filename metadata. Hashing is deferred until confirmation.
    pub fn add_metadata<N: Into<String>, I: Into<String>>(&mut self, name: N, id: I) {
        self.by_name.insert(name.into(), SongEntry::new(id.into()));
    }

    /// Insert a song and compute its BLAKE3 hash immediately.
    pub fn insert_with_hash(&mut self, path: &Path, id: &str) -> Result<()> {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .ok_or_else(|| std::io::Error::other("invalid filename"))?;
        let hash = hash_file(path)?;
        let entry = SongEntry {
            id: id.to_owned(),
            hash: Some(hash.clone()),
            path: Some(path.to_path_buf()),
        };
        self.by_name.insert(name, entry);
        self.by_hash.insert(hash, id.to_owned());
        Ok(())
    }

    /// Identify a song by metadata with optional hash confirmation.
    pub fn identify(&mut self, path: &Path, confirm: bool) -> Option<String> {
        let name = path.file_name()?.to_string_lossy().to_string();
        if let Some(entry) = self.by_name.get_mut(&name) {
            if confirm && entry.hash.is_none() {
                if let Ok(hash) = hash_file(path) {
                    entry.hash = Some(hash.clone());
                    self.by_hash.insert(hash, entry.id.clone());
                }
            }
            return Some(entry.id.clone());
        }
        if let Ok(hash) = hash_file(path) {
            if let Some(id) = self.by_hash.get(&hash).cloned() {
                self.by_name.insert(
                    name,
                    SongEntry {
                        id: id.clone(),
                        hash: Some(hash),
                        path: Some(path.to_path_buf()),
                    },
                );
                return Some(id);
            }
        }
        None
    }

    /// Retrieve the stored hash for a given filename.
    pub fn hash_for_name(&self, name: &str) -> Option<&str> {
        self.by_name
            .get(name)
            .and_then(|entry| entry.hash.as_deref())
    }

    /// Number of hashes stored. Used for tests.
    pub fn hash_count(&self) -> usize {
        self.by_hash.len()
    }
}

fn hash_file(path: &Path) -> Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = blake3::Hasher::new();
    let mut buf = [0u8; 4096];
    loop {
        let read = file.read(&mut buf)?;
        if read == 0 {
            break;
        }
        hasher.update(&buf[..read]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}
