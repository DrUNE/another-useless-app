import { requirePort, type Platform } from "@app/platform";

import init, { saveUrl } from "../pkg/app_core_wasm.js";
import { fsBridge, httpBridge } from "./bridge";

export interface SaveReport {
  path: string;
  bytes: number;
}

/** Ядро в виде обычного TS-API. Что внутри (WASM, IPC) вызывающий код не знает. */
export interface Core {
  saveUrl(url: string, path: string): Promise<SaveReport>;
}

let ready: Promise<unknown> | undefined;

function loadWasm() {
  // Модуль грузится один раз; после неудачи (сеть, 404) следующий вызов пробует снова.
  ready ??= init().catch((e) => {
    ready = undefined;
    throw e;
  });
  return ready;
}

export async function createCore(platform: Platform): Promise<Core> {
  await loadWasm();
  const fs = fsBridge(requirePort(platform, "fs"));
  const http = httpBridge(requirePort(platform, "http"));
  return {
    async saveUrl(url, path) {
      const report = await saveUrl(fs, http, url, path);
      try {
        return { path: report.path, bytes: report.bytes };
      } finally {
        // Объект живёт в памяти WASM и сам не освобождается (в JS нет деструкторов).
        report.free();
      }
    },
  };
}
