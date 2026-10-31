import type { Fs, Http } from "@app/platform";
import { describe, expect, it } from "vitest";

import { fsBridge, httpBridge } from "./bridge";

function recordingFs() {
  const calls: string[] = [];
  const files = new Map<string, Uint8Array>();
  const fs: Fs = {
    readText: async () => "",
    readBytes: async (p) => files.get(p) ?? new Uint8Array(),
    writeText: async () => {},
    writeBytes: async (p, d) => {
      calls.push(`write ${p}`);
      files.set(p, d);
    },
    exists: async (p) => files.has(p),
    mkdir: async (p) => {
      calls.push(`mkdir ${p}`);
    },
    readDir: async () => [],
    remove: async () => {},
    appDataDir: async () => "",
  };
  return { fs, calls };
}

describe("fsBridge", () => {
  it("creates the parent directory before writing a nested file", async () => {
    const { fs, calls } = recordingFs();
    await fsBridge(fs).write("a/b/c.txt", new Uint8Array([1]));
    expect(calls).toEqual(["mkdir a/b", "write a/b/c.txt"]);
  });

  it("does not call mkdir for a file in the root", async () => {
    const { fs, calls } = recordingFs();
    await fsBridge(fs).write("c.txt", new Uint8Array([1]));
    expect(calls).toEqual(["write c.txt"]);
  });

  it("reads bytes and checks existence through the platform port", async () => {
    const { fs } = recordingFs();
    const bridge = fsBridge(fs);
    await bridge.write("x.bin", new Uint8Array([7, 8]));
    expect(await bridge.read("x.bin")).toEqual(new Uint8Array([7, 8]));
    expect(await bridge.exists("x.bin")).toBe(true);
    expect(await bridge.exists("nope")).toBe(false);
  });
});

describe("httpBridge", () => {
  it("maps an HttpResponse to the status and body expected by Rust", async () => {
    const http: Http = async () => ({
      status: 201,
      ok: true,
      header: () => null,
      text: async () => "",
      json: async <T>() => ({}) as T,
      bytes: async () => new Uint8Array([1, 2, 3]),
    });
    expect(await httpBridge(http).get("http://x")).toEqual({
      status: 201,
      body: new Uint8Array([1, 2, 3]),
    });
  });

  it("propagates network errors unchanged", async () => {
    const http: Http = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(httpBridge(http).get("http://x")).rejects.toThrow("Failed to fetch");
  });
});
