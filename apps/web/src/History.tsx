import { For, Show } from "solid-js";
import type { SaveReport } from "./service";

export function History(props: { entries: SaveReport[] }) {
  return (
    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-medium text-ink/70">Сохранено</h2>
      <Show when={props.entries.length > 0} fallback={<p class="text-sm text-ink/50">Пока ничего.</p>}>
        <ul class="flex flex-col gap-1">
          {/* По умолчанию For ключует по ссылке: item — значение, индекс i — функция. */}
          <For each={props.entries}>
            {(entry, i) => (
              <li class="rounded-control bg-surface-muted px-3 py-2 text-sm">
                {i() + 1}. {entry.path} — {entry.bytes} Б
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
