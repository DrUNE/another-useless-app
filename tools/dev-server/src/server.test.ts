import { describe, expect, it, vi } from "vitest";

import { isServerReady, waitForServer } from "./server";

describe("isServerReady", () => {
  it("accepts an HTTP response even when the route does not exist", async () => {
    await expect(isServerReady("http://localhost", async () => ({ status: 404 }))).resolves.toBe(
      true,
    );
  });

  it("rejects server errors and connection failures", async () => {
    await expect(isServerReady("http://localhost", async () => ({ status: 500 }))).resolves.toBe(
      false,
    );
    await expect(
      isServerReady("http://localhost", async () => {
        throw new Error("connection refused");
      }),
    ).resolves.toBe(false);
  });
});

describe("waitForServer", () => {
  it("polls until the server becomes ready", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("not yet"))
      .mockResolvedValueOnce({ status: 200 });
    const sleep = vi.fn().mockResolvedValue(undefined);
    await waitForServer({ fetcher, sleep });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("fails early when the server process exits", async () => {
    await expect(
      waitForServer({ fetcher: async () => ({ status: 503 }), isAlive: () => false }),
    ).rejects.toThrow("exited");
  });

  it("fails on timeout", async () => {
    await expect(waitForServer({ timeoutMs: 0 })).rejects.toThrow("did not become ready");
  });
});
