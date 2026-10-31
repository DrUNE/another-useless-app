/** Порт HTTP-клиента. Структурные типы, чтобы пакет не зависел от DOM/Node lib. */
export interface HttpRequest {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface HttpResponse {
  readonly status: number;
  readonly ok: boolean;
  header(name: string): string | null;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  bytes(): Promise<Uint8Array>;
}

export type Http = (url: string, init?: HttpRequest) => Promise<HttpResponse>;

/** Минимальный контракт, которому удовлетворяют globalThis.fetch и fetch из @tauri-apps/plugin-http. */
export type FetchLike = (
  url: string,
  init?: HttpRequest,
) => Promise<{
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

/** Оборачивает любой fetch в порт Http; общий для web, node и tauri адаптеров. */
export function httpFromFetch(fetchImpl: FetchLike): Http {
  return async (url, init) => {
    const res = await fetchImpl(url, init);
    return {
      status: res.status,
      ok: res.ok,
      header: (name) => res.headers.get(name),
      text: () => res.text(),
      json: <T>() => res.json() as Promise<T>,
      bytes: async () => new Uint8Array(await res.arrayBuffer()),
    };
  };
}
