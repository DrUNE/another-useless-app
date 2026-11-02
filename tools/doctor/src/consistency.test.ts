import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { packageManagerVersion, readPackageList, toolchainChannel } from "./parse";

// Версии живут в нескольких файлах (package.json, devcontainer, CI). Этот тест ловит расхождение до того,
// как оно проявится как «у меня работает».
const root = join(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const legacyRussianDocs = new Set([
  "docs/adr/README.md",
  "docs/adr/0001-record-architecture-decisions.md",
  "docs/adr/0002-rust-core-wasm-for-web.md",
  "docs/adr/0003-ports-and-adapters.md",
  "docs/adr/0004-ports-futures-not-send.md",
  "docs/adr/0005-bun-workspaces-with-catalog.md",
  "docs/adr/0006-independent-builds.md",
  "docs/adr/0007-protect-main-squash-only.md",
  "docs/adr/0008-wasm-boundary.md",
  "docs/adr/0009-typed-ipc-tauri-specta.md",
  "docs/adr/0010-native-app-isolation-and-trust.md",
  "docs/adr/0011-oxc-lint-and-format.md",
  "docs/adr/0012-reproducible-dev-environment.md",
  "docs/adr/0013-wasm-boundary-tests-in-typescript.md",
  "docs/adr/0014-ui-core-boundary.md",
  "docs/adr/0015-dependency-boundaries-as-data.md",
  "docs/adr/0016-web-e2e-in-a-real-browser.md",
  "docs/adr/0017-os-matrix-gate-and-path-selection.md",
  "docs/adr/0018-dependency-supply-chain-checks.md",
  "docs/adr/0019-licenses.md",
  "docs/learning/rust-for-typescript-developers.md",
  "docs/learning/solid-and-tailwind-for-react-developers.md",
]);

function markdownFiles(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

describe("documentation languages", () => {
  it("requires both language versions for every non-legacy document", () => {
    const documents = [
      "README.md",
      "README.ru.md",
      "AGENTS.md",
      "AGENTS.ru.md",
      ...markdownFiles("docs"),
    ];
    for (const document of documents) {
      if (document.endsWith(".ru.md")) {
        expect(documents, document).toContain(document.replace(/\.ru\.md$/, ".md"));
      } else if (!legacyRussianDocs.has(document)) {
        expect(documents, document).toContain(document.replace(/\.md$/, ".ru.md"));
      }
    }
  });
});

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
  it("VS Code and Zed keep shared debug scenarios and tasks in sync", () => {
    const vscodeLaunch = JSON.parse(read(".vscode/launch.json")) as {
      configurations: Array<{ name: string; request: string; preLaunchTask?: string }>;
    };
    const zedDebug = JSON.parse(read(".zed/debug.json")) as Array<{
      label: string;
      request: string;
      adapter?: string;
      build?: string | { command: string };
    }>;
    const vscodeNames = vscodeLaunch.configurations.map((config) => config.name);
    for (const config of zedDebug) {
      expect(vscodeNames).toContain(config.label);
      if (config.adapter === "CodeLLDB" && typeof config.build === "object")
        expect(config.build.command).toBe("cargo");
      if (config.label.startsWith("Web frontend:")) {
        expect(config.build === "web: ensure dev server").toBe(config.request === "launch");
      }
    }
    for (const config of vscodeLaunch.configurations) {
      if (config.name.startsWith("Web frontend:")) {
        expect(config.preLaunchTask === "web: ensure dev server").toBe(config.request === "launch");
      }
    }
    expect(vscodeNames).toContain("Web frontend: launch Firefox");
    expect(vscodeNames).toContain("Web frontend: attach Firefox");

    const vscodeTasks = JSON.parse(read(".vscode/tasks.json")) as {
      tasks: Array<{ label: string }>;
    };
    const zedTasks = JSON.parse(read(".zed/tasks.json")) as Array<{ label: string }>;
    expect(vscodeTasks.tasks.map((task) => task.label).toSorted()).toEqual(
      zedTasks.map((task) => task.label).toSorted(),
    );
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
