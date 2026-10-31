import { describe, expect, it } from "vitest";

import { matchesGlob } from "./glob";

describe("matchesGlob", () => {
  it("lets a single star stay inside one path segment", () => {
    expect(matchesGlob("apps/*/package.json", "apps/web/package.json")).toBe(true);
    expect(matchesGlob("apps/*/package.json", "apps/web/src/package.json")).toBe(false);
  });

  it("lets a double star cross directories, including none at all", () => {
    expect(matchesGlob("docs/**", "docs/adr/0001.md")).toBe(true);
    expect(matchesGlob("**/*.md", "README.md")).toBe(true);
    expect(matchesGlob("**/*.md", "docs/adr/0001.md")).toBe(true);
    expect(matchesGlob("**/*.md", "docs/adr/0001.txt")).toBe(false);
  });

  it("matches the whole path and treats dots literally", () => {
    expect(matchesGlob("package.json", "package.json")).toBe(true);
    expect(matchesGlob("package.json", "apps/web/package.json")).toBe(false);
    expect(matchesGlob("package.json", "packageXjson")).toBe(false);
  });
});
