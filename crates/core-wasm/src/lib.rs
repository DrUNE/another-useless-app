//! Привязка ядра к JS: порты `Fs` и `Http` реализуются объектами из JS,
//! а use-cases `app-core` вызываются без изменений.
//!
//! Futures здесь `!Send` (ждут JS-промисы), и это допустимо: порты не требуют `Send` (ADR-0004).

use app_core::fetcher;
use app_core::ports::{Fs, Http, HttpResponse, PortError};
use js_sys::{Reflect, Uint8Array};
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

/// Скачать `url` и сохранить в `path` через переданные JS-порты.
#[wasm_bindgen(js_name = saveUrl)]
pub async fn save_url(
    fs: JsFs,
    http: JsHttp,
    url: String,
    path: String,
) -> Result<SaveReport, JsError> {
    fetcher::save_url(&http, &fs, &url, &path)
        .await
        .map(|r| SaveReport {
            path: r.path,
            bytes: r.bytes,
        })
        .map_err(|e| JsError::new(&e.to_string()))
}

#[cfg(all(test, target_arch = "wasm32"))]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    // Тестовые двойники портов на JS: проверяем сам мост, без браузера и сети.
    #[wasm_bindgen(inline_js = r#"
      export function memoryFs() {
        const files = new Map();
        return {
          files,
          async read(p) {
            if (!files.has(p)) throw new Error("no such file: " + p);
            return files.get(p);
          },
          async write(p, d) { files.set(p, d); },
          async exists(p) { return files.has(p); },
        };
      }
      export function failingFs() {
        return {
          async read() { throw new Error("boom"); },
          async write() { throw new Error("disk full"); },
          async exists() { return false; },
        };
      }
      export function fakeHttp(status, bytes) {
        return { async get(url) { return { status, body: new Uint8Array(bytes) }; } };
      }
      export function stored(fs, p) { return fs.files.get(p); }
    "#)]
    extern "C" {
        #[wasm_bindgen(js_name = memoryFs)]
        fn memory_fs() -> JsFs;
        #[wasm_bindgen(js_name = failingFs)]
        fn failing_fs() -> JsFs;
        #[wasm_bindgen(js_name = fakeHttp)]
        fn fake_http(status: u16, bytes: &[u8]) -> JsHttp;
        fn stored(fs: &JsFs, path: &str) -> Option<Uint8Array>;
    }

    /// save_url забирает порт по значению, а тесту он нужен и после вызова: делаем ещё одну ссылку на тот же JS-объект.
    fn share(fs: &JsFs) -> JsFs {
        let handle: &JsValue = fs.as_ref();
        handle.clone().unchecked_into()
    }

    #[wasm_bindgen_test]
    async fn saves_body_through_js_ports() {
        let fs = memory_fs();
        let report = save_url(
            share(&fs),
            fake_http(200, b"hi"),
            "http://x".into(),
            "a/b.txt".into(),
        )
        .await
        .ok()
        .expect("save_url failed");
        assert_eq!(report.path, "a/b.txt");
        assert_eq!(report.bytes, 2);
        assert_eq!(stored(&fs, "a/b.txt").unwrap().to_vec(), b"hi");
    }

    #[wasm_bindgen_test]
    async fn rejects_error_status_without_writing() {
        let fs = memory_fs();
        let result = save_url(
            share(&fs),
            fake_http(404, b""),
            "http://x".into(),
            "a.txt".into(),
        )
        .await;
        assert!(result.is_err());
        assert!(stored(&fs, "a.txt").is_none());
    }

    #[wasm_bindgen_test]
    async fn surfaces_js_errors_from_ports() {
        let err = match save_url(
            failing_fs(),
            fake_http(200, b"x"),
            "http://x".into(),
            "a.txt".into(),
        )
        .await
        {
            Ok(_) => panic!("expected an error"),
            Err(e) => JsValue::from(e),
        };
        let message = String::from(err.dyn_into::<js_sys::Error>().unwrap().message());
        assert!(
            message.contains("disk full"),
            "unexpected message: {message}"
        );
    }
}
