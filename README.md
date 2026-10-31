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
| Web | Solid 2 + Tailwind + ядро в WASM | UI с заглушкой; ядро в WASM собирается и проверено в браузере, к UI не подключено |
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
  app/              # общий UI на Solid; сервис приходит из точки входа
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

## Требования

- [Rust](https://rustup.rs) (stable, проверено на 1.99)
- [bun](https://bun.sh) 1.4+
- для WASM-сборки ядра: таргет `wasm32-unknown-unknown` (`rustup target add wasm32-unknown-unknown`)
  и `wasm-bindgen-cli` **той же версии, что крейт `wasm-bindgen` в `Cargo.lock`**
  (`cargo install wasm-bindgen-cli --version <версия> --locked`; версию покажет `cargo pkgid wasm-bindgen`)
- для desktop (Tauri) на Linux: WebKitGTK 4.1, GTK 3, libsoup 3, librsvg, openssl, dbus и libxdo с заголовками.
  Debian/Ubuntu: `libwebkit2gtk-4.1-dev libsoup-3.0-dev libgtk-3-dev librsvg2-dev libssl-dev libdbus-1-dev libxdo-dev`.
  ALT: `libwebkit2gtk4.1-devel libsoup3.0-devel libgtk+3-devel librsvg-devel libssl-devel libdbus-devel xdotool-devel`.
  Остальные цели (CLI, WASM, web) эти пакеты не требуют
- для mobile (позже): Android SDK/NDK; для iOS нужен macOS

## Команды

```sh
bun install                  # установить JS-зависимости

bun run test:rust            # тесты Rust без Tauri (`cargo test --workspace --exclude app-native`)
bun run typecheck            # typecheck TS-пакетов (Rust не нужен)
bun run test                 # TS-тесты (vitest)

bun run build:wasm           # собрать ядро в WASM: packages/core-wasm/pkg
bun run check:wasm           # сборка WASM + typecheck кода, который его импортирует
bun run test:wasm            # тесты моста Rust ↔ JS под Node

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
