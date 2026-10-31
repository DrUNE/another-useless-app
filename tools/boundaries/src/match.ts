/** Совпадение имени с шаблоном: точное или `префикс*` (как в `@tauri-apps/*`). */
export function matches(pattern: string, name: string): boolean {
  return pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : pattern === name;
}

export const matchesAny = (patterns: string[], name: string) =>
  patterns.some((p) => matches(p, name));
