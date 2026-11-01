import { spawnSync } from "node:child_process";

import { JOBS, select } from "./select";

// Печатает `job=true|false` для $GITHUB_OUTPUT. Всё человекочитаемое идёт в stderr, чтобы не попасть в вывод.
// Любое сомнение (не pull request, сбой git) означает «запустить всё»: лишний запуск лучше пропущенной проверки.
function changedFiles(): string[] | undefined {
  if (process.env["GITHUB_EVENT_NAME"] !== "pull_request") return undefined;
  // Для pull_request checkout даёт merge-коммит: HEAD^1 — вершина базовой ветки, значит diff показывает ровно то, что приносит PR.
  const out = spawnSync("git", ["diff", "--name-only", "HEAD^1", "HEAD"], { encoding: "utf8" });
  return out.status === 0 ? out.stdout.split("\n").filter(Boolean) : undefined;
}

function main() {
  const files = changedFiles();
  const selected = select(files ?? []);
  console.error(
    files === undefined
      ? "изменённые файлы неизвестны: запускается всё"
      : `изменённых файлов: ${files.length}`,
  );
  for (const job of JOBS) {
    console.error(`  ${selected[job] ? "запуск" : "пропуск"}: ${job}`);
    console.log(`${job}=${selected[job]}`);
  }
}

if (import.meta.main) main();
