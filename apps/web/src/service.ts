/** Заглушка сервиса ядра. Заменится реальным ядром (WASM, затем IPC) в #3 и #5. */
export interface SaveReport {
  path: string;
  bytes: number;
}

export interface FetcherService {
  saveUrl(url: string, path: string): Promise<SaveReport>;
}

export function createStubService(): FetcherService {
  return {
    async saveUrl(url, path) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (!/^https?:\/\//.test(url)) throw new Error(`Некорректный URL: ${url}`);
      return { path, bytes: url.length * 100 };
    },
  };
}
