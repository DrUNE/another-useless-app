/**
 * Контракт между интерфейсом и ядром (ADR-0014). UI зависит только от этого пакета, а какое ядро за ним стоит —
 * WASM в браузере или Rust через IPC в Tauri — решает точка входа приложения.
 */

export interface SaveReport {
  path: string;
  bytes: number;
}

/**
 * Причина отказа как данные. Форма совпадает с `CommandError` (Tauri) и `WasmError` (WASM), поэтому интерфейс
 * различает причины по `kind` и не разбирает текст. Для `io` и `network` текст зависит от платформы.
 */
export type CoreError =
  | { kind: "invalidPath"; path: string }
  | { kind: "io"; message: string }
  | { kind: "network"; message: string }
  | { kind: "status"; code: number };

export interface Core {
  /**
   * Скачать `url` и сохранить в `path` (относительный путь внутри хранилища приложения).
   * При отказе отклоняется `CoreException`.
   */
  saveUrl(url: string, path: string): Promise<SaveReport>;
  /** Прочитать файл как байты. Текстовую кодировку выбирает вызывающий код. */
  readFile(path: string): Promise<Uint8Array>;
}

/** Единый вид отказа для всех реализаций: `Error` со стеком и типизированной причиной в `error`. */
export class CoreException extends Error {
  readonly error: CoreError;

  constructor(error: CoreError) {
    super(summary(error));
    this.name = "CoreException";
    this.error = error;
  }
}

function summary(error: CoreError): string {
  switch (error.kind) {
    case "invalidPath":
      return `invalid path: ${error.path}`;
    case "io":
      return `io: ${error.message}`;
    case "network":
      return `network: ${error.message}`;
    case "status":
      return `unexpected HTTP status ${error.code}`;
  }
}

/** Проверка формы значения, пришедшего из чужой среды (WASM, IPC): доверять типам на этой границе нельзя. */
export function isCoreError(value: unknown): value is CoreError {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  switch (v["kind"]) {
    case "invalidPath":
      return typeof v["path"] === "string";
    case "io":
    case "network":
      return typeof v["message"] === "string";
    case "status":
      return typeof v["code"] === "number";
    default:
      return false;
  }
}
