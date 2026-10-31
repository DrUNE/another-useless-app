import type { FetcherService } from "@app/app";

import { type CommandError, commands } from "./bindings";

/** Человекочитаемый текст для типизированной ошибки Rust: интерфейс не разбирает строки, а смотрит на `kind`. */
function describe(e: CommandError): string {
  switch (e.kind) {
    case "invalidPath":
      return `Недопустимый путь: ${e.path}`;
    case "io":
      return `Ошибка файла: ${e.message}`;
    case "network":
      return `Ошибка сети: ${e.message}`;
    case "status":
      return `Сервер ответил кодом ${e.code}`;
  }
}

/** Сервис поверх IPC: вызывает Rust-команды, сгенерированные из `src-tauri`. */
export function createIpcService(): FetcherService {
  return {
    async saveUrl(url, path) {
      const result = await commands.saveUrl(url, path);
      if (result.status === "error") throw new Error(describe(result.error));
      return result.data;
    },
  };
}
