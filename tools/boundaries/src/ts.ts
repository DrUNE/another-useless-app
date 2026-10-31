import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { matches, matchesAny } from "./match";
import type { TsRule, Violation } from "./types";

export interface WorkspacePackage {
  name: string;
  dependencies: string[];
  devDependencies: string[];
}

/** Пакеты воркспейса по шаблонам `workspaces.packages` корневого package.json (поддерживается вид `каталог/*`). */
export function readWorkspace(root: string): WorkspacePackage[] {
  const globs = (
    JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      workspaces: { packages: string[] };
    }
  ).workspaces.packages;

  const packages: WorkspacePackage[] = [];
  for (const glob of globs) {
    if (!glob.endsWith("/*")) throw new Error(`неподдерживаемый шаблон воркспейса: ${glob}`);
    const base = join(root, glob.slice(0, -2));
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const file = join(base, entry.name, "package.json");
      if (!entry.isDirectory() || !existsSync(file)) continue;
      const json = JSON.parse(readFileSync(file, "utf8")) as {
        name: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      packages.push({
        name: json.name,
        dependencies: Object.keys(json.dependencies ?? {}),
        devDependencies: Object.keys(json.devDependencies ?? {}),
      });
    }
  }
  return packages;
}

/** Всё, что пакет тянет через `dependencies`, включая зависимости пакетов воркспейса; с кратчайшей цепочкой. */
function reachable(packages: WorkspacePackage[], name: string): Map<string, string[]> {
  const byName = new Map(packages.map((p) => [p.name, p]));
  const chains = new Map<string, string[]>();
  const queue: string[] = [name];
  chains.set(name, [name]);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const dep of byName.get(current)?.dependencies ?? []) {
      if (chains.has(dep)) continue;
      chains.set(dep, [...(chains.get(current) ?? []), dep]);
      queue.push(dep);
    }
  }
  chains.delete(name);
  return chains;
}

export function checkTs(packages: WorkspacePackage[], rule: TsRule): Violation[] {
  const pkg = packages.find((p) => p.name === rule.package);
  if (!pkg)
    throw new Error(`пакет "${rule.package}" из правил не найден в воркспейсе (правило устарело?)`);

  const found: Violation[] = [];
  if (rule.directOnly) {
    for (const dep of pkg.dependencies.filter(
      (d) => !rule.directOnly?.some((allowed) => matches(allowed, d)),
    )) {
      found.push({
        subject: rule.package,
        message: `зависимость "${dep}" не разрешена (допустимо: ${rule.directOnly.join(", ") || "ничего"})`,
        why: rule.why,
      });
    }
  }
  if (rule.forbidTransitive) {
    // Запрет действует и на devDependencies самого пакета: то, чего пакет не должен знать, не нужно и для сборки.
    for (const dep of pkg.devDependencies.filter((d) =>
      matchesAny(rule.forbidTransitive ?? [], d),
    )) {
      found.push({
        subject: rule.package,
        message: `devDependency "${dep}" запрещена`,
        why: rule.why,
      });
    }
    for (const [dep, chain] of reachable(packages, rule.package)) {
      if (matchesAny(rule.forbidTransitive, dep)) {
        found.push({
          subject: rule.package,
          message: `достигает запрещённого "${dep}": ${chain.join(" → ")}`,
          why: rule.why,
        });
      }
    }
  }
  return found;
}
