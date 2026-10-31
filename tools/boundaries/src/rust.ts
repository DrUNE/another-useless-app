import { matchesAny } from "./match";
import type { RustRule, Violation } from "./types";

// Минимум полей `cargo metadata`, которые нам нужны.
export interface Metadata {
  packages: {
    id: string;
    name: string;
    source: string | null;
    dependencies: { name: string; kind: string | null }[];
  }[];
  resolve: {
    nodes: { id: string; deps: { pkg: string; dep_kinds: { kind: string | null }[] }[] }[];
  };
}

/** Все крейты, достижимые по обычным (не dev и не build) зависимостям, с кратчайшей цепочкой до каждого. */
export function reachable(meta: Metadata, crate: string): Map<string, string[]> {
  const names = new Map(meta.packages.map((p) => [p.id, p.name]));
  const root = meta.packages.find((p) => p.name === crate && p.source === null);
  if (!root)
    throw new Error(`крейт "${crate}" из правил не найден в воркспейсе (правило устарело?)`);
  const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));

  const chains = new Map<string, string[]>([[root.id, [crate]]]);
  const queue = [root.id];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const dep of nodes.get(id)?.deps ?? []) {
      if (!dep.dep_kinds.some((k) => k.kind === null) || chains.has(dep.pkg)) continue;
      chains.set(dep.pkg, [...(chains.get(id) ?? []), names.get(dep.pkg) ?? dep.pkg]);
      queue.push(dep.pkg);
    }
  }
  return new Map([...chains].map(([id, chain]) => [names.get(id) ?? id, chain]));
}

export function checkRust(meta: Metadata, rule: RustRule): Violation[] {
  const found: Violation[] = [];
  const where = `${rule.crate} (${rule.target})`;
  const closure = reachable(meta, rule.crate);

  if (rule.directOnly) {
    const pkg = meta.packages.find((p) => p.name === rule.crate && p.source === null);
    const direct = (pkg?.dependencies ?? []).filter((d) => d.kind === null).map((d) => d.name);
    for (const name of direct.filter((d) => !rule.directOnly?.includes(d))) {
      found.push({
        subject: where,
        message: `прямая зависимость "${name}" не разрешена (допустимо: ${rule.directOnly.join(", ") || "ничего"})`,
        why: rule.why,
      });
    }
  }
  if (rule.forbidTransitive) {
    for (const [name, chain] of closure) {
      if (matchesAny(rule.forbidTransitive, name)) {
        found.push({
          subject: where,
          message: `достигает запрещённого "${name}": ${chain.join(" → ")}`,
          why: rule.why,
        });
      }
    }
  }
  return found;
}
