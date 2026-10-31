import { App, createStubService } from "@app/app";
import { render } from "@solidjs/web";

import "./index.css";

// Пока веб работает на заглушке; настоящее ядро (WASM) подключается здесь же (#5).
render(
  () => (
    <App
      service={createStubService()}
      subtitle="Сервис пока заглушка: настоящее ядро подключим в #5."
    />
  ),
  document.getElementById("root")!,
);
