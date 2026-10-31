import { App, CoreContext, describeError } from "@app/app";
import { createCore } from "@app/core-wasm";
import { createWebPlatform } from "@app/platform-web";
import { render } from "@solidjs/web";

import "./index.css";

// Точка входа выбирает ядро: в браузере это то же Rust-ядро в WASM, а файлы и сеть дают браузерные адаптеры.
const root = document.getElementById("root")!;
try {
  const core = await createCore(createWebPlatform());
  render(
    () => (
      <CoreContext value={core}>
        <App subtitle="Файлы хранятся в песочнице браузера, запросы к чужим сайтам ограничены CORS." />
      </CoreContext>
    ),
    root,
  );
} catch (error) {
  render(
    () => (
      <p role="alert" class="p-6 text-red-600">
        Не удалось запустить ядро: {describeError(error)}
      </p>
    ),
    root,
  );
}
