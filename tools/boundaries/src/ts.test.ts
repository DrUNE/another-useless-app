import { describe, expect, it } from "vitest";

import rules from "../rules.json" with { type: "json" };
import { checkTs, readWorkspace, type WorkspacePackage } from "./ts";
import type { Rules } from "./types";

const pkg = (
  name: string,
  dependencies: string[] = [],
  devDependencies: string[] = [],
): WorkspacePackage => ({
  name,
  dependencies,
  devDependencies,
});

describe("checkTs", () => {
  const packages = [
    pkg("@app/web", ["@app/ui"], ["vite"]),
    pkg("@app/ui", ["@app/lib"]),
    pkg("@app/lib", ["@tauri-apps/api"]),
  ];

  it("finds a forbidden package reached through other workspace packages", () => {
    const [violation] = checkTs(packages, {
      package: "@app/web",
      forbidTransitive: ["@tauri-apps/*"],
      why: "no tauri",
    });
    expect(violation?.message).toBe(
      'достигает запрещённого "@tauri-apps/api": @app/web → @app/ui → @app/lib → @tauri-apps/api',
    );
  });

  it("forbids a devDependency too, but the allow list only limits runtime dependencies", () => {
    const withDev = [pkg("@app/x", ["a"], ["@tauri-apps/cli", "vitest"])];
    expect(
      checkTs(withDev, { package: "@app/x", forbidTransitive: ["@tauri-apps/*"], why: "w" }).map(
        (v) => v.message,
      ),
    ).toEqual(['devDependency "@tauri-apps/cli" запрещена']);
    expect(checkTs(withDev, { package: "@app/x", directOnly: ["a"], why: "w" })).toEqual([]);
  });

  it("reports an extra runtime dependency", () => {
    const found = checkTs([pkg("@app/p", ["@app/core-api", "left-pad"])], {
      package: "@app/p",
      directOnly: ["@app/core-api"],
      why: "w",
    });
    expect(found.map((v) => v.message)).toEqual([
      'зависимость "left-pad" не разрешена (допустимо: @app/core-api)',
    ]);
  });

  it("fails for a package that does not exist, so a renamed package cannot leave a dead rule", () => {
    expect(() => checkTs(packages, { package: "@app/gone", directOnly: [], why: "w" })).toThrow(
      "не найден",
    );
  });
});

describe("rules against this repository", () => {
  const root = new URL("../../..", import.meta.url).pathname;
  const packages = readWorkspace(root);

  it("every TS rule refers to an existing workspace package", () => {
    const names = new Set(packages.map((p) => p.name));
    for (const rule of (rules as Rules).ts)
      expect(names.has(rule.package), rule.package).toBe(true);
  });

  it("the repository respects all TS rules", () => {
    const violations = (rules as Rules).ts.flatMap((rule) => checkTs(packages, rule));
    expect(violations).toEqual([]);
  });
});
