//! IPC-команды: тонкая обёртка над use-cases ядра. Логики здесь нет, кроме политики путей,
//! которая зависит от платформы и поэтому не может жить в `app-core`.

use std::path::{Component, Path, PathBuf};

use app_core::fetcher::{self, FetchError};
use app_core::ports::PortError;
use app_platform_native::{NativeFs, NativeHttp};
use serde::Serialize;
use specta::Type;
use tauri::State;

/// Адаптеры портов и каталог, которым ограничены файловые операции из интерфейса.
/// Создаётся один раз: `reqwest::Client` держит пул соединений, и пересоздавать его на каждый вызов не нужно.
pub struct AppState {
    fs: NativeFs,
    http: NativeHttp,
    root: PathBuf,
}

impl AppState {
    pub fn new(root: PathBuf) -> Self {
        Self {
            fs: NativeFs,
            http: NativeHttp::new(),
            root,
        }
    }
}

#[derive(Debug, Serialize, Type)]
pub struct SaveReport {
    pub path: String,
    pub bytes: u32,
}

/// Ошибки команд как данные: интерфейс различает их по `kind`, а не разбирает текст.
#[derive(Debug, Serialize, Type, thiserror::Error)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CommandError {
    #[error("invalid path: {path}")]
    InvalidPath { path: String },
    #[error("io: {message}")]
    Io { message: String },
    #[error("network: {message}")]
    Network { message: String },
    #[error("unexpected HTTP status {code}")]
    Status { code: u16 },
}

impl From<FetchError> for CommandError {
    fn from(e: FetchError) -> Self {
        match e {
            FetchError::Status(code) => Self::Status { code },
            FetchError::Port(PortError::Io(message)) => Self::Io { message },
            FetchError::Port(PortError::Network(message)) => Self::Network { message },
        }
    }
}

/// Путь из интерфейса считается недоверенным: допускаются только относительные пути без `..`.
/// Иначе скомпрометированная страница могла бы записать файл куда угодно (в вебе это делает песочница OPFS).
/// Символические ссылки внутри `root` не проверяются.
fn resolve(root: &Path, relative: &str) -> Result<PathBuf, CommandError> {
    let candidate = Path::new(relative);
    let safe = !relative.is_empty()
        && candidate
            .components()
            .all(|c| matches!(c, Component::Normal(_) | Component::CurDir));
    if !safe {
        return Err(CommandError::InvalidPath {
            path: relative.to_owned(),
        });
    }
    Ok(root.join(candidate))
}

#[tauri::command]
#[specta::specta]
pub async fn save_url(
    state: State<'_, AppState>,
    url: String,
    path: String,
) -> Result<SaveReport, CommandError> {
    let target = resolve(&state.root, &path)?;
    let target = target
        .to_str()
        .ok_or_else(|| CommandError::InvalidPath { path: path.clone() })?;
    let report = fetcher::save_url(&state.http, &state.fs, &url, target).await?;
    Ok(SaveReport {
        path,
        // Порт возвращает usize; u32 нужен для TS-типа number (specta не выводит u64/usize без BigInt).
        bytes: u32::try_from(report.bytes).unwrap_or(u32::MAX),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_plain_relative_paths() {
        let root = Path::new("/data");
        assert_eq!(resolve(root, "a.txt").unwrap(), Path::new("/data/a.txt"));
        assert_eq!(
            resolve(root, "downloads/a/b.txt").unwrap(),
            Path::new("/data/downloads/a/b.txt")
        );
        assert_eq!(
            resolve(root, "./a.txt").unwrap(),
            Path::new("/data/./a.txt")
        );
    }

    #[test]
    fn rejects_paths_that_could_escape_the_root() {
        let root = Path::new("/data");
        for bad in ["", "/etc/passwd", "../x", "a/../../x", "a/.."] {
            assert!(
                matches!(resolve(root, bad), Err(CommandError::InvalidPath { .. })),
                "{bad:?} must be rejected"
            );
        }
    }

    #[test]
    fn maps_core_errors_to_typed_command_errors() {
        assert!(matches!(
            CommandError::from(FetchError::Status(404)),
            CommandError::Status { code: 404 }
        ));
        assert!(matches!(
            CommandError::from(FetchError::Port(PortError::Network("x".into()))),
            CommandError::Network { .. }
        ));
    }
}
