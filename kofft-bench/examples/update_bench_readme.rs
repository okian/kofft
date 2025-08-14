use std::fs;
use std::error::Error;
use serde::Deserialize;

#[derive(Deserialize)]
struct BenchFile {
    env: EnvInfo,
    results: Vec<BenchRecord>,
}

#[derive(Deserialize)]
struct EnvInfo {
    cpu: String,
    _os: String,
    rustc: String,
    flags: String,
    date: String,
    runner: String,
}

#[derive(Deserialize)]
struct BenchRecord {
    library: String,
    transform: String,
    size: usize,
    mode: String,
    time_per_op_ns: f64,
    ops_per_sec: f64,
    allocations: usize,
    _peak_bytes: usize,
}

fn main() -> Result<(), Box<dyn Error>> {
    let data = fs::read_to_string("../benchmarks/latest.json")?;
    let bf: BenchFile = serde_json::from_str(&data)?;

    let mut table = String::new();
    table.push_str(&format!(
        "Last run: {} on {} ({}; {}; flags: `{}`)\n\n",
        bf.env.date, bf.env.runner, bf.env.cpu.trim(), bf.env.rustc, bf.env.flags
    ));
    table.push_str("| Library | Transform | Size (N) | Mode | Time/op | Ops/sec | Allocations | Date/Runner |\n");
    table.push_str("| --- | --- | --- | --- | --- | --- | --- | --- |\n");
    let date_short = bf.env.date.split('T').next().unwrap_or("");
    for r in &bf.results {
        let time_ms = r.time_per_op_ns / 1_000_000.0;
        table.push_str(&format!(
            "| {} | {} | {} | {} | {:.3} ms | {:.2} | {} | {} {} |\n",
            r.library, r.transform, r.size, r.mode, time_ms, r.ops_per_sec,
            r.allocations, date_short, bf.env.runner
        ));
    }
    update_readme(&table)?;
    Ok(())
}

fn update_readme(table: &str) -> Result<(), Box<dyn Error>> {
    let path = "README.md";
    let content = fs::read_to_string(path)?;
    let start = "<!-- BENCH_START -->";
    let end = "<!-- BENCH_END -->";
    if let (Some(s), Some(e)) = (content.find(start), content.find(end)) {
        let mut new_content = String::new();
        new_content.push_str(&content[..s + start.len()]);
        new_content.push('\n');
        new_content.push_str(table);
        new_content.push_str(&content[e..]);
        fs::write(path, new_content)?;
    }
    Ok(())
}
