//! Порты: что ядру нужно от платформы. Реализации живут в platform-* крейтах.
//!
//! Futures намеренно не требуют `Send`: в wasm32 они `!Send`. Native-вызывающий код
//! использует конкретные типы, и `Send` выводится автоматически.
#![allow(async_fn_in_trait)]

use thiserror::Error;

#[derive(Debug, Error)]
pub enum PortError {
    #[error("io: {0}")]
    Io(String),
    #[error("network: {0}")]
    Network(String),
}

pub trait Fs {
    async fn read(&self, path: &str) -> Result<Vec<u8>, PortError>;
    /// Создаёт недостающие родительские каталоги.
    async fn write(&self, path: &str, data: &[u8]) -> Result<(), PortError>;
    async fn exists(&self, path: &str) -> Result<bool, PortError>;
}

#[derive(Debug, Clone)]
pub struct HttpResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

pub trait Http {
    async fn get(&self, url: &str) -> Result<HttpResponse, PortError>;
}
