import { type Core, CoreException, isCoreError } from "@app/core-api";
import { type Platform, requirePort } from "@app/platform";

import init, { initSync, saveUrl, type SyncInitInput } from "../pkg/app_core_wasm.js";
import { fsBridge, httpBridge } from "./bridge";

export interface CreateCoreOptions {
  /** Готовые байты или модуль WASM. Нужны там, где загрузка по URL недоступна: тесты, воркеры, SSR. */
  wasm?: SyncInitInput;
}

let ready: Promise<unknown> | undefined;

function loadWasm(options: CreateCoreOptions) {
  if (options.wasm !== undefined) return Promise.resolve(initSync({ module: options.wasm }));
  // Модуль грузится один раз; после неудачи (сеть, 404) следующий вызов пробует снова.
  ready ??= init().catch((e) => {
    ready = undefined;
    throw e;
  });
  return ready;
}

/** Ядро в браузере: тот же Rust-код, что в CLI и Tauri, скомпилированный в WASM. Порты берутся из `platform`. */
export async function createCore(
  platform: Platform,
  options: CreateCoreOptions = {},
): Promise<Core> {
  await loadWasm(options);
  const fs = fsBridge(requirePort(platform, "fs"));
  const http = httpBridge(requirePort(platform, "http"));
  return {
    async saveUrl(url, path) {
      try {
        const report = await saveUrl(fs, http, url, path);
        try {
          return { path: report.path, bytes: report.bytes };
        } finally {
          // Объект живёт в памяти WASM и сам не освобождается (в JS нет деструкторов).
          report.free();
        }
      } catch (error) {
        // Rust отклоняет промис объектом WasmError; всё остальное (паника, сбой загрузки) пробрасываем как есть.
        throw isCoreError(error) ? new CoreException(error) : error;
      }
    },
  };
}
