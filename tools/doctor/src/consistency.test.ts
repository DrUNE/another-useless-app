import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { packageManagerVersion, readPackageList, toolchainChannel } from "./parse";

// Версии живут в нескольких файлах (package.json, devcontainer, CI). Этот тест ловит расхождение до того,
// как оно проявится как «у меня работает».
const root = join(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("version pins agree across the repository", () => {
  it("devcontainer builds with the same bun as packageManager", () => {
    const devcontainer = JSON.parse(read(".devcontainer/devcontainer.json")) as {
      build: { args: { BUN_VERSION: string } };
    };
    expect(devcontainer.build.args.BUN_VERSION).toBe(packageManagerVersion(read("package.json")));
  });

  it("Rust is pinned to an exact version, not a floating channel", () => {
    expect(toolchainChannel(read("rust-toolchain.toml"))).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("CI takes versions from the files instead of hard-coding them", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).not.toMatch(/bun-version:\s*\d/);
    expect(ci).not.toContain("dtolnay/rust-toolchain");
    expect(ci).toContain("bun-version-file: package.json");
    expect(ci).toContain("tools/system-deps/debian.txt");
  });

  it("CI and the image share one system package list", () => {
    expect(read(".devcontainer/Dockerfile")).toContain("tools/system-deps/debian.txt");
    expect(readPackageList(read("tools/system-deps/debian.txt"))).toContain(
      "libwebkit2gtk-4.1-dev",
    );
  });
  it("both workflows run the same cargo-deny", () => {
    const pinned = (file: string) => /cargo-deny@([\d.]+)/.exec(read(file))?.[1];
    expect(pinned(".github/workflows/ci.yml")).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pinned(".github/workflows/audit.yml")).toBe(pinned(".github/workflows/ci.yml"));
  });

  it("every advisory exception in deny.toml states a reason", () => {
    const exceptions = read("deny.toml")
      .split("\n")
      .filter((line) => line.includes('{ id = "RUSTSEC-'));
    expect(exceptions.length).toBeGreaterThan(0);
    for (const line of exceptions) expect(line, line).toMatch(/reason = ".{20,}"/);
  });
});
