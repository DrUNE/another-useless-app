import { existsSync, readFileSync } from "node:fs";
import { type IncomingMessage, type ServerResponse, createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { type Browser, type Page, chromium } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Сквозной сценарий веб-приложения в настоящем браузере: WASM-ядро, OPFS, fetch, CORS и ошибки на экране.
// Требует собранного `apps/web/dist` (`bun run test:e2e` из корня собирает его сам) и Chrome или Chromium.

const dist = fileURLToPath(new URL("../../../apps/web/dist/", import.meta.url));

const CANDIDATES = [
  process.env["CHROME_PATH"],
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];
const browserPath = CANDIDATES.find((p) => p !== undefined && p !== "" && existsSync(p));

// В CI отсутствие браузера обязано быть ошибкой: иначе тест навсегда «зелёный» и ничего не проверяет.
const required = process.env["E2E_REQUIRE_BROWSER"] === "1";
if (browserPath === undefined && !required) {
  console.warn(
    "e2e пропущен: Chrome не найден (задайте CHROME_PATH; в CI задан E2E_REQUIRE_BROWSER=1)",
  );
}

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
};

interface Origin {
  server: Server;
  url: string;
}

async function listen(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<Origin> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

describe.runIf(browserPath !== undefined || required)("web app in a real browser", () => {
  let browser: Browser;
  let app: Origin;
  let withoutCors: Origin;
  let withCors: Origin;

  beforeAll(async () => {
    if (browserPath === undefined) throw new Error("Chrome не найден: задайте CHROME_PATH");
    if (!existsSync(join(dist, "index.html"))) {
      throw new Error(
        "apps/web/dist не найден: выполните `bun run build:web` (или `bun run test:e2e` из корня)",
      );
    }
    // Приложение и его тестовые ответы на одном источнике; ещё два источника проверяют CORS.
    app = await listen((req, res) => {
      const url = (req.url ?? "/").split("?")[0] ?? "/";
      if (url === "/hello.txt") return void res.end("hello opfs\n");
      if (url === "/404") {
        res.statusCode = 404;
        return void res.end("nope");
      }
      const file = join(dist, normalize(url === "/" ? "index.html" : url));
      if (!file.startsWith(dist) || !existsSync(file)) {
        res.statusCode = 404;
        return void res.end();
      }
      res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
      res.end(readFileSync(file));
    });
    withoutCors = await listen((_req, res) => void res.end("other origin"));
    withCors = await listen((_req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end("other origin");
    });
    browser = await chromium.launch({
      executablePath: browserPath,
      args: process.env["CI"] ? ["--no-sandbox"] : [],
    });
  });

  afterAll(async () => {
    await browser?.close();
    for (const origin of [app, withoutCors, withCors]) origin?.server.close();
  });

  /** Каждый тест получает чистый профиль, а значит, пустой OPFS. Возвращает и всё, что страница написала в консоль. */
  async function inFreshPage<T>(scenario: (page: Page, logs: string[]) => Promise<T>): Promise<T> {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const logs: string[] = [];
      page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
      page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
      await page.goto(app.url);
      await page.waitForSelector("h1");
      return await scenario(page, logs);
    } finally {
      await context.close();
    }
  }

  async function submit(page: Page, url: string, path: string) {
    await page.fill("label:has-text('URL') input", url);
    await page.fill("label:has-text('Путь') input", path);
    await page.click("button[type=submit]");
  }

  const alertText = async (page: Page) => {
    await page.waitForSelector("[role=alert]");
    return page.textContent("[role=alert]");
  };

  const opfsRoot = (page: Page) =>
    page.evaluate(async () => {
      const names: string[] = [];
      for await (const [name] of (await navigator.storage.getDirectory()).entries())
        names.push(name);
      return names.sort();
    });

  const opfsText = (page: Page, dir: string, file: string) =>
    page.evaluate(
      async ([d, f]) => {
        const dirHandle = await (
          await navigator.storage.getDirectory()
        ).getDirectoryHandle(d as string);
        return (await (await dirHandle.getFileHandle(f as string)).getFile()).text();
      },
      [dir, file],
    );

  it("starts on the WASM core and states the limits of the browser", () =>
    inFreshPage(async (page) => {
      expect(await page.textContent("h1")).toBe("another-useless-app");
      expect(await page.textContent("header")).toContain("песочнице браузера");
    }));

  it("downloads a file into OPFS and shows it in the history", () =>
    inFreshPage(async (page) => {
      await submit(page, `${app.url}/hello.txt`, "downloads/hello.txt");
      await page.waitForSelector("section li");
      expect(await page.textContent("section li")).toContain("downloads/hello.txt — 11 Б");
      expect(await opfsText(page, "downloads", "hello.txt")).toBe("hello opfs\n");
    }));

  it("keeps the file after a reload", () =>
    inFreshPage(async (page) => {
      await submit(page, `${app.url}/hello.txt`, "downloads/hello.txt");
      await page.waitForSelector("section li");
      await page.reload();
      await page.waitForSelector("h1");
      expect(await opfsText(page, "downloads", "hello.txt")).toBe("hello opfs\n");
    }));

  it("shows a status error as text", () =>
    inFreshPage(async (page) => {
      await submit(page, `${app.url}/404`, "a.txt");
      expect(await alertText(page)).toBe("Сервер ответил кодом 404");
      expect(await opfsRoot(page)).toEqual([]);
    }));

  it("rejects an untrusted path with the shared policy and leaves no trace", () =>
    inFreshPage(async (page) => {
      await submit(page, `${app.url}/hello.txt`, "../escape.txt");
      expect(await alertText(page)).toBe("Недопустимый путь: ../escape.txt");
      expect(await opfsRoot(page)).toEqual([]);
    }));

  it("reports a cross-origin request without CORS as a network error", () =>
    inFreshPage(async (page) => {
      await submit(page, `${withoutCors.url}/x`, "b.txt");
      expect(await alertText(page)).toMatch(/^Ошибка сети:/);
      expect(await opfsRoot(page)).toEqual([]);
    }));

  it("allows a cross-origin request when the server sends CORS headers", () =>
    inFreshPage(async (page) => {
      await submit(page, `${withCors.url}/x`, "c.txt");
      await page.waitForSelector("section li");
      expect(await page.textContent("section li")).toContain("c.txt — 12 Б");
      expect(await opfsRoot(page)).toEqual(["c.txt"]);
    }));

  it("writes nothing unexpected to the console on the happy path", () =>
    inFreshPage(async (page, logs) => {
      await submit(page, `${app.url}/hello.txt`, "downloads/hello.txt");
      await page.waitForSelector("section li");
      expect(logs.filter((l) => !l.startsWith("[debug]"))).toEqual([]);
    }));
});
