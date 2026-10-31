import type { Fs } from "./fs";
import type { Http } from "./http";

export * from "./fs";
export * from "./http";

/** Набор портов. Отсутствующий порт означает, что платформа его не поддерживает. */
export interface Platform {
  readonly id: "web" | "node" | "tauri";
  readonly fs?: Fs;
  readonly http?: Http;
}

export type Capability = "fs" | "http";

export function hasCapability(p: Platform, c: Capability): boolean {
  return p[c] !== undefined;
}

/** Достаёт порт или кидает понятную ошибку; для фич, которые объявили его в `requires`. */
export function requirePort<K extends Capability>(p: Platform, c: K): NonNullable<Platform[K]> {
  const port = p[c];
  if (port === undefined) throw new Error(`Platform "${p.id}" has no "${c}" capability`);
  return port;
}
