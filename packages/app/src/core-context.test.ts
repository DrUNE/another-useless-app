import { createRoot, useContext } from "solid-js";
import { describe, expect, it } from "vitest";

import { CoreContext } from "./core-context";

describe("CoreContext", () => {
  it("throws without a provider instead of silently giving the UI no core", () => {
    expect(() => createRoot(() => useContext(CoreContext))).toThrow();
  });
});
