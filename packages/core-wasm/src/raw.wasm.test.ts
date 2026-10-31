import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { initSync, saveUrl, type WasmFs, type WasmHttp } from "../pkg/app_core_wasm.js";

// Тесты грузят настоящий WASM и вызывают его так же, как это делает createCore: с границы TypeScript.
// Запускаются на bun без Node.js (ADR-0013); требуют собранного `pkg`, поэтому идут отдельным скриптом `test:wasm`.
beforeAll(() => {
  initSync({ module: readFileSync(new URL("../pkg/app_core_wasm_bg.wasm", import.meta.url)) });
});

function memoryFs() {
  const files = new Map<string, Uint8Array>();
  const fs: WasmFs = {
    read: async (path) => {
      const file = files.get(path);
      if (file === undefined) throw new Error(`no such file: ${path}`);
      return file;
    },
    write: async (path, data) => {
      files.set(path, data);
    },
    exists: async (path) => files.has(path),
  };
  return { fs, files };
}

const respond = (status: number, body: number[]): WasmHttp => ({
  get: async () => ({ status, body: new Uint8Array(body) }),
});

/** Порт с намеренно неверной формой ответа: проверяем, что граница не доверяет JS-стороне. */
const malformed = (response: unknown) => ({ get: async () => response }) as unknown as WasmHttp;

const rejecting = (error: unknown): WasmFs => ({
  ...memoryFs().fs,
  write: async () => {
    // Причина намеренно не обязана быть Error: граница должна переварить и строку.
    throw error;
  },
});

describe("raw saveUrl across the real WASM boundary", () => {
  it("downloads through the http port and writes through the fs port", async () => {
    const { fs, files } = memoryFs();
    const report = await saveUrl(fs, respond(200, [104, 105]), "http://x", "a/b.txt");
    expect([report.path, report.bytes]).toEqual(["a/b.txt", 2]);
    expect(files.get("a/b.txt")).toEqual(new Uint8Array([104, 105]));
    report.free();
  });

  it("rejects an error status and writes nothing", async () => {
    const { fs, files } = memoryFs();
    await expect(saveUrl(fs, respond(404, []), "http://x", "a.txt")).rejects.toEqual({
      kind: "status",
      code: 404,
    });
    expect(files.size).toBe(0);
  });

  it("reports an Error thrown by the fs port as an io error", async () => {
    const fs = rejecting(new Error("disk full"));
    await expect(saveUrl(fs, respond(200, [1]), "http://x", "a.txt")).rejects.toEqual({
      kind: "io",
      message: "disk full",
    });
  });

  it("reports a plain string thrown by a port", async () => {
    const fs = rejecting("quota exceeded");
    await expect(saveUrl(fs, respond(200, [1]), "http://x", "a.txt")).rejects.toEqual({
      kind: "io",
      message: "quota exceeded",
    });
  });

  it("reports a failed request as a network error", async () => {
    const http: WasmHttp = {
      get: async () => {
        throw new TypeError("Failed to fetch");
      },
    };
    await expect(saveUrl(memoryFs().fs, http, "http://x", "a.txt")).rejects.toEqual({
      kind: "network",
      message: "Failed to fetch",
    });
  });

  it("rejects an http response whose body is not a Uint8Array", async () => {
    const { fs, files } = memoryFs();
    const http = malformed({ status: 200, body: "text" });
    await expect(saveUrl(fs, http, "http://x", "a.txt")).rejects.toEqual({
      kind: "network",
      message: "get() response body must be Uint8Array",
    });
    expect(files.size).toBe(0);
  });

  it("rejects an http response without a numeric status", async () => {
    const http = malformed({ body: new Uint8Array([1]) });
    await expect(saveUrl(memoryFs().fs, http, "http://x", "a.txt")).rejects.toEqual({
      kind: "network",
      message: "get() response has no numeric status",
    });
  });

  it("rejects an untrusted path before touching either port", async () => {
    const { fs, files } = memoryFs();
    let contacted = false;
    const http: WasmHttp = {
      get: async () => {
        contacted = true;
        return { status: 200, body: new Uint8Array([1]) };
      },
    };
    await expect(saveUrl(fs, http, "http://x", "../escape.txt")).rejects.toEqual({
      kind: "invalidPath",
      path: "../escape.txt",
    });
    expect(contacted).toBe(false);
    expect(files.size).toBe(0);
  });
});
