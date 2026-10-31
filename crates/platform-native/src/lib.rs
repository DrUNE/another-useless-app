//! Нативные реализации портов ядра: tokio::fs и reqwest.
//! Общий для CLI и Tauri.

use app_core::ports::{Fs, Http, HttpResponse, PortError};

#[derive(Debug, Default, Clone, Copy)]
pub struct NativeFs;

fn io(e: std::io::Error) -> PortError {
    PortError::Io(e.to_string())
}

impl Fs for NativeFs {
    async fn read(&self, path: &str) -> Result<Vec<u8>, PortError> {
        tokio::fs::read(path).await.map_err(io)
    }

    async fn write(&self, path: &str, data: &[u8]) -> Result<(), PortError> {
        if let Some(parent) = std::path::Path::new(path).parent() {
            tokio::fs::create_dir_all(parent).await.map_err(io)?;
        }
        tokio::fs::write(path, data).await.map_err(io)
    }

    async fn exists(&self, path: &str) -> Result<bool, PortError> {
        tokio::fs::try_exists(path).await.map_err(io)
    }
}

#[derive(Debug, Default, Clone)]
pub struct NativeHttp(reqwest::Client);

impl NativeHttp {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Http for NativeHttp {
    async fn get(&self, url: &str) -> Result<HttpResponse, PortError> {
        let net = |e: reqwest::Error| PortError::Network(e.to_string());
        let res = self.0.get(url).send().await.map_err(net)?;
        let status = res.status().as_u16();
        let body = res.bytes().await.map_err(net)?.to_vec();
        Ok(HttpResponse { status, body })
    }
}
