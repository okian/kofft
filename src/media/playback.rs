//! Waveform caching and retrieval for media playback.
//!
//! This module provides a simple API to cache per-track waveform snapshots
//! in a SQLite database. Cached waveforms are loaded on demand during
//! playback, falling back to on-the-fly generation when no cached data is
//! available.

use rusqlite::{params, Connection};
use std::vec::Vec;

/// Initialize the waveform cache database schema.
pub fn init_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(include_str!("waveform_schema.sql"))?;
    Ok(())
}

/// Store a waveform snapshot for the given track identifier.
fn store_waveform(conn: &Connection, track_id: &str, waveform: &[f32]) -> rusqlite::Result<()> {
    let bytes = waveform_as_bytes(waveform);
    conn.execute(
        "INSERT OR REPLACE INTO waveform_samples (track_id, samples) VALUES (?1, ?2)",
        params![track_id, bytes],
    )?;
    Ok(())
}

/// Attempt to load a cached waveform snapshot.
fn load_waveform(conn: &Connection, track_id: &str) -> rusqlite::Result<Option<Vec<f32>>> {
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
pub fn get_or_generate_waveform(
    conn: &Connection,
    track_id: &str,
    audio: &[f32],
) -> rusqlite::Result<Vec<f32>> {
    if let Some(cached) = load_waveform(conn, track_id)? {
        return Ok(cached);
    }
    let waveform = generate_waveform(audio);
    store_waveform(conn, track_id, &waveform)?;
    Ok(waveform)
}

/// Simple waveform generation by averaging absolute amplitudes over windows of 100 samples.
fn generate_waveform(audio: &[f32]) -> Vec<f32> {
    let window = 100;
    audio
        .chunks(window)
        .map(|chunk| chunk.iter().map(|v| v.abs()).sum::<f32>() / chunk.len() as f32)
        .collect()
}

fn waveform_as_bytes(waveform: &[f32]) -> Vec<u8> {
    waveform.iter().flat_map(|f| f.to_le_bytes()).collect()
}

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

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn
    }

    #[test]
    fn generates_and_caches_waveform() {
        let conn = setup();
        let audio = vec![0.5f32; 200];
        let wf1 = get_or_generate_waveform(&conn, "track", &audio).unwrap();
        // second call should retrieve from cache
        let wf2 = get_or_generate_waveform(&conn, "track", &audio).unwrap();
        assert_eq!(wf1, wf2);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM waveform_samples", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn returns_cached_waveform_without_audio() {
        let conn = setup();
        let audio = vec![0.1f32; 300];
        let wf1 = get_or_generate_waveform(&conn, "song", &audio).unwrap();
        // Provide empty audio to ensure cached result is used
        let wf2 = get_or_generate_waveform(&conn, "song", &[]).unwrap();
        assert_eq!(wf1, wf2);
    }
}
