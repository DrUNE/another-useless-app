import { type CoreError, CoreException } from "@app/core-api";
import { describe, expect, it } from "vitest";

import { describeError } from "./errors";

describe("describeError", () => {
  it("gives every kind of core error its own text", () => {
    const cases: [CoreError, string][] = [
      [{ kind: "invalidPath", path: "../x" }, "Недопустимый путь: ../x"],
      [{ kind: "io", message: "disk full" }, "Ошибка файла: disk full"],
      [{ kind: "network", message: "offline" }, "Ошибка сети: offline"],
      [{ kind: "status", code: 404 }, "Сервер ответил кодом 404"],
    ];
    for (const [cause, text] of cases) {
      expect(describeError(new CoreException(cause))).toBe(text);
    }
  });

  it("does not depend on the platform-specific message of the exception", () => {
    const exception = new CoreException({ kind: "status", code: 500 });
    exception.message = "something unrelated";
    expect(describeError(exception)).toBe("Сервер ответил кодом 500");
  });

  it("falls back to the message of an ordinary error and to a string for anything else", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
    expect(describeError("plain")).toBe("plain");
    expect(describeError(undefined)).toBe("undefined");
  });
});
