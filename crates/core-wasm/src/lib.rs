//! Привязка ядра к JS: порты `Fs` и `Http` реализуются объектами из JS,
//! а use-cases `app-core` вызываются без изменений.
//!
//! Futures здесь `!Send` (ждут JS-промисы), и это допустимо: порты не требуют `Send` (ADR-0004).

use app_core::fetcher::{self, FetchError};
use app_core::path::{InvalidPath, validate_relative};
use app_core::ports::{Fs, Http, HttpResponse, PortError};
use app_core::reader::{self, ReadFileError};
use js_sys::{Object, Reflect, Uint8Array};
use wasm_bindgen::prelude::*;

// Контракт со стороны JS. Попадает в сгенерированный .d.ts, чтобы TS-адаптеры
// проверялись компилятором, а не по договорённости.
#[wasm_bindgen(typescript_custom_section)]
const TS_PORTS: &str = r#"
export interface WasmFs {
  read(path: string): Promise<Uint8Array>;
  /** Должен создавать недостающие родительские каталоги. */
  write(path: string, data: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
}
export interface WasmHttp {
  get(url: string): Promise<{ status: number; body: Uint8Array }>;
}
/** Отказ `saveUrl`: обычный объект (не Error), форма совпадает с `CommandError` у Tauri. */
export type WasmError =
  | { kind: "invalidPath"; path: string }
  | { kind: "io"; message: string }
  | { kind: "network"; message: string }
  | { kind: "status"; code: number };
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "WasmFs")]
    pub type JsFs;

    #[wasm_bindgen(method, catch, js_name = read)]
    async fn js_read(this: &JsFs, path: &str) -> Result<JsValue, JsValue>;
    #[wasm_bindgen(method, catch, js_name = write)]
    async fn js_write(this: &JsFs, path: &str, data: &Uint8Array) -> Result<JsValue, JsValue>;
    #[wasm_bindgen(method, catch, js_name = exists)]
    async fn js_exists(this: &JsFs, path: &str) -> Result<JsValue, JsValue>;

    #[wasm_bindgen(typescript_type = "WasmHttp")]
    pub type JsHttp;

    #[wasm_bindgen(method, catch, js_name = get)]
    async fn js_get(this: &JsHttp, url: &str) -> Result<JsValue, JsValue>;
}

fn describe(e: JsValue) -> String {
    match e.dyn_into::<js_sys::Error>() {
        Ok(err) => String::from(err.message()),
        Err(v) => v.as_string().unwrap_or_else(|| format!("{v:?}")),
    }
}

fn io(e: JsValue) -> PortError {
    PortError::Io(describe(e))
}

fn net(e: JsValue) -> PortError {
    PortError::Network(describe(e))
}

impl Fs for JsFs {
    async fn read(&self, path: &str) -> Result<Vec<u8>, PortError> {
        let v = self.js_read(path).await.map_err(io)?;
        let bytes = v
            .dyn_into::<Uint8Array>()
            .map_err(|_| PortError::Io("read() must resolve to Uint8Array".into()))?;
        Ok(bytes.to_vec())
    }

    async fn write(&self, path: &str, data: &[u8]) -> Result<(), PortError> {
        // Копия в JS-память: срез указывает в память WASM, которая может измениться,
        // пока JS ждёт промис.
        let data = Uint8Array::from(data);
        self.js_write(path, &data).await.map(drop).map_err(io)
    }

    async fn exists(&self, path: &str) -> Result<bool, PortError> {
        let v = self.js_exists(path).await.map_err(io)?;
        v.as_bool()
            .ok_or_else(|| PortError::Io("exists() must resolve to boolean".into()))
    }
}

impl Http for JsHttp {
    async fn get(&self, url: &str) -> Result<HttpResponse, PortError> {
        let v = self.js_get(url).await.map_err(net)?;
        let field = |name: &str| Reflect::get(&v, &name.into()).map_err(net);
        let status = field("status")?
            .as_f64()
            .ok_or_else(|| PortError::Network("get() response has no numeric status".into()))?
            as u16;
        let body = field("body")?
            .dyn_into::<Uint8Array>()
            .map_err(|_| PortError::Network("get() response body must be Uint8Array".into()))?
            .to_vec();
        Ok(HttpResponse { status, body })
    }
}

#[wasm_bindgen(getter_with_clone)]
pub struct SaveReport {
    pub path: String,
    pub bytes: usize,
}

/// Ошибка как данные: объект `{ kind, ... }`, чтобы TS различал причины по `kind`, а не разбирал текст.
fn error_object(kind: &str, field: &str, value: JsValue) -> JsValue {
    let object = Object::new();
    for (key, value) in [("kind", JsValue::from_str(kind)), (field, value)] {
        Reflect::set(&object, &JsValue::from_str(key), &value)
            .expect("setting a property on a plain object");
    }
    object.into()
}

fn to_js_error(error: FetchError) -> JsValue {
    match error {
        FetchError::Status(code) => error_object("status", "code", code.into()),
        FetchError::InvalidPath(InvalidPath(path)) => {
            error_object("invalidPath", "path", path.into())
        }
        FetchError::Port(PortError::Io(message)) => error_object("io", "message", message.into()),
        FetchError::Port(PortError::Network(message)) => {
            error_object("network", "message", message.into())
        }
    }
}

/// Скачать `url` и сохранить в `path` через переданные JS-порты.
/// `path` приходит из интерфейса и считается недоверенным: правило общее с Tauri и лежит в ядре.
/// При отказе промис отклоняется значением типа `WasmError`.
#[wasm_bindgen(js_name = saveUrl)]
pub async fn save_url(
    fs: JsFs,
    http: JsHttp,
    url: String,
    path: String,
) -> Result<SaveReport, JsValue> {
    validate_relative(&path).map_err(|e| to_js_error(e.into()))?;
    fetcher::save_url(&http, &fs, &url, &path)
        .await
        .map(|r| SaveReport {
            path: r.path,
            bytes: r.bytes,
        })
        .map_err(to_js_error)
}

fn to_js_read_error(error: ReadFileError) -> JsValue {
    match error {
        ReadFileError::InvalidPath(InvalidPath(path)) => {
            error_object("invalidPath", "path", path.into())
        }
        ReadFileError::Port(PortError::Io(message)) => {
            error_object("io", "message", message.into())
        }
        ReadFileError::Port(PortError::Network(message)) => {
            error_object("network", "message", message.into())
        }
    }
}

/// Прочитать `path` через переданный JS-порт. Путь недоверенный, как и при записи.
#[wasm_bindgen(js_name = readFile)]
pub async fn read_file(fs: JsFs, path: String) -> Result<Vec<u8>, JsValue> {
    validate_relative(&path).map_err(|e| to_js_read_error(e.into()))?;
    reader::read_file(&fs, &path)
        .await
        .map_err(to_js_read_error)
}
