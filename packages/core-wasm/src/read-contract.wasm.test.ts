import { readFileSync } from "node:fs";

import { defineReadFileContract } from "@app/core-api/contract";
import type { Fs, Http, Platform } from "@app/platform";

import { createCore } from "./index";

const wasm = readFileSync(new URL("../pkg/app_core_wasm_bg.wasm", import.meta.url));

defineReadFileContract("WASM core with in-memory ports", {
  async arrange(scenario) {
    let readCalls = 0;
    const bytes =
      "body" in scenario.file ? new TextEncoder().encode(scenario.file.body) : undefined;
    const fs: Fs = {
      readText: async () => "",
      readBytes: async () => {
        readCalls++;
        if (bytes === undefined) throw new Error("read failed");
        return bytes;
      },
      writeText: async () => {},
      writeBytes: async () => {},
      exists: async () => bytes !== undefined,
      mkdir: async () => {},
      readDir: async () => [],
      remove: async () => {},
      appDataDir: async () => "",
    };
    const http: Http = async () => {
      throw new Error("HTTP is not used by readFile");
    };
    const platform: Platform = { id: "web", fs, http };
    return {
      core: await createCore(platform, { wasm }),
      observe: () => ({ readAttempted: readCalls > 0 }),
    };
  },
});
