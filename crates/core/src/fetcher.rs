//! Пример use-case, задействующий оба порта: скачать URL и сохранить в файл.

use thiserror::Error;

use crate::ports::{Fs, Http, PortError};

#[derive(Debug, Error)]
pub enum FetchError {
    #[error(transparent)]
    Port(#[from] PortError),
    #[error("unexpected HTTP status {0}")]
    Status(u16),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SaveReport {
    pub path: String,
    pub bytes: usize,
}

pub async fn save_url<H: Http, F: Fs>(
    http: &H,
    fs: &F,
    url: &str,
    path: &str,
) -> Result<SaveReport, FetchError> {
    let res = http.get(url).await?;
    if !(200..300).contains(&res.status) {
        return Err(FetchError::Status(res.status));
    }
    fs.write(path, &res.body).await?;
    Ok(SaveReport {
        path: path.to_owned(),
        bytes: res.body.len(),
    })
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::collections::HashMap;

    use futures::executor::block_on;

    use super::*;
    use crate::ports::HttpResponse;

    struct FakeHttp(u16);

    impl Http for FakeHttp {
        async fn get(&self, _url: &str) -> Result<HttpResponse, PortError> {
            Ok(HttpResponse { status: self.0, body: b"hello".to_vec() })
        }
    }

    #[derive(Default)]
    struct MemFs(RefCell<HashMap<String, Vec<u8>>>);

    impl Fs for MemFs {
        async fn read(&self, path: &str) -> Result<Vec<u8>, PortError> {
            self.0.borrow().get(path).cloned().ok_or_else(|| PortError::Io(format!("no {path}")))
        }
        async fn write(&self, path: &str, data: &[u8]) -> Result<(), PortError> {
            self.0.borrow_mut().insert(path.to_owned(), data.to_vec());
            Ok(())
        }
        async fn exists(&self, path: &str) -> Result<bool, PortError> {
            Ok(self.0.borrow().contains_key(path))
        }
    }

    #[test]
    fn saves_body_on_success() {
        let fs = MemFs::default();
        let report = block_on(save_url(&FakeHttp(200), &fs, "http://x", "a/b.txt")).unwrap();
        assert_eq!(report, SaveReport { path: "a/b.txt".into(), bytes: 5 });
        assert_eq!(block_on(fs.read("a/b.txt")).unwrap(), b"hello");
    }

    #[test]
    fn rejects_error_status_without_writing() {
        let fs = MemFs::default();
        let err = block_on(save_url(&FakeHttp(404), &fs, "http://x", "a.txt")).unwrap_err();
        assert!(matches!(err, FetchError::Status(404)));
        assert!(!block_on(fs.exists("a.txt")).unwrap());
    }
}
