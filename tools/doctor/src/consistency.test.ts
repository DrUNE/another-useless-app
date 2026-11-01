import { createHash } from "node:crypto";
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

  it("devcontainer and workspace recommend the same VS Code extensions", () => {
    const devcontainer = JSON.parse(read(".devcontainer/devcontainer.json")) as {
      customizations: { vscode: { extensions: string[] } };
    };
    const workspace = JSON.parse(read(".vscode/extensions.json")) as { recommendations: string[] };
    expect(devcontainer.customizations.vscode.extensions.toSorted()).toEqual(
      workspace.recommendations.toSorted(),
    );
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
  it("the licenses are in place and every manifest declares them", () => {
    const mit = read("LICENSE");
    expect(mit).toMatch(/^MIT License\n/);
    expect(mit).toContain("Copyright (c) 2026 Andrey Litvinov");
    expect(mit).toContain("Permission is hereby granted, free of charge");

    // Официальный текст CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/legalcode.txt) лежит в docs/LICENSE без изменений:
    // меняется только пояснение сверху. Контрольная сумма закреплена, чтобы случайная правка текста лицензии не прошла.
    const docs = read("docs/LICENSE");
    expect(docs).toContain("Creative Commons Attribution 4.0 International (CC BY 4.0)");
    const official = docs.slice(docs.indexOf("Attribution 4.0 International\n\n====="));
    expect(createHash("sha256").update(official).digest("hex")).toBe(
      "9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411",
    );

    expect(read("Cargo.toml")).toMatch(/^license = "MIT"$/m);
    expect(JSON.parse(read("package.json")).license).toBe("MIT");
    const crates = [
      "crates/core",
      "crates/platform-native",
      "crates/cli",
      "crates/core-wasm",
      "apps/native/src-tauri",
    ];
    for (const crate of crates)
      expect(read(`${crate}/Cargo.toml`), crate).toContain("license.workspace = true");
  });
});
