// Чистые функции разбора: единственные источники версий — файлы репозитория (rust-toolchain.toml,
// Cargo.lock, package.json), а не константы в коде.

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Версия крейта из Cargo.lock; `undefined`, если крейта нет. */
export function lockedVersion(cargoLock: string, crate: string): string | undefined {
  const text = cargoLock.replaceAll("\r\n", "\n");
  const re = new RegExp(
    `\\[\\[package\\]\\]\\nname = "${escapeRegExp(crate)}"\\nversion = "([^"]+)"`,
  );
  return re.exec(text)?.[1];
}

/** Версия bun из поля `packageManager` ("bun@1.4.4"). */
export function packageManagerVersion(packageJson: string): string | undefined {
  const value = (JSON.parse(packageJson) as { packageManager?: string }).packageManager;
  return /^bun@(.+)$/.exec(value ?? "")?.[1];
}

/** `channel` из rust-toolchain.toml. */
export function toolchainChannel(toml: string): string | undefined {
  return /^channel\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
}

/** Версия из вывода вида `rustc 1.99.1 (...)` или `wasm-bindgen 0.2.130`. */
export function versionFromOutput(output: string): string | undefined {
  return /\b(\d+\.\d+\.\d+(?:-[\w.]+)?)\b/.exec(output)?.[1];
}

export type DistroFamily = "debian" | "alt" | "other";

/** Семейство дистрибутива по /etc/os-release (ID и ID_LIKE). */
export function distroFamily(osRelease: string): DistroFamily {
  const field = (key: string) =>
    new RegExp(`^${key}=("?)(.*)\\1$`, "m").exec(osRelease)?.[2]?.toLowerCase() ?? "";
  const ids = [field("ID"), ...field("ID_LIKE").split(/\s+/)];
  if (ids.some((id) => id === "debian" || id === "ubuntu")) return "debian";
  if (ids.some((id) => id === "altlinux" || id === "alt")) return "alt";
  return "other";
}

/** Список пакетов из текстового файла (по одному в строке, `#` — комментарий). */
export function readPackageList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/#.*/, "").trim())
    .filter((line) => line !== "");
}
