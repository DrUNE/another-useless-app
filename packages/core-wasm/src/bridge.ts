import type { Fs, Http } from "@app/platform";
import type { WasmFs, WasmHttp } from "../pkg/app_core_wasm.js";

// TS-порты (packages/platform) богаче, чем порты Rust-ядра (crates/core/src/ports.rs).
// Мост сводит одно к другому, чтобы ни одна из сторон не знала о второй.

const parentDir = (path: string) => path.split("/").slice(0, -1).join("/");

export function fsBridge(fs: Fs): WasmFs {
  return {
    read: (path) => fs.readBytes(path),
    // Контракт Rust-порта: write создаёт недостающие каталоги.
    async write(path, data) {
      const dir = parentDir(path);
      if (dir !== "") await fs.mkdir(dir);
      await fs.writeBytes(path, data);
    },
    exists: (path) => fs.exists(path),
  };
}

export function httpBridge(http: Http): WasmHttp {
  return {
    async get(url) {
      const res = await http(url);
      return { status: res.status, body: await res.bytes() };
    },
  };
}
