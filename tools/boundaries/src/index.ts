import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Metadata, checkRust } from "./rust";
import { checkTs, readWorkspace } from "./ts";
import type { Rules, Violation } from "./types";

type Group = "rust" | "ts";

/** Платформа, на которой идёт проверка: без фильтра `cargo metadata` показал бы и ветки под чужие платформы (например, wasm32 у reqwest). */
function hostTriple(root: string): string {
  const out = spawnSync("rustc", ["-vV"], { cwd: root, encoding: "utf8", env: noAutoInstall() });
  const host = /^host: (.+)$/m.exec(out.stdout)?.[1];
  if (!host)
    throw new Error(
      `не удалось определить платформу по rustc -vV: ${out.stderr || out.error?.message}`,
    );
  return host;
}

// Диагностика читает, а не меняет систему: rustup не должен сам ставить тулчейн (см. tools/doctor).
const noAutoInstall = () => ({ ...process.env, RUSTUP_AUTO_INSTALL: "0" });

function metadata(root: string, triple: string): Metadata {
  const out = spawnSync(
    "cargo",
    ["metadata", "--format-version", "1", "--locked", "--filter-platform", triple],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 1 << 29,
      env: noAutoInstall(),
    },
  );
  if (out.status !== 0)
    throw new Error(
      `cargo metadata (${triple}) завершился с ошибкой:\n${out.stderr || out.error?.message}`,
    );
  return JSON.parse(out.stdout) as Metadata;
}

export function runGroup(group: Group, root: string, rules: Rules): Violation[] {
  if (group === "ts") {
    const packages = readWorkspace(root);
    return rules.ts.flatMap((rule) => checkTs(packages, rule));
  }
  const host = hostTriple(root);
  const cache = new Map<string, Metadata>();
  return rules.rust.flatMap((rule) => {
    const triple = rule.target === "host" ? host : rule.target;
    if (!cache.has(triple)) cache.set(triple, metadata(root, triple));
    return checkRust(cache.get(triple) as Metadata, rule);
  });
}

function main(args: string[]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const rules = JSON.parse(
    readFileSync(join(root, "tools/boundaries/rules.json"), "utf8"),
  ) as Rules;
  const groups = (["rust", "ts"] as Group[]).filter((g) => args.length === 0 || args.includes(g));

  let total = 0;
  for (const group of groups) {
    let violations: Violation[];
    try {
      violations = runGroup(group, root, rules);
    } catch (error) {
      console.error(
        `[${group}] ошибка проверки: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(2);
    }
    const count = group === "rust" ? rules.rust.length : rules.ts.length;
    console.log(`\n[${group}] правил: ${count}, нарушений: ${violations.length}`);
    for (const v of violations) console.log(`  ✗ ${v.subject}: ${v.message}\n      → ${v.why}`);
    total += violations.length;
  }
  console.log(total === 0 ? "\nГраницы соблюдены." : `\nНарушений: ${total}.`);
  process.exit(total === 0 ? 0 : 1);
}

if (import.meta.main) main(process.argv.slice(2));
