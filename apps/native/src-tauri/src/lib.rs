//! Tauri-приложение: подключает ядро и нативные адаптеры (ADR-0003) и отдаёт их интерфейсу через IPC.

mod commands;

pub use commands::{AppState, CommandError, SaveReport};

use tauri::Manager;
use tauri_specta::{Builder, collect_commands};

/// Единый список команд: из него строятся и обработчик IPC, и TS-типы (ADR-0009).
pub fn specta_builder<R: tauri::Runtime>() -> Builder<R> {
    Builder::<R>::new().commands(collect_commands![commands::save_url, commands::read_file])
}

/// Контекст приложения из `tauri.conf.json` и capabilities. Макрос раскрывается здесь **один раз** на крейт: на macOS он
/// встраивает `Info.plist` как символ, и второй вызов (например, в тестах) даёт `symbol _EMBED_INFO_PLIST is already defined`.
fn context<R: tauri::Runtime>() -> tauri::Context<R> {
    tauri::generate_context!()
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
        .run(context())
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
    fn serve_once(status: u16, body: &str) -> String {
        let reason = match status {
            200 => "OK",
            404 => "Not Found",
            _ => "Status",
        };
        let body = body.to_owned();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0u8; 2048];
            let _ = stream.read(&mut buf);
            let response = format!(
                "HTTP/1.1 {status} {reason}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(response.as_bytes()).unwrap();
        });
        format!("http://{addr}/")
    }

    fn invoke(
        sandbox: PathBuf,
        command: &str,
        args: serde_json::Value,
    ) -> Result<tauri::ipc::InvokeResponseBody, serde_json::Value> {
        let app = mock_builder()
            .manage(AppState::new(sandbox))
            .invoke_handler(specta_builder::<MockRuntime>().invoke_handler())
            .build(context())
            .expect("failed to build app");
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        get_ipc_response(
            &webview,
            InvokeRequest {
                cmd: command.into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                // Адрес источника запроса зависит от ОС (так в документации tauri::test).
                url: if cfg!(any(windows, target_os = "android")) {
                    "http://tauri.localhost"
                } else {
                    "tauri://localhost"
                }
                .parse()
                .unwrap(),
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
        let url = serve_once(200, "hello");
        let res = invoke(
            dir.clone(),
            "save_url",
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

    /// Поля из `expected` обязаны совпасть; остальные поля `actual` (например, текст ошибки ОС) не проверяются.
    fn is_partial_match(actual: &serde_json::Value, expected: &serde_json::Value) -> bool {
        expected
            .as_object()
            .unwrap()
            .iter()
            .all(|(key, value)| actual.get(key) == Some(value))
    }

    /// Общий контракт: тот же `scenarios.json`, что читают TS-тесты WASM-ядра (`@app/core-api/contract`).
    /// Здесь он проверяет настоящую IPC-команду Tauri, значит, оба входа ведут себя одинаково для одних и тех же случаев.
    /// Проверка `httpContacted` недоступна (запрос до порта-ловушки не видно), но обращение к сети всё равно обнаружится:
    /// вместо `invalidPath` вернулась бы `network`.
    #[test]
    fn ipc_follows_the_shared_core_contract() {
        const SCENARIOS: &str =
            include_str!("../../../../packages/core-api/contract/scenarios.json");
        let scenarios: Vec<serde_json::Value> = serde_json::from_str(SCENARIOS).unwrap();
        assert!(!scenarios.is_empty());

        for (index, scenario) in scenarios.iter().enumerate() {
            let name = scenario["name"].as_str().unwrap();
            let path = scenario["path"].as_str().unwrap();
            let dir = sandbox(&format!("contract-{index}"));

            // Обращение к порту 9 завершается отказом в соединении: так же выглядит «запрос не удался».
            let url = match scenario["http"].get("status") {
                Some(status) if scenario["expect"]["error"]["kind"] != "invalidPath" => serve_once(
                    status.as_u64().unwrap() as u16,
                    scenario["http"]["body"].as_str().unwrap(),
                ),
                _ => "http://127.0.0.1:9/".to_owned(),
            };
            if scenario["fs"]["writeFails"] == true {
                // Запись файла поверх каталога заканчивается ошибкой ОС: это и есть сбой записи.
                std::fs::create_dir_all(dir.join(path)).unwrap();
            }

            let result = invoke(dir.clone(), "save_url", json!({ "url": url, "path": path }));
            let expect = &scenario["expect"];
            match (&expect["ok"], &expect["error"]) {
                (ok, _) if !ok.is_null() => {
                    let report: serde_json::Value = result.expect(name).deserialize().unwrap();
                    assert_eq!(&report, ok, "{name}");
                }
                (_, error) => {
                    let actual = result.expect_err(name);
                    assert!(
                        is_partial_match(&actual, error),
                        "{name}: expected {error}, got {actual}"
                    );
                }
            }
            if expect["written"] == false {
                assert!(!dir.join(path).exists(), "{name}: a file was written");
            }
            if path.starts_with("../") {
                assert!(
                    !dir.join(path).exists(),
                    "{name}: the path escaped the sandbox"
                );
            }
            std::fs::remove_dir_all(dir).ok();
        }
    }

    #[test]
    fn ipc_read_file_follows_the_shared_core_contract() {
        const SCENARIOS: &str =
            include_str!("../../../../packages/core-api/contract/read-scenarios.json");
        let scenarios: Vec<serde_json::Value> = serde_json::from_str(SCENARIOS).unwrap();
        assert!(!scenarios.is_empty());

        for (index, scenario) in scenarios.iter().enumerate() {
            let name = scenario["name"].as_str().unwrap();
            let path = scenario["path"].as_str().unwrap();
            let dir = sandbox(&format!("read-contract-{index}"));
            let target = dir.join(path);

            if scenario["expect"]["readAttempted"] != false {
                if let Some(body) = scenario["file"]["body"].as_str() {
                    if let Some(parent) = target.parent() {
                        std::fs::create_dir_all(parent).unwrap();
                    }
                    std::fs::write(&target, body).unwrap();
                }
                if scenario["file"]["readFails"] == true {
                    std::fs::create_dir_all(&target).unwrap();
                }
            }

            let result = invoke(dir.clone(), "read_file", json!({ "path": path }));
            let expect = &scenario["expect"];
            match (&expect["ok"], &expect["error"]) {
                (ok, _) if !ok.is_null() => {
                    let bytes: serde_json::Value = result.expect(name).deserialize().unwrap();
                    assert_eq!(&bytes, &ok["bytes"], "{name}");
                }
                (_, error) => {
                    let actual = result.expect_err(name);
                    assert!(
                        is_partial_match(&actual, error),
                        "{name}: expected {error}, got {actual}"
                    );
                }
            }
            std::fs::remove_dir_all(dir).ok();
        }
    }
}
