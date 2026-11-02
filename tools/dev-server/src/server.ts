export const WEB_URL = "http://127.0.0.1:5173";
export const DEFAULT_TIMEOUT_MS = 120_000;

type Fetcher = (url: string) => Promise<{ status: number }>;

export async function isServerReady(url = WEB_URL, fetcher: Fetcher = fetch): Promise<boolean> {
  try {
    const response = await fetcher(url);
    return response.status < 500;
  } catch {
    return false;
  }
}

interface WaitOptions {
  url?: string;
  timeoutMs?: number;
  intervalMs?: number;
  fetcher?: Fetcher;
  sleep?: (ms: number) => Promise<void>;
  isAlive?: () => boolean;
}

export async function waitForServer({
  url = WEB_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  intervalMs = 250,
  fetcher = fetch,
  sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  isAlive = () => true,
}: WaitOptions = {}): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerReady(url, fetcher)) return;
    if (!isAlive()) throw new Error("Vite exited before becoming ready");
    await sleep(intervalMs);
  }
  throw new Error(`Vite did not become ready within ${timeoutMs}ms`);
}
