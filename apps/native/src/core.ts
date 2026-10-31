import { type Core, type CoreError, CoreException } from "@app/core-api";

import { type CommandError, commands } from "./bindings";

// Компилятор следит, чтобы форма ошибки Rust совпадала с контрактом: добавили вариант в Rust, пересоздали привязки
// (`bun run update:bindings`), и сборка TS упадёт здесь, пока контракт и интерфейс не обновят.
const toCoreError = (error: CommandError): CoreError => error;

/** Ядро через IPC: те же Rust-функции, что в CLI, вызываются командой Tauri (ADR-0009). */
export function createIpcCore(): Core {
  return {
    async saveUrl(url, path) {
      const result = await commands.saveUrl(url, path);
      if (result.status === "error") throw new CoreException(toCoreError(result.error));
      return result.data;
    },
  };
}
