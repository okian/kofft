//! Command-line interface for project maintenance tasks.

use clap::{Parser, Subcommand};
#[cfg(not(test))]
use xtask::*;

#[derive(Parser)]
#[command(author, version, about = "Development tasks for kofft")]
/// Top-level command-line arguments.
struct Cli {
    #[command(subcommand)]
    /// Task to execute.
    command: Commands,
}

#[derive(Subcommand)]
/// Supported subcommands.
enum Commands {
    /// Build the project.
    Build,
    /// Execute tests.
    Test,
    /// Run Clippy lints.
    Clippy,
    /// Format the codebase.
    Fmt,
    /// Run formatting followed by Clippy.
    Analyze,
    /// Run project benchmark example.
    Benchmark,
    /// Benchmark external libraries.
    #[command(name = "bench-libs")]
    BenchLibs,
    /// Update the benchmark README.
    #[command(name = "update-bench-readme")]
    UpdateBenchReadme,
    /// Generate a spectrogram for manual inspection.
    Sanity {
        /// Path to input audio file.
        input: String,
        /// Path to output PNG file.
        output: String,
    },
}

#[cfg(not(test))]
/// Program entry point dispatching to the selected subcommand. Errors bubble up
/// so `cargo` reports them and exits early.
fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let cfg = detect_config();

    match cli.command {
        Commands::Build => run_command(build_command(&cfg)),
        Commands::Test => run_command(test_command(&cfg)),
        Commands::Clippy => run_command(clippy_command()),
        Commands::Fmt => run_command(fmt_command()),
        Commands::Analyze => {
            run_command(fmt_command())?;
            run_command(clippy_command())
        }
        Commands::Benchmark => run_command(benchmark_command(&cfg)),
        Commands::BenchLibs => run_command(bench_libs_command(&cfg)),
        Commands::UpdateBenchReadme => run_command(update_bench_readme_command(&cfg)),
        Commands::Sanity { input, output } => run_command(sanity_command(&input, &output)?),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_build_command() {
        let cli = Cli::parse_from(["xtask", "build"]);
        match cli.command {
            Commands::Build => {}
            _ => panic!("parsed wrong command"),
        }
    }
}
