import { describe, expect, it } from "vitest";

import { scenarios } from "./contract";
import { type CoreError, CoreException, isCoreError } from "./index";

describe("CoreException", () => {
  it("is an Error carrying the typed cause and a readable summary", () => {
    const cause: CoreError = { kind: "status", code: 404 };
    const exception = new CoreException(cause);
    expect(exception).toBeInstanceOf(Error);
    expect(exception.error).toBe(cause);
    expect(exception.message).toBe("unexpected HTTP status 404");
  });
});

describe("isCoreError", () => {
  it("accepts each documented shape", () => {
    for (const ok of [
      { kind: "invalidPath", path: "../x" },
      { kind: "io", message: "disk full" },
      { kind: "network", message: "offline" },
      { kind: "status", code: 500 },
    ]) {
      expect(isCoreError(ok)).toBe(true);
    }
  });

  it("rejects anything else: wrong field types, unknown kinds, non-objects", () => {
    for (const bad of [
      null,
      undefined,
      "io",
      42,
      new Error("boom"),
      {},
      { kind: "status", code: "404" },
      { kind: "io" },
      { kind: "teapot", message: "x" },
    ]) {
      expect(isCoreError(bad)).toBe(false);
    }
  });
});

describe("contract scenarios", () => {
  it("each scenario expects exactly one outcome and has a unique name", () => {
    for (const scenario of scenarios) {
      expect(Boolean(scenario.expect.ok) !== Boolean(scenario.expect.error), scenario.name).toBe(
        true,
      );
    }
    expect(new Set(scenarios.map((s) => s.name)).size).toBe(scenarios.length);
  });

  it("every expected error has a valid kind", () => {
    for (const scenario of scenarios.filter((s) => s.expect.error)) {
      expect(["invalidPath", "io", "network", "status"]).toContain(scenario.expect.error?.["kind"]);
    }
  });
});
