//! Waveform caching and retrieval for media playback.
//!
//! This module provides a simple API to cache per-track waveform snapshots
//! in a SQLite database. Cached waveforms are loaded on demand during
//! playback, falling back to on-the-fly generation when no cached data is
//! available.

use rusqlite::{params, Connection};
use std::{error::Error, fmt, vec::Vec};

/// Default number of audio samples aggregated into one waveform point.
///
/// A value of `100` offers a reasonable compromise between time resolution
/// and computational overhead. At a sample rate of 44.1 kHz this represents
/// roughly 2.3 ms of audio per point, which is typically sufficient for
/// visualization while keeping processing inexpensive.
pub const DEFAULT_WAVEFORM_WINDOW: usize = 100;

/// Errors that can occur during waveform caching or generation.
#[derive(Debug)]
pub enum PlaybackError {
    /// The configured waveform window size was zero.
    InvalidWaveformWindow,
    /// An error bubbled up from the underlying SQLite database.
    Database(rusqlite::Error),
}

impl fmt::Display for PlaybackError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PlaybackError::InvalidWaveformWindow => {
                write!(f, "waveform window must be greater than zero")
            }
            PlaybackError::Database(e) => write!(f, "database error: {e}"),
        }
    }
}

impl Error for PlaybackError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            PlaybackError::Database(e) => Some(e),
            _ => None,
        }
    }
}

impl From<rusqlite::Error> for PlaybackError {
    fn from(e: rusqlite::Error) -> Self {
        PlaybackError::Database(e)
    }
}

/// Initialize the waveform cache database schema.
///
/// Returns an error if the underlying SQLite operations fail.
pub fn init_db(conn: &Connection) -> Result<(), PlaybackError> {
    conn.execute_batch(include_str!("waveform_schema.sql"))?;
    Ok(())
}

/// Store a waveform snapshot for the given track identifier.
///
/// Fails if the database write cannot be completed.
fn store_waveform(
    conn: &Connection,
    track_id: &str,
    waveform: &[f32],
) -> Result<(), PlaybackError> {
    let bytes = waveform_as_bytes(waveform);
    conn.execute(
        "INSERT OR REPLACE INTO waveform_samples (track_id, samples) VALUES (?1, ?2)",
        params![track_id, bytes],
    )?;
    Ok(())
}

/// Attempt to load a cached waveform snapshot.
///
/// Returns `Ok(None)` when no cached waveform exists.
fn load_waveform(conn: &Connection, track_id: &str) -> Result<Option<Vec<f32>>, PlaybackError> {
    let mut stmt = conn.prepare("SELECT samples FROM waveform_samples WHERE track_id = ?1")?;
    let mut rows = stmt.query(params![track_id])?;
    if let Some(row) = rows.next()? {
        let blob: Vec<u8> = row.get(0)?;
        Ok(Some(bytes_to_waveform(&blob)))
    } else {
        Ok(None)
    }
}

/// Get the waveform snapshot for a track, generating and caching it if necessary.
///
/// Fails if database operations fail or if waveform generation parameters are invalid.
pub fn get_or_generate_waveform(
    conn: &Connection,
    track_id: &str,
    audio: &[f32],
) -> Result<Vec<f32>, PlaybackError> {
    if let Some(cached) = load_waveform(conn, track_id)? {
        return Ok(cached);
    }
    let waveform = generate_waveform(audio)?;
    store_waveform(conn, track_id, &waveform)?;
    Ok(waveform)
}

/// Simple waveform generation by averaging absolute amplitudes over
/// `DEFAULT_WAVEFORM_WINDOW` sized windows.
fn generate_waveform(audio: &[f32]) -> Result<Vec<f32>, PlaybackError> {
    generate_waveform_with_window(DEFAULT_WAVEFORM_WINDOW, audio)
}

/// Internal helper performing waveform generation for an arbitrary window size.
///
/// This facilitates testing of edge cases such as zero-sized windows.
fn generate_waveform_with_window(window: usize, audio: &[f32]) -> Result<Vec<f32>, PlaybackError> {
    if window == 0 {
        return Err(PlaybackError::InvalidWaveformWindow);
    }
    Ok(audio
        .chunks(window)
        .map(|chunk| chunk.iter().map(|v| v.abs()).sum::<f32>() / chunk.len() as f32)
        .collect())
}

/// Convert a waveform slice into a byte vector for database storage.
fn waveform_as_bytes(waveform: &[f32]) -> Vec<u8> {
    waveform.iter().flat_map(|f| f.to_le_bytes()).collect()
}

/// Reconstruct a waveform from its byte representation loaded from the database.
fn bytes_to_waveform(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;

    /// Prepare an in-memory database initialized with the waveform schema.
    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn
    }

    /// Ensure that generated waveforms are cached and retrieved on subsequent calls.
    #[test]
    fn generates_and_caches_waveform() {
        let conn = setup();
        let audio = vec![0.5f32; 200];
        let wf1 = get_or_generate_waveform(&conn, "track", &audio).unwrap();
        // Second call should retrieve from cache
        let wf2 = get_or_generate_waveform(&conn, "track", &audio).unwrap();
        assert_eq!(wf1, wf2);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM waveform_samples", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    /// Cached waveform should be returned even if no audio samples are supplied.
    #[test]
    fn returns_cached_waveform_without_audio() {
        let conn = setup();
        let audio = vec![0.1f32; 300];
        let wf1 = get_or_generate_waveform(&conn, "song", &audio).unwrap();
        // Provide empty audio to ensure cached result is used
        let wf2 = get_or_generate_waveform(&conn, "song", &[]).unwrap();
        assert_eq!(wf1, wf2);
    }

    /// Verifies that zero-sized windows are rejected to avoid division by zero.
    #[test]
    fn rejects_zero_window() {
        let audio = vec![0.1f32; 10];
        let err = generate_waveform_with_window(0, &audio).unwrap_err();
        assert!(matches!(err, PlaybackError::InvalidWaveformWindow));
    }
}
