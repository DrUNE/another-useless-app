import { App, CoreContext } from "@app/app";
import { render } from "@solidjs/web";

import { createIpcCore } from "./core";

import "./index.css";

// Точка входа выбирает ядро: в нативном приложении это Rust через IPC. UI о платформе ничего не знает.
render(
  () => (
    <CoreContext value={createIpcCore()}>
      <App subtitle="Файлы сохраняются в каталог данных приложения." />
    </CoreContext>
  ),
  document.getElementById("root")!,
);
