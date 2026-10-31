import { describe, expect, it } from "vitest";

import { type Check, type Context, checks } from "./checks";
import { selectChecks } from "./index";

const FILES: Record<string, string> = {
  "package.json": '{"packageManager":"bun@1.4.4"}',
  "rust-toolchain.toml": '[toolchain]\nchannel = "1.99.1"\n',
  "Cargo.lock": '[[package]]\nname = "wasm-bindgen"\nversion = "0.2.130"\n',
  "tools/system-deps/debian.txt": "pkg-config\nlibwebkit2gtk-4.1-dev\n",
  "/etc/os-release": "ID=ubuntu\nID_LIKE=debian\n",
};

type Commands = Record<string, { ok: boolean; output: string }>;

/** Окружение, где известные команды отвечают заданным текстом, а остальные «не установлены». */
function context(commands: Commands, overrides: Partial<Context> = {}): Context {
  return {
    platform: "linux",
    read: (path) => FILES[path],
    exists: () => true,
    run: (command, args) =>
      commands[[command, ...args].join(" ")] ?? { ok: false, output: "command not found" },
    ...overrides,
  };
}

const find = (title: string): Check => {
  const check = checks.find((c) => c.title.includes(title));
  if (!check) throw new Error(`no check "${title}"`);
  return check;
};

describe("version checks", () => {
  it("pass when versions match the files", () => {
    const ctx = context({
      "bun --version": { ok: true, output: "1.4.4\n" },
      "rustc --version": { ok: true, output: "rustc 1.99.1 (58cf8f9c3 2026-10-13)" },
      "wasm-bindgen --version": { ok: true, output: "wasm-bindgen 0.2.130" },
    });
    expect(find("bun").run(ctx).status).toBe("ok");
    expect(find("Rust").run(ctx).status).toBe("ok");
    expect(find("wasm-bindgen-cli").run(ctx).status).toBe("ok");
  });

  it("fail with both versions and a fix when wasm-bindgen drifted from Cargo.lock", () => {
    const outcome = find("wasm-bindgen-cli").run(
      context({ "wasm-bindgen --version": { ok: true, output: "wasm-bindgen 0.2.120" } }),
    );
    expect(outcome.status).toBe("fail");
    expect(outcome.detail).toContain("0.2.120");
    expect(outcome.detail).toContain("0.2.130");
    expect(outcome.hint).toBe("cargo install wasm-bindgen-cli --version 0.2.130 --locked");
  });

  it("fail with an install hint when a tool is missing", () => {
    const outcome = find("bun").run(context({}));
    expect(outcome.status).toBe("fail");
    expect(outcome.detail).toBe("не установлен");
  });

  it("detect a missing wasm32 target", () => {
    const missing = context({
      "rustup target list --installed": { ok: true, output: "x86_64-unknown-linux-gnu\n" },
    });
    const present = context({
      "rustup target list --installed": {
        ok: true,
        output: "wasm32-unknown-unknown\nx86_64-unknown-linux-gnu\n",
      },
    });
    expect(find("wasm32").run(missing).status).toBe("fail");
    expect(find("wasm32").run(present).status).toBe("ok");
  });
});

describe("Node.js check", () => {
  const node = find("Node.js");
  it("passes with a real Node.js", () => {
    const outcome = node.run(
      context({
        "node -p process.versions.bun ? 'bun' : process.version": {
          ok: true,
          output: "v24.22.1\n",
        },
      }),
    );
    expect(outcome).toMatchObject({ status: "ok", detail: "v24.22.1" });
  });
  it("warns, not fails, when only bun's shim answers", () => {
    const outcome = node.run(
      context({
        "node -p process.versions.bun ? 'bun' : process.version": { ok: true, output: "bun\n" },
      }),
    );
    expect(outcome.status).toBe("warn");
    expect(outcome.detail).toContain("шим bun");
  });
  it("warns when node is not installed", () => {
    expect(node.run(context({})).status).toBe("warn");
  });
});

describe("system libraries (Linux)", () => {
  const libs = find("системные библиотеки");
  const allFound = (ctx: Partial<Context> = {}) =>
    context({}, { run: () => ({ ok: true, output: "" }), ...ctx });

  it("pass when everything is present", () => {
    expect(libs.run(allFound()).status).toBe("ok");
  });

  it("list what is missing and give the apt command from the shared package list on Debian", () => {
    const outcome = libs.run(
      allFound({ run: (_c, args) => ({ ok: args[1] !== "gtk+-3.0", output: "" }) }),
    );
    expect(outcome.status).toBe("fail");
    expect(outcome.detail).toContain("gtk+-3.0");
    expect(outcome.hint).toBe("sudo apt-get install -y pkg-config libwebkit2gtk-4.1-dev");
  });

  it("report the libxdo header and use ALT package names on ALT", () => {
    const outcome = libs.run(
      allFound({
        exists: () => false,
        read: (path) => (path === "/etc/os-release" ? "ID=altlinux\n" : FILES[path]),
      }),
    );
    expect(outcome.detail).toContain("xdo");
    expect(outcome.hint).toContain("libwebkit2gtk4.1-devel");
    expect(outcome.hint).toContain("xdotool-devel");
  });

  it("link to the Tauri docs for distributions it does not know", () => {
    const outcome = libs.run(
      allFound({
        run: () => ({ ok: false, output: "" }),
        read: (path) => (path === "/etc/os-release" ? "ID=fedora\n" : FILES[path]),
      }),
    );
    expect(outcome.hint).toContain("v2.tauri.app");
  });

  it("skip honestly on Windows instead of pretending to check", () => {
    expect(libs.run(context({}, { platform: "win32" })).status).toBe("skip");
  });
});

describe("group selection", () => {
  it("runs everything without arguments and only the named groups otherwise", () => {
    expect(selectChecks(checks, [])).toHaveLength(checks.length);
    expect(selectChecks(checks, ["wasm"]).every((c) => c.group === "wasm")).toBe(true);
    expect(new Set(selectChecks(checks, ["core", "native"]).map((c) => c.group))).toEqual(
      new Set(["core", "native"]),
    );
  });
});
