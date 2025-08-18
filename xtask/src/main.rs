use clap::{Parser, Subcommand};
use std::process::Command;
#[cfg(not(test))]
use xtask::*;

#[derive(Parser)]
#[command(author, version, about = "Development tasks for kofft")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Build,
    Test,
    Clippy,
    Fmt,
    Analyze,
    Benchmark,
    #[command(name = "bench-libs")]
    BenchLibs,
    #[command(name = "update-bench-readme")]
    UpdateBenchReadme,
    #[command(name = "web-spectrogram")]
    WebSpectrogram,
    Sanity {
        /// Path to input audio file
        input: String,
        /// Path to output PNG file
        output: String,
    },
}

#[cfg(not(test))]
fn main() -> std::io::Result<()> {
    let cli = Cli::parse();
    let cfg = detect_config();

    let status = match cli.command {
        Commands::Build => build_command(&cfg).status(),
        Commands::Test => test_command(&cfg).status(),
        Commands::Clippy => clippy_command().status(),
        Commands::Fmt => fmt_command().status(),
        Commands::Analyze => {
            let fmt = fmt_command().status()?;
            if !fmt.success() {
                Ok(fmt)
            } else {
                clippy_command().status()
            }
        }
        Commands::Benchmark => benchmark_command(&cfg).status(),
        Commands::BenchLibs => bench_libs_command(&cfg).status(),
        Commands::UpdateBenchReadme => update_bench_readme_command(&cfg).status(),
        Commands::WebSpectrogram => {
            match web_spectrogram_command() {
                Ok(_) => {
                    let mut cmd = Command::new("echo");
                    cmd.arg("web-spectrogram completed successfully");
                    cmd.status()
                },
                Err(e) => {
                    eprintln!("web-spectrogram failed: {}", e);
                    let mut cmd = Command::new("false");
                    cmd.status()
                }
            }
        },
        Commands::Sanity { input, output } => sanity_command(&input, &output).status(),
    }?;

    std::process::exit(status.code().unwrap_or(1));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_web_spectrogram_command() {
        let cli = Cli::parse_from(["xtask", "web-spectrogram"]);
        match cli.command {
            Commands::WebSpectrogram => {}
            _ => panic!("parsed wrong command"),
        }
    }
}
