//! Чтение ранее сохранённого файла через порт файловой системы.

use thiserror::Error;

use crate::path::InvalidPath;
use crate::ports::{Fs, PortError};

#[derive(Debug, Error)]
pub enum ReadFileError {
    #[error(transparent)]
    Port(#[from] PortError),
    #[error(transparent)]
    InvalidPath(#[from] InvalidPath),
}

pub async fn read_file<F: Fs>(fs: &F, path: &str) -> Result<Vec<u8>, ReadFileError> {
    Ok(fs.read(path).await?)
}

#[cfg(test)]
mod tests {
    use futures::executor::block_on;

    use super::*;

    struct FakeFs {
        fail: bool,
    }

    impl Fs for FakeFs {
        async fn read(&self, _path: &str) -> Result<Vec<u8>, PortError> {
            if self.fail {
                Err(PortError::Io("missing".into()))
            } else {
                Ok("привет".as_bytes().to_vec())
            }
        }

        async fn write(&self, _path: &str, _data: &[u8]) -> Result<(), PortError> {
            unreachable!()
        }

        async fn exists(&self, _path: &str) -> Result<bool, PortError> {
            unreachable!()
        }
    }

    #[test]
    fn reads_bytes_through_the_fs_port() {
        let bytes = block_on(read_file(&FakeFs { fail: false }, "a.txt")).unwrap();
        assert_eq!(bytes, "привет".as_bytes());
    }

    #[test]
    fn propagates_io_errors() {
        let error = block_on(read_file(&FakeFs { fail: true }, "missing.txt")).unwrap_err();
        assert!(
            matches!(error, ReadFileError::Port(PortError::Io(message)) if message == "missing")
        );
    }
}
