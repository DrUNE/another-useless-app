import { describe, expect, it } from "vitest";

import { createContext } from "./index";

describe("createContext", () => {
  it("never lets rustup install toolchains while diagnosing", () => {
    const ctx = createContext(process.cwd());
    const result = ctx.run(process.execPath, [
      "-e",
      "console.log(process.env.RUSTUP_AUTO_INSTALL)",
    ]);
    expect(result.output.trim()).toBe("0");
  });

  it("reports a missing command as a failure instead of throwing", () => {
    const result = createContext(process.cwd()).run("definitely-not-a-real-command", []);
    expect(result.ok).toBe(false);
  });
});
