import { createSignal } from "solid-js";
import { History } from "./History";
import { SaveForm } from "./SaveForm";
import { createStubService, type SaveReport } from "./service";

export function App() {
  const service = createStubService();
  const [entries, setEntries] = createSignal<SaveReport[]>([]);

  return (
    <main class="mx-auto flex max-w-xl flex-col gap-6 p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header>
        <h1 class="text-2xl font-semibold">another-useless-app</h1>
        <p class="text-sm text-ink/60">Сервис пока заглушка: настоящее ядро подключим в #3.</p>
      </header>
      <SaveForm service={service} onSaved={(report) => setEntries((list) => [report, ...list])} />
      <History entries={entries()} />
    </main>
  );
}
