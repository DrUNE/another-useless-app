import { readFileSync } from "node:fs";

import { defineCoreContract } from "@app/core-api/contract";
import type { Fs, Http, Platform } from "@app/platform";

import { createCore } from "./index";

const wasm = readFileSync(new URL("../pkg/app_core_wasm_bg.wasm", import.meta.url));

// Настоящее Rust-ядро в WASM, порты в памяти. Те же сценарии прогоняют Rust-тесты IPC Tauri.
defineCoreContract("WASM core with in-memory ports", {
  async arrange(scenario) {
    const files = new Map<string, Uint8Array>();
    let httpCalls = 0;

    const fs: Fs = {
      readText: async () => "",
      readBytes: async (path) => files.get(path) ?? new Uint8Array(),
      writeText: async () => {},
      writeBytes: async (path, data) => {
        if (scenario.fs?.writeFails) throw new Error("write failed");
        files.set(path, data);
      },
      exists: async (path) => files.has(path),
      mkdir: async () => {},
      readDir: async () => [],
      remove: async () => {},
      appDataDir: async () => "",
    };

    const http: Http = async () => {
      httpCalls++;
      if ("fail" in scenario.http) throw new TypeError("Failed to fetch");
      const { status, body } = scenario.http;
      const bytes = new TextEncoder().encode(body);
      return {
        status,
        ok: status >= 200 && status < 300,
        header: () => null,
        text: async () => body,
        json: async <T>() => JSON.parse(body) as T,
        bytes: async () => bytes,
      };
    };

    const platform: Platform = { id: "web", fs, http };
    return {
      core: await createCore(platform, { wasm }),
      url: "http://example.test/",
      observe: () => ({ written: files.size > 0, httpContacted: httpCalls > 0 }),
    };
  },
});
