import { describe, expect, it } from "vitest";

import { type Metadata, checkRust, reachable } from "./rust";
import type { RustRule } from "./types";

type Dep = { name: string; kind?: "dev" | "build" | null };

/** Крейты и их зависимости; первый крейт каждой записи — из воркспейса (source = null). */
function graph(spec: Record<string, Dep[]>, external: string[] = []): Metadata {
  const ids = (n: string) => `${n} 0.1.0`;
  const names = Object.keys(spec);
  return {
    packages: [
      ...names.map((n) => ({
        id: ids(n),
        name: n,
        source: external.includes(n) ? "registry" : null,
        dependencies: (spec[n] ?? []).map((d) => ({ name: d.name, kind: d.kind ?? null })),
      })),
    ],
    resolve: {
      nodes: names.map((n) => ({
        id: ids(n),
        deps: (spec[n] ?? []).map((d) => ({
          pkg: ids(d.name),
          dep_kinds: [{ kind: d.kind ?? null }],
        })),
      })),
    },
  };
}

const rule = (extra: Partial<RustRule>): RustRule => ({
  crate: "app",
  target: "host",
  why: "because",
  ...extra,
});

describe("reachable", () => {
  it("follows normal dependencies only and reports the shortest chain", () => {
    const meta = graph(
      {
        app: [{ name: "a" }, { name: "testing", kind: "dev" }, { name: "builder", kind: "build" }],
        a: [{ name: "b" }],
        b: [],
        testing: [],
        builder: [],
      },
      ["a", "b", "testing", "builder"],
    );
    const found = reachable(meta, "app");
    expect([...found.keys()].sort()).toEqual(["a", "app", "b"]);
    expect(found.get("b")).toEqual(["app", "a", "b"]);
  });

  it("fails loudly for a crate that is not in the workspace, so a stale rule cannot pass silently", () => {
    expect(() => reachable(graph({ other: [] }), "app")).toThrow("не найден");
  });
});

describe("checkRust", () => {
  const meta = graph(
    { app: [{ name: "a" }, { name: "serde" }], a: [{ name: "tokio" }], serde: [], tokio: [] },
    ["a", "serde", "tokio"],
  );

  it("reports a forbidden crate reached through another one, with the chain", () => {
    const [violation] = checkRust(meta, rule({ forbidTransitive: ["tokio"] }));
    expect(violation?.message).toBe('достигает запрещённого "tokio": app → a → tokio');
    expect(violation?.why).toBe("because");
  });

  it("reports a direct dependency outside the allow list, and ignores dev and build ones", () => {
    const found = checkRust(
      graph(
        {
          app: [{ name: "serde" }, { name: "extra" }, { name: "t", kind: "dev" }],
          serde: [],
          extra: [],
          t: [],
        },
        ["serde", "extra", "t"],
      ),
      rule({ directOnly: ["serde"] }),
    );
    expect(found.map((v) => v.message)).toEqual([
      'прямая зависимость "extra" не разрешена (допустимо: serde)',
    ]);
  });

  it("passes when the graph respects the rule", () => {
    expect(
      checkRust(meta, rule({ forbidTransitive: ["tauri"], directOnly: ["a", "serde"] })),
    ).toEqual([]);
  });
});
