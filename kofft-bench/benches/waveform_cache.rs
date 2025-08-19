use criterion::{criterion_group, criterion_main, Criterion};
use kofft::media::playback::{get_or_generate_waveform, init_db};
use rusqlite::Connection;

fn benchmark_waveform_cache(c: &mut Criterion) {
    let conn = Connection::open_in_memory().unwrap();
    init_db(&conn).unwrap();
    let audio = vec![0.1f32; 10_000];
    let track_id = "track1";

    c.bench_function("generate_waveform", |b| {
        b.iter(|| {
            conn.execute("DELETE FROM waveform_samples", []).unwrap();
            let _ = get_or_generate_waveform(&conn, track_id, &audio).unwrap();
        });
    });

    conn.execute("DELETE FROM waveform_samples", []).unwrap();
    let _ = get_or_generate_waveform(&conn, track_id, &audio).unwrap();
    c.bench_function("load_cached_waveform", |b| {
        b.iter(|| {
            let _ = get_or_generate_waveform(&conn, track_id, &audio).unwrap();
        });
    });
}

criterion_group!(benches, benchmark_waveform_cache);
criterion_main!(benches);
