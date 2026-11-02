import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isServerReady, waitForServer } from "./server";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const port = Number(process.env.WEB_DEV_SERVER_PORT ?? 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error(`Invalid WEB_DEV_SERVER_PORT: ${port}`);
const url = `http://127.0.0.1:${port}`;
const stateDir = join(root, "target");
const pidFile = join(stateDir, "web-dev-server.pid");
const logFile = join(stateDir, "web-dev-server.log");

function buildWasm(): void {
  const result = Bun.spawnSync(["bun", "run", "build:wasm"], {
    cwd: root,
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (result.exitCode !== 0) throw new Error(`WASM build failed with code ${result.exitCode}`);
}

async function start(): Promise<void> {
  if (await isServerReady(url)) {
    console.log(`Web dev server is already running at ${url}`);
    return;
  }

  buildWasm();
  mkdirSync(stateDir, { recursive: true });
  const log = openSync(logFile, "a");
  const child = Bun.spawn(
    [
      "bun",
      join(root, "apps/web/node_modules/vite/bin/vite.js"),
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: join(root, "apps/web"),
      detached: true,
      stdio: ["ignore", log, log],
    },
  );
  closeSync(log);
  child.unref();
  writeFileSync(pidFile, String(child.pid));

  await waitForServer({ url, isAlive: () => child.exitCode === null }).catch((error: unknown) => {
    child.kill();
    rmSync(pidFile, { force: true });
    throw error;
  });
  console.log(`Web dev server started at ${url} (pid ${child.pid}, log ${logFile})`);
}

function stop(): void {
  try {
    const pid = Number(readFileSync(pidFile, "utf8"));
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid);
      } catch (error) {
        if ((error as { code?: string }).code !== "ESRCH") throw error;
      }
    }
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  } finally {
    rmSync(pidFile, { force: true });
  }
  console.log("Web dev server stopped (if it was started by this helper)");
}

const command = process.argv[2];
if (command === "start") {
  await start();
} else if (command === "stop") {
  stop();
} else {
  throw new Error("Usage: bun tools/dev-server/src/index.ts start|stop");
}
