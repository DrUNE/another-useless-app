import { matchesGlob } from "./glob";

export type Job = "rust" | "ts" | "wasm" | "native" | "deny";
export const JOBS: readonly Job[] = ["rust", "ts", "wasm", "native", "deny"];

const DOCS = [
  "docs/**",
  "**/*.md",
  ".github/ISSUE_TEMPLATE/**",
  ".github/PULL_REQUEST_TEMPLATE.md",
];

/**
 * Job, результат которого зависит только от нескольких файлов, задаётся положительным списком: перечислять всё остальное было бы
 * неудобно. Для такого job неизвестный файл не влияет на результат (проверяются только манифесты и настройки).
 */
const ONLY = {
  deny: ["Cargo.toml", "Cargo.lock", "**/Cargo.toml", "deny.toml", ".github/workflows/**"],
} satisfies Partial<Record<Job, string[]>>;

/**
 * Файлы, которые заведомо не влияют на результат job. Всё, чего здесь нет, считается влияющим: ошибка в списке
 * приводит к лишнему запуску, а не к пропуску проверки. Поэтому списки перечисляют «безопасное», а не «нужное».
 */
const IRRELEVANT: Record<Exclude<Job, keyof typeof ONLY>, string[]> = {
  rust: [
    ...DOCS,
    "apps/web/**",
    "apps/native/src/**",
    "packages/**",
    "tests/**",
    "tools/**",
    ".devcontainer/**",
    ".oxlintrc.json",
    ".oxfmtrc.json",
    "package.json",
    "bun.lock",
  ],
  ts: [...DOCS, "crates/**", "Cargo.toml", "Cargo.lock", "apps/native/src-tauri/**"],
  wasm: [
    ...DOCS,
    "apps/native/**",
    ".devcontainer/**",
    "tools/system-deps/**",
    "tools/doctor/**",
    ".oxlintrc.json",
    ".oxfmtrc.json",
  ],
  native: [
    ...DOCS,
    "apps/web/**",
    "packages/platform-web/**",
    "packages/core-wasm/**",
    "crates/core-wasm/**",
    "tests/**",
    "tools/doctor/**",
    "tools/boundaries/**",
    ".devcontainer/**",
    ".oxlintrc.json",
    ".oxfmtrc.json",
  ],
};

/** Какие jobs нужно запустить для набора изменённых файлов. Пустой набор значит «не знаем», и запускается всё. */
export function select(changedFiles: string[]): Record<Job, boolean> {
  const result = {} as Record<Job, boolean>;
  for (const job of JOBS) {
    const only = (ONLY as Partial<Record<Job, string[]>>)[job];
    const relevant = (file: string) =>
      only !== undefined
        ? only.some((glob) => matchesGlob(glob, file))
        : !IRRELEVANT[job as keyof typeof IRRELEVANT].some((glob) => matchesGlob(glob, file));
    result[job] = changedFiles.length === 0 || changedFiles.some(relevant);
  }
  return result;
}
