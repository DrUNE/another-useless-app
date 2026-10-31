import {
  distroFamily,
  lockedVersion,
  packageManagerVersion,
  readPackageList,
  toolchainChannel,
  versionFromOutput,
} from "./parse";

export type Group = "core" | "wasm" | "native";
export type Status = "ok" | "warn" | "fail" | "skip";

export interface Outcome {
  status: Status;
  detail: string;
  /** Что сделать, если проверка не прошла. */
  hint?: string;
}

/** Всё, что проверки берут из окружения. Подменяется в тестах, поэтому логика не зависит от машины. */
export interface Context {
  platform: NodeJS.Platform;
  /** Читает файл относительно корня репозитория; `undefined`, если его нет. */
  read(path: string): string | undefined;
  exists(absolutePath: string): boolean;
  run(command: string, args: string[]): { ok: boolean; output: string };
}

export interface Check {
  group: Group;
  title: string;
  run(ctx: Context): Outcome;
}

const TAURI_PREREQUISITES = "https://v2.tauri.app/start/prerequisites/";

function compareVersion(
  expected: string | undefined,
  actualOutput: { ok: boolean; output: string },
  source: string,
  hint: string,
): Outcome {
  if (expected === undefined) return { status: "fail", detail: `версия не найдена в ${source}` };
  if (!actualOutput.ok) return { status: "fail", detail: "не установлен", hint };
  const actual = versionFromOutput(actualOutput.output);
  if (actual === expected) return { status: "ok", detail: actual };
  return {
    status: "fail",
    detail: `установлена ${actual ?? "неизвестная"}, нужна ${expected} (${source})`,
    hint,
  };
}

// Модули pkg-config, которые ищут сборочные скрипты Tauri на Linux (+ заголовок libxdo, у неё нет .pc).
const LINUX_MODULES = [
  "webkit2gtk-4.1",
  "javascriptcoregtk-4.1",
  "libsoup-3.0",
  "gtk+-3.0",
  "librsvg-2.0",
  "openssl",
  "dbus-1",
];

// Имена пакетов ALT проверены по `apt-cache`; для остальных дистрибутивов не угадываем, а даём ссылку.
const ALT_PACKAGES =
  "libwebkit2gtk4.1-devel libsoup3.0-devel libgtk+3-devel librsvg-devel libssl-devel libdbus-devel xdotool-devel";

function linuxLibraries(ctx: Context): Outcome {
  const missing = LINUX_MODULES.filter((m) => !ctx.run("pkg-config", ["--exists", m]).ok);
  if (!ctx.exists("/usr/include/xdo.h")) missing.push("libxdo (xdo.h)");
  if (missing.length === 0) return { status: "ok", detail: "все найдены" };

  const family = distroFamily(ctx.read("/etc/os-release") ?? "");
  const packages = readPackageList(ctx.read("tools/system-deps/debian.txt") ?? "");
  const hint =
    family === "debian"
      ? `sudo apt-get install -y ${packages.join(" ")}`
      : family === "alt"
        ? `sudo apt-get install -y ${ALT_PACKAGES}`
        : `пакеты вашего дистрибутива: ${TAURI_PREREQUISITES}#linux`;
  return { status: "fail", detail: `не найдено: ${missing.join(", ")}`, hint };
}

export const checks: Check[] = [
  {
    group: "core",
    title: "bun",
    run: (ctx) =>
      compareVersion(
        packageManagerVersion(ctx.read("package.json") ?? "{}"),
        ctx.run("bun", ["--version"]),
        "package.json (packageManager)",
        "установите нужную версию: https://bun.sh/docs/installation",
      ),
  },
  {
    group: "core",
    title: "Rust (по rust-toolchain.toml)",
    run: (ctx) =>
      compareVersion(
        toolchainChannel(ctx.read("rust-toolchain.toml") ?? ""),
        ctx.run("rustc", ["--version"]),
        "rust-toolchain.toml",
        "в корне репозитория выполните `rustup toolchain install` (rustup: https://rustup.rs)",
      ),
  },
  {
    group: "wasm",
    title: "таргет wasm32-unknown-unknown",
    run: (ctx) => {
      const installed = ctx.run("rustup", ["target", "list", "--installed"]);
      return installed.ok && installed.output.includes("wasm32-unknown-unknown")
        ? { status: "ok", detail: "установлен" }
        : {
            status: "fail",
            detail: "не установлен",
            hint: "в корне репозитория выполните `rustup toolchain install` (таргеты берутся из rust-toolchain.toml)",
          };
    },
  },
  {
    group: "wasm",
    title: "wasm-bindgen-cli (версия как в Cargo.lock)",
    run: (ctx) => {
      const expected = lockedVersion(ctx.read("Cargo.lock") ?? "", "wasm-bindgen");
      return compareVersion(
        expected,
        ctx.run("wasm-bindgen", ["--version"]),
        "Cargo.lock",
        `cargo install wasm-bindgen-cli --version ${expected ?? "<версия из Cargo.lock>"} --locked`,
      );
    },
  },
  {
    group: "wasm",
    title: "Node.js (нужен только для `bun run test:wasm`)",
    run: (ctx) => {
      // `bun run` подставляет свой `node`, если настоящего нет, а wasm-bindgen-test-runner на нём не работает.
      const probe = ctx.run("node", ["-p", "process.versions.bun ? 'bun' : process.version"]);
      const answer = probe.output.trim();
      if (probe.ok && answer.startsWith("v")) return { status: "ok", detail: answer };
      return {
        status: "warn",
        detail:
          probe.ok && answer === "bun" ? "найден только шим bun, а не Node.js" : "не установлен",
        hint: "нужен только для тестов моста WASM (wasm-bindgen-test-runner); остальное работает на bun",
      };
    },
  },
  {
    group: "native",
    title: "системные библиотеки Tauri",
    run: (ctx) => {
      if (ctx.platform === "linux") return linuxLibraries(ctx);
      if (ctx.platform === "darwin") {
        return ctx.run("xcode-select", ["-p"]).ok
          ? { status: "ok", detail: "Xcode Command Line Tools найдены" }
          : {
              status: "fail",
              detail: "Xcode Command Line Tools не найдены",
              hint: "xcode-select --install",
            };
      }
      return {
        status: "skip",
        detail: "проверка для этой ОС не реализована",
        hint: `WebView2 и MSVC Build Tools: ${TAURI_PREREQUISITES}#windows`,
      };
    },
  },
];
