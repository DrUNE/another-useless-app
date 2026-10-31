//! Tauri-приложение: подключает ядро и нативные адаптеры (ADR-0003) и отдаёт их интерфейсу через IPC.

mod commands;

pub use commands::{AppState, CommandError, SaveReport};

use tauri::Manager;
use tauri_specta::{Builder, collect_commands};

/// Единый список команд: из него строятся и обработчик IPC, и TS-типы (ADR-0009).
pub fn specta_builder<R: tauri::Runtime>() -> Builder<R> {
    Builder::<R>::new().commands(collect_commands![commands::save_url])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_builder::<tauri::Wry>();
    tauri::Builder::default()
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            app.manage(AppState::new(app.path().app_data_dir()?));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::path::PathBuf;
    use std::thread;

    use serde_json::json;
    use specta_typescript::Typescript;
    use tauri::test::{INVOKE_KEY, MockRuntime, get_ipc_response, mock_builder};
    use tauri::webview::InvokeRequest;
    use tauri::{
        WebviewWindowBuilder,
        ipc::{CallbackFn, InvokeBody},
    };

    use super::*;

    /// Коммитнутые привязки должны совпадать с тем, что генерируется из Rust.
    /// Обновить: `UPDATE_BINDINGS=1 cargo test -p app-native bindings`.
    #[test]
    fn bindings_are_up_to_date() {
        let committed = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/bindings.ts");
        let fresh = std::env::temp_dir().join(format!("bindings-{}.ts", std::process::id()));
        specta_builder::<tauri::Wry>()
            .export(Typescript::default(), &fresh)
            .expect("failed to export bindings");
        let fresh_text = std::fs::read_to_string(&fresh).unwrap();
        std::fs::remove_file(&fresh).ok();

        if std::env::var_os("UPDATE_BINDINGS").is_some() {
            std::fs::write(&committed, &fresh_text).unwrap();
            return;
        }
        let committed_text = std::fs::read_to_string(&committed).unwrap_or_default();
        assert!(
            committed_text == fresh_text,
            "apps/native/src/bindings.ts is stale; run `UPDATE_BINDINGS=1 cargo test -p app-native bindings`"
        );
    }

    /// Отдаёт один HTTP-ответ на случайном порту и возвращает URL.
    fn serve_once(status_line: &'static str, body: &'static str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0u8; 2048];
            let _ = stream.read(&mut buf);
            let response = format!(
                "HTTP/1.1 {status_line}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(response.as_bytes()).unwrap();
        });
        format!("http://{addr}/")
    }

    fn invoke(
        sandbox: PathBuf,
        args: serde_json::Value,
    ) -> Result<tauri::ipc::InvokeResponseBody, serde_json::Value> {
        let app = mock_builder()
            .manage(AppState::new(sandbox))
            .invoke_handler(specta_builder::<MockRuntime>().invoke_handler())
            .build(tauri::generate_context!())
            .expect("failed to build app");
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        get_ipc_response(
            &webview,
            InvokeRequest {
                cmd: "save_url".into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "tauri://localhost".parse().unwrap(),
                body: InvokeBody::Json(args),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_string(),
            },
        )
    }

    fn sandbox(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("app-native-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn save_url_over_ipc_writes_inside_the_sandbox() {
        let dir = sandbox("ok");
        let url = serve_once("200 OK", "hello");
        let res = invoke(
            dir.clone(),
            json!({ "url": url, "path": "downloads/a.txt" }),
        );

        let body = res.expect("command failed");
        let report: serde_json::Value = body.deserialize().unwrap();
        assert_eq!(report, json!({ "path": "downloads/a.txt", "bytes": 5 }));
        assert_eq!(
            std::fs::read(dir.join("downloads/a.txt")).unwrap(),
            b"hello"
        );
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn http_error_status_is_a_typed_error_and_writes_nothing() {
        let dir = sandbox("status");
        let url = serve_once("404 Not Found", "nope");
        let err = invoke(dir.clone(), json!({ "url": url, "path": "a.txt" })).unwrap_err();

        assert_eq!(err, json!({ "kind": "status", "code": 404 }));
        assert!(!dir.join("a.txt").exists());
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn paths_outside_the_sandbox_are_rejected_before_any_request() {
        let dir = sandbox("escape");
        // Сервер намеренно не запущен: до сети дело дойти не должно.
        let err = invoke(
            dir.clone(),
            json!({ "url": "http://127.0.0.1:9/", "path": "../escape.txt" }),
        )
        .unwrap_err();

        assert_eq!(
            err,
            json!({ "kind": "invalidPath", "path": "../escape.txt" })
        );
        assert!(!dir.parent().unwrap().join("escape.txt").exists());
        std::fs::remove_dir_all(dir).ok();
    }
}
