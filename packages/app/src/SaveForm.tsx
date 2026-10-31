import { createSignal, Show } from "solid-js";

import { Field } from "./Field";
import type { FetcherService, SaveReport } from "./service";

export function SaveForm(props: {
  service: FetcherService;
  onSaved: (report: SaveReport) => void;
}) {
  // Тело компонента выполняется один раз: сигналы создаются здесь единожды,
  // а обновляются только те места JSX, где вызван url(), path(), busy() или error().
  const [url, setUrl] = createSignal("https://example.com");
  const [path, setPath] = createSignal("downloads/example.html");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      props.onSaved(await props.service.saveUrl(url(), path()));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
      <Field label="URL" value={url()} onInput={setUrl} placeholder="https://…" />
      <Field label="Путь для сохранения" value={path()} onInput={setPath} />
      <button
        type="submit"
        disabled={busy()}
        class={[
          "rounded-control bg-accent px-4 py-2 font-medium text-accent-ink",
          "pointer-coarse:py-3",
          { "opacity-50": busy() },
        ]}
      >
        {busy() ? "Сохраняем…" : "Скачать и сохранить"}
      </button>
      <Show when={error()}>
        {(message) => (
          <p role="alert" class="text-sm text-red-600">
            {message()}
          </p>
        )}
      </Show>
    </form>
  );
}
