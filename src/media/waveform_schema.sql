CREATE TABLE IF NOT EXISTS waveform_samples (
    track_id TEXT PRIMARY KEY,
    samples BLOB NOT NULL
);
