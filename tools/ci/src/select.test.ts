import { describe, expect, it } from "vitest";

import { type Job, select } from "./select";

const ran = (files: string[]): Job[] =>
  Object.entries(select(files))
    .filter(([, run]) => run)
    .map(([job]) => job as Job)
    .sort();

describe("select", () => {
  it("runs nothing heavy for documentation only", () => {
    expect(ran(["README.md", "docs/adr/0017-x.md", ".github/PULL_REQUEST_TEMPLATE.md"])).toEqual(
      [],
    );
  });

  it("skips the TS job for a Rust-only change but keeps everything that builds Rust", () => {
    expect(ran(["crates/core/src/path.rs"])).toEqual(["native", "rust", "wasm"]);
  });

  it("skips Rust and the desktop build for a change that only touches the web app", () => {
    expect(ran(["apps/web/src/index.tsx"])).toEqual(["ts", "wasm"]);
  });

  it("skips the web job for a change that only touches the desktop app", () => {
    expect(ran(["apps/native/src/core.ts"])).toEqual(["native", "ts"]);
    expect(ran(["apps/native/src-tauri/src/lib.rs"])).toEqual(["native", "rust"]);
  });

  it("runs everything for files that affect every job, and for CI itself", () => {
    for (const file of [
      "package.json",
      "bun.lock",
      ".github/workflows/ci.yml",
      "rust-toolchain.toml",
      ".gitattributes",
    ]) {
      const jobs = ran([file]);
      expect(jobs.length, file).toBeGreaterThanOrEqual(3);
    }
    expect(ran([".github/workflows/ci.yml"])).toEqual(["native", "rust", "ts", "wasm"]);
  });

  it("treats a file nobody listed as relevant to every job: a gap in the lists must not skip a check", () => {
    expect(ran(["some/new/place/file.xyz"])).toEqual(["native", "rust", "ts", "wasm"]);
  });

  it("runs a job if any changed file is relevant to it, even next to irrelevant ones", () => {
    expect(ran(["docs/a.md", "crates/core/src/lib.rs"])).toEqual(["native", "rust", "wasm"]);
  });

  it("does not know what changed for an empty list, so it runs everything", () => {
    expect(ran([])).toEqual(["native", "rust", "ts", "wasm"]);
  });
});
