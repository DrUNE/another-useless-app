use app_core::fetcher::save_url;
use app_platform_native::{NativeFs, NativeHttp};
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "app", version, about)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Скачать URL и сохранить в файл
    Fetch { url: String, path: String },
}

#[tokio::main]
async fn main() -> std::process::ExitCode {
    let cli = Cli::parse();
    match cli.command {
        Command::Fetch { url, path } => {
            match save_url(&NativeHttp::new(), &NativeFs, &url, &path).await {
                Ok(r) => {
                    println!("saved {} bytes to {}", r.bytes, r.path);
                    std::process::ExitCode::SUCCESS
                }
                Err(e) => {
                    eprintln!("error: {e}");
                    std::process::ExitCode::FAILURE
                }
            }
        }
    }
}
