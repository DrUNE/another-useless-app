# Отладка frontend и backend в VS Code и Zed

[English version](editor-debugging.md)

Практическое руководство по конфигурациям из `.vscode/` и `.zed/`. Оно покрывает web frontend,
CLI на Rust, backend и frontend Tauri. Клавиши ниже даны для стандартной раскладки Linux;
в macOS часть сочетаний отличается — проверьте **Keyboard Shortcuts** в VS Code и `keymap.json` в Zed.

## Что выбрать: launch или attach

- **Launch** запускает необходимое окружение. Для web сначала выполняется `web: ensure dev server`:
  собирается WASM, при необходимости поднимается Vite и проверяется его HTTP-готовность.
- **Attach** только подключается к уже работающему серверу или браузеру. Ничего сам не запускает
  и не останавливает.

| Что отлаживать                       | Сценарий                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Web в Chrome/Chromium/Yandex Browser | `Web frontend: launch Chromium`, `Web frontend: launch Chromium (CHROME_PATH)`, `Web frontend: attach Chromium` |
| Web в Firefox (только VS Code)       | `Web frontend: launch Firefox`, `Web frontend: attach Firefox`                                                  |
| CLI                                  | `CLI backend: development`, `CLI backend: release`                                                              |
| Rust backend Tauri                   | `Native backend: development`, `Native backend: release`                                                        |
| Frontend Tauri на Windows            | `Native frontend: attach WebView2 (Windows)`                                                                    |

Release-сценарии Rust сохраняют оптимизацию, но добавляют `profile.release.debug=true`, чтобы были
доступны символы и исходники.

## Панели и горячие клавиши VS Code

### Основные действия

| Действие                     | Как сделать                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| Открыть **Run and Debug**    | `Ctrl+Shift+D` или значок play с жуком на Activity Bar слева    |
| Выбрать сценарий             | Раскрывающийся список вверху панели **Run and Debug**           |
| Запустить выбранный сценарий | `F5` или зелёная кнопка play рядом со списком                   |
| Поставить/убрать breakpoint  | `F9` на нужной строке или клик по gutter слева от номера строки |
| Запустить задачу             | `Ctrl+Shift+P` → **Tasks: Run Task** → имя задачи               |
| Открыть Debug Console        | `Ctrl+Shift+Y` или **View → Debug Console**                     |
| Открыть терминал             | `` Ctrl+` ``                                                    |

В **Run and Debug** доступны **Variables**, **Watch**, **Call Stack** и **Breakpoints**.
В **Debug Console** можно выполнять выражения в контексте выбранного stack frame.
Панель терминала показывает stdout задач Vite и сборки.

### Управление выполнением

| Действие                                         | Клавиши         |
| ------------------------------------------------ | --------------- |
| Continue / Pause                                 | `F5`            |
| Step Over — следующая строка без входа в функцию | `F10`           |
| Step Into — войти в функцию                      | `F11`           |
| Step Out — выйти из текущей функции              | `Shift+F11`     |
| Restart с тем же сценарием                       | `Ctrl+Shift+F5` |
| Stop                                             | `Shift+F5`      |

Те же действия доступны кнопками на плавающей **Debug toolbar** во время сессии.
Правый клик по breakpoint в gutter позволяет добавить условие или logpoint.

## Панели и горячие клавиши Zed

### Основные действия

| Действие                       | Как сделать                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Открыть список debug-сценариев | `F4` или `Ctrl+Shift+P` → **debugger: start**                                   |
| Выбрать и запустить сценарий   | Выбрать его в **New Debug Session** и нажать `Enter`                            |
| Новая сессия из Debug Panel    | Кнопка `+` вверху справа панели                                                 |
| Поставить/убрать breakpoint    | Клик по gutter слева от номера строки; отдельной привязки `F9` по умолчанию нет |
| Запустить задачу               | `Alt+Shift+T` или `Ctrl+Shift+P` → **task: spawn**                              |
| Повторить последнюю задачу     | `Alt+T`                                                                         |
| Показать/скрыть нижнюю панель  | `Ctrl+J`                                                                        |
| Выбрать поток                  | `Ctrl+T` при фокусе в Debug Panel                                               |
| Выбрать debug-сессию           | `Ctrl+I` при фокусе в Debug Panel                                               |

Debug Panel содержит переменные, стек вызовов, breakpoints, консоль, терминал и список потоков.
Правый клик по breakpoint позволяет сделать его условным, добавить hit count или logpoint.
В списке **Breakpoints** `Space` включает/выключает breakpoint, а `Backspace` удаляет его.

### Управление выполнением

| Действие                                 | Клавиши                          |
| ---------------------------------------- | -------------------------------- |
| Повторить последнюю debug-сессию (Rerun) | `F5` вне остановки на breakpoint |
| Continue при остановке на breakpoint     | `F5`                             |
| Pause во время выполнения                | `F6`                             |
| Step Over                                | `F10` или `F7`                   |
| Step Into                                | `F11` или `Ctrl+F11`             |
| Step Out                                 | `Shift+F11`                      |
| Restart текущей сессии                   | `Ctrl+Shift+F5`                  |
| Stop                                     | `Shift+F5`                       |

Кнопки Continue/Pause, Step Over/Into/Out, Restart и Stop также находятся на верхней панели
инструментов Debug Panel.

## Web frontend: launch в Chrome, Chromium или Yandex Browser

### VS Code

1. Установите рекомендуемые расширения, если ещё не сделали это. Для Chromium-совместимых
   браузеров дополнительное расширение не нужно.
2. Откройте `packages/app/src/SaveForm.tsx` и поставьте `F9`, например, на строку 19
   (`setBusy(true)`) или строку 22 (`core.saveUrl(...)`).
3. Нажмите `Ctrl+Shift+D` и выберите `Web frontend: launch Chromium`.
4. Нажмите `F5`. Дождитесь сборки WASM и запуска Vite; затем откроется новое окно браузера.
5. В **этом новом окне** нажмите «Скачать и сохранить». После остановки смотрите **Variables**,
   **Watch** и **Call Stack**.

Если Chrome/Chromium не найден автоматически или вы используете Yandex Browser, перед запуском
редактора задайте путь:

```bash
export CHROME_PATH=/usr/bin/yandex-browser
code .
```

Теперь выберите `Web frontend: launch Chromium (CHROME_PATH)` вместо обычного launch.

### Zed

1. Откройте `packages/app/src/SaveForm.tsx` и кликните по gutter на нужной строке.
2. Нажмите `F4`, выберите `Web frontend: launch Chromium` и подтвердите `Enter`.
3. Дождитесь завершения build-задачи и открытия нового браузера.
4. Выполните действие в приложении. Переменные и стек будут в Debug Panel.

Для Yandex Browser запустите Zed так:

```bash
export CHROME_PATH=/usr/bin/yandex-browser
zed .
```

Затем выберите `Web frontend: launch Chromium (CHROME_PATH)`.

Тело компонента Solid выполняется один раз, а не на каждое обновление как в React. Поэтому для
проверки нажатия кнопки ставьте breakpoint внутри `submit`, а не только в теле `SaveForm`.

## Web frontend: attach к Chromium-совместимому браузеру

Этот вариант нужен, если браузер уже настроен вручную. Сценарий attach не запускает Vite сам.

```bash
bun run dev:web:start
"$CHROME_PATH" --remote-debugging-port=9222 \
  --user-data-dir=/tmp/another-useless-app-browser \
  http://localhost:5173
```

Замените `$CHROME_PATH` на путь к Chrome, Chromium или Yandex Browser, если переменная не задана.
Отдельный `user-data-dir` нужен, чтобы не подключаться к обычному профилю браузера.

Далее:

- в VS Code откройте **Run and Debug**, выберите `Web frontend: attach Chromium`, нажмите `F5`;
- в Zed нажмите `F4`, выберите `Web frontend: attach Chromium`, подтвердите `Enter`.

Открывайте страницу в том браузере, которому передан порт `9222`, и ставьте breakpoints заранее.

## Web frontend: Firefox (только VS Code)

Встроенный JavaScript-адаптер Zed поддерживает Node и Chromium-совместимые браузеры, но не Firefox.
Для Zed используйте Firefox Developer Tools. В VS Code установите рекомендуемое расширение
**Debugger for Firefox** (`firefox-devtools.vscode-firefox-debug`).

### Launch

1. Поставьте breakpoint в TS/TSX-файле.
2. Нажмите `Ctrl+Shift+D`, выберите `Web frontend: launch Firefox` и нажмите `F5`.
3. Дождитесь запуска Vite и нового окна Firefox.

### Attach

```bash
bun run dev:web:start
firefox -start-debugger-server
```

Откройте `http://localhost:5173` в Firefox, затем выберите `Web frontend: attach Firefox` и `F5`.
Firefox использует порт `6000`, а не CDP-порт `9222`. Если breakpoint не сопоставляется с файлом,
используйте **Path Mapping Wizard** расширения: source maps должны вести в корень монорепозитория.

## Управление Vite

Launch использует уже работающий сервер или оставляет новый для следующих сессий. PID и лог
находятся в `target/web-dev-server.pid` и `target/web-dev-server.log`.

Остановка:

- VS Code: `Ctrl+Shift+P` → **Tasks: Run Task** → `web: stop dev server`;
- Zed: `Alt+Shift+T` → `web: stop dev server`;
- терминал: `bun run dev:web:stop`.

Для обычной работы в видимом терминале используйте `web: dev server` или `bun run dev:web`.
Порт можно изменить через `WEB_DEV_SERVER_PORT`; тогда такой же порт нужно указать в `url`
выбранного debug-сценария.

## CLI backend на Rust

В VS Code нужен **CodeLLDB** (`vadimcn.vscode-lldb`); в Zed адаптер встроен.

1. Поставьте breakpoint, например, в `crates/cli/src/main.rs` или в `crates/core/src/fetcher.rs:30`.
2. Выберите `CLI backend: development`:
   - VS Code: `Ctrl+Shift+D` → сценарий → `F5`;
   - Zed: `F4` → сценарий → `Enter`.
3. Cargo соберёт `app`, после чего CLI скачает `https://example.com` в
   `target/debug-example.html`.

`CLI backend: release` делает то же с release-оптимизацией и записывает `target/release-example.html`.
Аргументы находятся в `args` сценария и могут быть изменены на другой URL и путь.

## Tauri backend

### Development

Сервер frontend запускается отдельно, а затем открывается окно Tauri:

1. Запустите задачу `native: dev server`:
   - VS Code: `Ctrl+Shift+P` → **Tasks: Run Task**;
   - Zed: `Alt+Shift+T`.
2. Поставьте breakpoint в `apps/native/src-tauri/src/commands.rs`.
3. Выберите `Native backend: development` через `F5` в VS Code или `F4` в Zed.

### Release

Выберите `Native backend: release`. VS Code соберёт frontend через `preLaunchTask`.
В Zed сначала запустите `native: build frontend` через `Alt+Shift+T`, затем сценарий через `F4`.

## Tauri frontend

### Windows: WebView2

1. Запустите `native: dev server`, затем `Native backend: development`.
2. После открытия окна Tauri выберите `Native frontend: attach WebView2 (Windows)`.
3. Ставьте breakpoints в `apps/native/src` и `packages/app`.

Development-сценарий backend передаёт WebView2 `--remote-debugging-port=9222`, поэтому attach
выполняется на тот же Chromium-совместимый порт, но frontend доступен на `localhost:1420`.

### Linux и macOS: WebKit

Chrome-compatible attach здесь не используется. Откройте штатный WebView Inspector в окне Tauri:

- Linux: `Ctrl+Shift+I`;
- macOS: `Cmd+Option+I`.

Breakpoints находятся в инспекторе WebKit, а не в панели VS Code или Zed.

## Если что-то не работает

- **Страница недоступна после launch:** проверьте `target/web-dev-server.log`. Vite запущен со
  `strictPort`, поэтому занятый порт является ошибкой, а не причиной молча перейти на другой.
- **Браузер не найден:** задайте `CHROME_PATH` и используйте сценарий с суффиксом `(CHROME_PATH)`.
- **Breakpoint серый или не срабатывает:** убедитесь, что используется dev-server Vite и новое окно
  браузера, открытое debug-сценарием. `webRoot` должен вести в корень монорепозитория.
- **Breakpoint в Solid не срабатывает повторно:** тело компонента выполняется один раз; перенесите
  breakpoint в обработчик события или реактивное вычисление.
- **Rust-диагностика не запускается:** выполните `bun run doctor` и `rustup toolchain install`.
  Нужные `clippy` и `rust-analyzer` перечислены в `rust-toolchain.toml`.
- **Browser launch в devcontainer:** проверьте, что исполняемый файл браузера доступен в той среде,
  где работает debug-адаптер. Для отладки в браузере проще открыть проект локально.
