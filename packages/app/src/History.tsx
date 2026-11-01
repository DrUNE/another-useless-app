import type { SaveReport } from "@app/core-api";
import { createSignal, For, Show, useContext } from "solid-js";

import { CoreContext } from "./core-context";
import { describeError } from "./errors";

export function History(props: { entries: SaveReport[] }) {
  const core = useContext(CoreContext);
  const [selected, setSelected] = createSignal<string>();
  const [content, setContent] = createSignal<string>();
  const [busy, setBusy] = createSignal<string>();
  const [error, setError] = createSignal<string>();

  const openFile = async (path: string) => {
    setSelected(path);
    setContent(undefined);
    setError(undefined);
    setBusy(path);
    try {
      const bytes = await core.readFile(path);
      setContent(new TextDecoder().decode(bytes));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-medium text-ink/70">Сохранено</h2>
      <Show
        when={props.entries.length > 0}
        fallback={<p class="text-sm text-ink/50">Пока ничего.</p>}
      >
        <ul class="flex flex-col gap-1">
          {/* По умолчанию For ключует по ссылке: item — значение, индекс i — функция. */}
          <For each={props.entries}>
            {(entry, i) => (
              <li class="flex items-center justify-between gap-3 rounded-control bg-surface-muted px-3 py-2 text-sm">
                <span>
                  {i() + 1}. {entry.path} — {entry.bytes} Б
                </span>
                <button
                  type="button"
                  disabled={busy() !== undefined}
                  class="shrink-0 text-accent disabled:opacity-50"
                  onClick={() => void openFile(entry.path)}
                >
                  {busy() === entry.path ? "Читаем…" : "Прочитать"}
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={selected()}>
        {(path) => (
          <section class="flex flex-col gap-2" aria-busy={busy() !== undefined ? "true" : "false"}>
            <h3 class="text-sm font-medium text-ink/70">Содержимое: {path()}</h3>
            <Show when={content() !== undefined}>
              <pre class="max-h-80 overflow-auto rounded-control bg-surface-muted p-3 text-sm whitespace-pre-wrap">
                {content()}
              </pre>
            </Show>
            <Show when={error()}>
              {(message) => (
                <p role="alert" class="text-sm text-red-600">
                  {message()}
                </p>
              )}
            </Show>
          </section>
        )}
      </Show>
    </section>
  );
}
