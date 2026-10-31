import { createSignal, Show } from "solid-js";
import { History } from "./History";
import { SaveForm } from "./SaveForm";
import type { FetcherService, SaveReport } from "./service";

// Сервис приходит снаружи: какое именно ядро (WASM, IPC, заглушка) — решает точка входа приложения.
export function App(props: { service: FetcherService; subtitle?: string }) {
  const [entries, setEntries] = createSignal<SaveReport[]>([]);

  return (
    <main class="mx-auto flex max-w-xl flex-col gap-6 p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header>
        <h1 class="text-2xl font-semibold">another-useless-app</h1>
        <Show when={props.subtitle}>{(text) => <p class="text-sm text-ink/60">{text()}</p>}</Show>
      </header>
      <SaveForm
        service={props.service}
        onSaved={(report) => setEntries((list) => [report, ...list])}
      />
      <History entries={entries()} />
    </main>
  );
}
