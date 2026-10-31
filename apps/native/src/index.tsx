import { App } from "@app/app";
import { render } from "@solidjs/web";
import { createIpcService } from "./core";
import "./index.css";

// Здесь, в точке входа, выбирается ядро: в нативном приложении это Rust через IPC.
render(
  () => (
    <App
      service={createIpcService()}
      subtitle="Файлы сохраняются в каталог данных приложения."
    />
  ),
  document.getElementById("root")!,
);
