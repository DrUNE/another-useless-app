import { type Platform, httpFromFetch } from "@app/platform";

import { createOpfsFs } from "./opfs-fs";

export { createOpfsFs };

/** Браузерная реализация портов: OPFS для файлов и `fetch` для сети (с ограничениями CORS). */
export function createWebPlatform(): Platform {
  return {
    id: "web",
    fs: createOpfsFs(),
    http: httpFromFetch((url, init) => globalThis.fetch(url, init)),
  };
}
