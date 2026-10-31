import { CoreException } from "@app/core-api";
import { scenarios } from "@app/core-api/contract";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveUrl = vi.hoisted(() => vi.fn());
vi.mock("./bindings", () => ({ commands: { saveUrl } }));

const { createIpcCore } = await import("./core");

// Это проверка адаптера (как TS превращает ответ IPC в контракт), а не поведения Rust. Поведение Rust проверяют
// IPC-тесты Tauri на тех же сценариях (`ipc_follows_the_shared_core_contract`).
describe("createIpcCore", () => {
  beforeEach(() => {
    // Фигурные скобки нужны: vitest вызывает значение, возвращённое из beforeEach, как функцию очистки,
    // а mockReset() возвращает сам мок.
    saveUrl.mockReset();
  });

  it("returns the report of a successful command", async () => {
    saveUrl.mockResolvedValue({ status: "ok", data: { path: "a.txt", bytes: 2 } });
    await expect(createIpcCore().saveUrl("http://x", "a.txt")).resolves.toEqual({
      path: "a.txt",
      bytes: 2,
    });
    expect(saveUrl).toHaveBeenCalledWith("http://x", "a.txt");
  });

  it("turns every error shape the contract expects into a CoreException with the same cause", async () => {
    const withErrors = scenarios.filter((s) => s.expect.error !== undefined);
    expect(withErrors.length).toBeGreaterThan(0);
    for (const scenario of withErrors) {
      // Поля, которых нет в сценарии (текст ошибки ОС), дополняем: Rust всегда присылает полную форму.
      const error = { message: "details", ...scenario.expect.error };
      saveUrl.mockResolvedValue({ status: "error", error });
      const failure = await createIpcCore()
        .saveUrl("http://x", scenario.path)
        .then(
          () => undefined,
          (e: unknown) => e,
        );
      expect(failure, scenario.name).toBeInstanceOf(CoreException);
      expect((failure as CoreException).error, scenario.name).toEqual(error);
    }
  });

  it("lets unexpected failures of the IPC channel itself through unchanged", async () => {
    const failure = new Error("IPC is unavailable");
    saveUrl.mockRejectedValue(failure);
    await expect(createIpcCore().saveUrl("http://x", "a.txt")).rejects.toBe(failure);
  });
});
