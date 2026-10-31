//! Политика путей для недоверенных входов (интерфейс приложения).
//!
//! Правило одно для всех платформ: путь относительный и не выходит за корень данных. Что такое корень, решает
//! платформа (каталог данных приложения в Tauri, песочница OPFS в вебе), а сама проверка живёт здесь, чтобы
//! не расходиться между входами. Доверенный вызывающий (CLI) её не применяет: пользователь сам выбирает путь.

use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
#[error("invalid path: {0}")]
pub struct InvalidPath(pub String);

/// Допускает только относительные пути без сегмента `..`. Отвергает: пустой путь, абсолютные (`/x`, `\x`),
/// путь с буквой диска (`C:x`) и нулевой символ. Разделителями считаются и `/`, и `\`: платформа не должна
/// решать, что для неё значит обратная косая черта.
pub fn validate_relative(path: &str) -> Result<(), InvalidPath> {
    let bytes = path.as_bytes();
    let has_drive = bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':';
    let absolute = path.starts_with(['/', '\\']);
    let escapes = path.split(['/', '\\']).any(|segment| segment == "..");
    if path.is_empty() || absolute || has_drive || escapes || path.contains('\0') {
        return Err(InvalidPath(path.to_owned()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_relative_paths_without_parent_segments() {
        for ok in [
            "a.txt",
            "a/b.txt",
            "./a.txt",
            "downloads/a/b.txt",
            "a..b",
            "..a",
            "a/.b",
        ] {
            assert_eq!(validate_relative(ok), Ok(()), "{ok:?} must be accepted");
        }
    }

    #[test]
    fn rejects_everything_that_could_leave_the_root() {
        let bad = [
            "",
            "/etc/passwd",
            "\\windows\\x",
            "../x",
            "a/../x",
            "a/..",
            "..",
            "a\\..\\x",
            "C:x",
            "c:\\x",
            "a\0b",
        ];
        for path in bad {
            assert_eq!(
                validate_relative(path),
                Err(InvalidPath(path.to_owned())),
                "{path:?} must be rejected"
            );
        }
    }
}
