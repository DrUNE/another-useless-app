# another-useless-app

[![CI](https://github.com/DrUNE/another-useless-app/actions/workflows/ci.yml/badge.svg)](https://github.com/DrUNE/another-useless-app/actions/workflows/ci.yml)

Учебный проект: приложение, которое ничего полезного не делает, зато показывает, как строить
кроссплатформенные приложения с одним ядром и независимыми сборками под каждую платформу.

**Цель** — освоить практики кроссплатформенной архитектуры: порты и адаптеры, общее ядро,
границы зависимостей, раздельные сборки, тесты без платформы.

## Цели сборки

Каждая цель собирается отдельно и не тянет чужие тулчейны (сборка CLI не требует Node/Vite,
сборка web не требует Rust-приложений).

| Цель | Стек | Статус |
|---|---|---|
| CLI | Rust (`crates/cli`) | готово |
| Web | Solid 2 + Tailwind + ядро в WASM | работает: UI на WASM-ядре, файлы в OPFS (проверено в Chromium) |
| Desktop | Tauri 2 | работает на Linux (IPC, тесты, сборка, rpm); Windows и macOS не проверялись |
| Mobile | Tauri 2 (Android, iOS) | запланировано |

## Стек

- **Rust** (edition 2024) — ядро и нативные адаптеры
- **Tauri 2** — desktop и mobile
- **Solid 2** (`2.0.0-rc.x`), **TypeScript 7** (нативный `tsc`), **Tailwind 4**, **Vite 8**
- **bun** — менеджер пакетов и workspaces (версии закреплены через `catalog` в `package.json`)

## Архитектура

Один платформо-независимый core; всё, что зависит от окружения, спрятано за портами
(trait в Rust, интерфейсы в TS). Реализации подставляются в точке входа каждого приложения.

```
apps/
  web/              # Vite + Solid 2 + Tailwind: тонкая точка входа
  native/           # Tauri 2: тонкая точка входа Solid + src-tauri (Rust-команды, capabilities)
crates/
  core/             # домен, use-cases, порты Fs/Http. Без tokio/reqwest/std::fs
  platform-native/  # адаптеры портов: tokio::fs, reqwest (для CLI и Tauri)
  core-wasm/        # тонкая wasm-bindgen-привязка ядра для браузера
  cli/              # бинарник `app`
packages/
  config/           # общие tsconfig и Tailwind-тема (theme.css)
  app/              # общий UI на Solid; ядро приходит из контекста (CoreContext)
  core-api/         # контракт ядра: интерфейс Core, типизированные ошибки, контрактные сценарии
  platform/         # TS-порты Fs/Http/Platform
  platform-web/     # адаптеры портов для браузера: OPFS, fetch
  core-wasm/        # сборка WASM, TS-мост портов, createCore(platform)
```

Правила зависимостей:

```
cli, native →  platform-native  →  core
web         →  core-wasm (+ TS-адаптеры OPFS/fetch)  →  core
web, native →  app (общий UI)
```

- `core` не зависит от платформы и поэтому собирается и в нативный код, и в `wasm32`.
- Платформенный код подключает только точка входа приложения.
- Бизнес-логика тестируется на фейках портов, без сети и диска.

Решения и компромиссы зафиксированы в [`docs/adr/`](docs/adr/README.md).

## Окружение разработки

Версии инструментов закреплены в файлах репозитория, а не в README: `rust-toolchain.toml` (Rust, таргет wasm32,
компоненты), `package.json` → `packageManager` (bun), `Cargo.lock` (версия `wasm-bindgen-cli`) и
`tools/system-deps/debian.txt` (системные пакеты). CI, контейнер и `bun run doctor` читают эти же файлы.
Менеджер пакетов, скрипты, сборка, линтер и все тесты работают на bun: ни Node.js, ни pnpm не нужны.

**Вариант 1. Devcontainer** (Linux-контейнер со всем внутри; нужен Docker или Podman и VS Code либо другая среда с поддержкой
devcontainer): откройте репозиторий и выберите «Reopen in Container». Работают web, WASM, CLI, тесты, lint, сборка и тесты Tauri
под Linux. Не работает в контейнере: окно Tauri (нужен проброс графики), сборка Tauri под Windows и macOS (для этого CI),
Android-эмулятор (нужен KVM) и iOS.

Первичная сборка образа скачает несколько гигабайт и займёт заметное время: внутри базовое окружение разработчика,
WebKitGTK/GTK, Rust с WASM и сборка `wasm-bindgen-cli`. Точное время зависит от сети и процессора; повторные запуски
быстрее благодаря кэшу слоёв и именованным томам для зависимостей и артефактов.

**Вариант 2. Локально:**

```sh
rustup toolchain install   # в корне репозитория: Rust, wasm32 и компоненты из rust-toolchain.toml
bun install
bun run doctor             # что ещё не хватает; подскажет команду для вашей ОС
```

`bun run doctor` ничего не меняет в системе. Группы можно выбрать: `bun run doctor core wasm native`.
Для desktop (Tauri) нужны системные библиотеки (WebKitGTK, GTK 3 и др.): на Debian и Ubuntu это
`xargs -a tools/system-deps/debian.txt sudo apt-get install -y`, для остальных систем см.
[prerequisites Tauri](https://v2.tauri.app/start/prerequisites/). CLI, WASM и web эти пакеты не требуют.
Для mobile (позже): Android SDK/NDK; iOS возможен только на macOS.

## Команды

```sh
bun install                  # установить JS-зависимости

bun run test:rust            # тесты Rust без Tauri (`cargo test --workspace --exclude app-native`)
bun run typecheck            # typecheck TS-пакетов (Rust не нужен)
bun run lint                 # oxlint: типы, границы пакетов, правила Solid
bun run boundaries           # границы зависимостей Rust и TS по реальным графам (нужен Rust)
bun run deny                 # зависимости Rust: уязвимости, лицензии, запретные крейты и источники (`cargo install cargo-deny --locked --version 0.20.2`)
bun run format               # oxfmt (TS/JSON/CSS/HTML) и cargo fmt (Rust)
bun run format:check         # проверка форматирования TS без записи
bun run test                 # TS-тесты (vitest)

bun run build:wasm           # собрать ядро в WASM: packages/core-wasm/pkg
bun run check:wasm           # сборка WASM + typecheck кода, который его импортирует
bun run test:wasm            # тесты границы Rust ↔ JS на реальном WASM (собирает его сам)
bun run test:e2e            # сквозной сценарий веба в браузере (нужен Chrome/Chromium; путь в CHROME_PATH)

bun run dev:web              # web: dev-сервер Vite
bun run build:web            # web: продакшен-сборка в apps/web/dist

bun run dev:native           # desktop: окно Tauri с горячей перезагрузкой
bun run build:native         # desktop: релизная сборка и упаковка (rpm/deb/AppImage)
bun run test:native          # тесты Tauri-крейта: IPC, права, актуальность привязок
bun run update:bindings      # перегенерировать apps/native/src/bindings.ts после правки команд

# CLI: скачать URL и сохранить в файл
cargo run -p app-cli -- fetch https://example.com /tmp/example.html
cargo build -p app-cli --release   # бинарник: target/release/app
```

Для изучения:
[Solid 2 и Tailwind 4 для разработчика на React](docs/learning/solid-and-tailwind-for-react-developers.md),
[Rust для разработчика на TypeScript](docs/learning/rust-for-typescript-developers.md).

## Дорожная карта и процесс

Актуальные планы — в закреплённом issue [Roadmap (#8)](https://github.com/DrUNE/another-useless-app/issues/8)
и связанных задачах. Работа идёт так: issue → ветка → pull request (`Closes #N`) → squash-слияние.
Подробности для людей и агентов — в [AGENTS.md](AGENTS.md).

## Лицензия

- **Код** (`crates/`, `packages/`, `apps/`, `tools/`, `tests/`, этот README и AGENTS.md): [MIT](LICENSE), © 2026 Andrey Litvinov.
- **Тексты в [`docs/`](docs/)** (ADR и конспекты): [CC BY 4.0](docs/LICENSE). Использование и изменение разрешены при указании авторства; фрагменты кода внутри этих текстов под MIT.
- У зависимостей свои лицензии. Для Rust `bun run deny` следит, чтобы это были разрешительные лицензии и MPL-2.0. Поставляя собранные программы, сохраняйте уведомления зависимостей (пока не автоматизировано, см. [ADR-0019](docs/adr/0019-licenses.md)).
