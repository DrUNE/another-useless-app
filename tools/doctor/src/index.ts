import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Check, type Context, type Group, checks } from "./checks";

const GROUPS: Group[] = ["core", "wasm", "native"];

export function selectChecks(all: Check[], args: string[]): Check[] {
  const wanted = args.filter((a): a is Group => (GROUPS as string[]).includes(a));
  return wanted.length === 0 ? all : all.filter((c) => wanted.includes(c.group));
}

export function createContext(root: string): Context {
  return {
    platform: process.platform,
    read: (path) => {
      const file = path.startsWith("/") ? path : join(root, path);
      return existsSync(file) ? readFileSync(file, "utf8") : undefined;
    },
    exists: existsSync,
    run: (command, args) => {
      // Диагностика не должна менять систему: без этого rustup сам скачает тулчейн из rust-toolchain.toml
      // при первом вызове rustc, и проверка «установлен ли Rust» всегда проходила бы.
      const env = { ...process.env, RUSTUP_AUTO_INSTALL: "0" };
      const result = spawnSync(command, args, { cwd: root, encoding: "utf8", env });
      if (result.error) return { ok: false, output: result.error.message };
      return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
    },
  };
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const ctx = createContext(root);
  const selected = selectChecks(checks, process.argv.slice(2));
  const icon = { ok: "✓", fail: "✗", skip: "-" } as const;

  let failed = 0;
  for (const group of GROUPS) {
    const inGroup = selected.filter((c) => c.group === group);
    if (inGroup.length === 0) continue;
    console.log(`\n[${group}]`);
    for (const check of inGroup) {
      const outcome = check.run(ctx);
      if (outcome.status === "fail") failed++;
      console.log(`  ${icon[outcome.status]} ${check.title}: ${outcome.detail}`);
      if (outcome.status !== "ok" && outcome.hint) console.log(`      → ${outcome.hint}`);
    }
  }
  console.log(failed === 0 ? "\nОкружение в порядке." : `\nПроблем: ${failed}.`);
  process.exit(failed === 0 ? 0 : 1);
}

if (import.meta.main) main();
