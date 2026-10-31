import { describe, expect, it } from "vitest";

import { matches, matchesAny } from "./match";

describe("matches", () => {
  it("matches exact names and prefix patterns", () => {
    expect(matches("tauri", "tauri")).toBe(true);
    expect(matches("tauri", "tauri-build")).toBe(false);
    expect(matches("@tauri-apps/*", "@tauri-apps/api")).toBe(true);
    expect(matches("@tauri-apps/*", "@tauri-apps/plugin-fs")).toBe(true);
    expect(matches("@tauri-apps/*", "@app/native")).toBe(false);
  });

  it("matchesAny is true if one pattern fits", () => {
    expect(matchesAny(["a", "b*"], "bcd")).toBe(true);
    expect(matchesAny([], "a")).toBe(false);
  });
});
