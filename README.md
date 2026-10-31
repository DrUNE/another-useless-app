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
| Web | Solid 2 + Tailwind + ядро в WASM | каркас готов, сервис пока заглушка |
| Desktop | Tauri 2 | запланировано |
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
  web/              # Vite + Solid 2 + Tailwind
crates/
  core/             # домен, use-cases, порты Fs/Http. Без tokio/reqwest/std::fs
  platform-native/  # адаптеры портов: tokio::fs, reqwest (для CLI и Tauri)
  cli/              # бинарник `app`
packages/
  config/           # общие tsconfig и Tailwind-тема (theme.css)
  platform/         # TS-порты Fs/Http/Platform (для web-стороны)
```

Правила зависимостей:

```
cli, tauri  →  platform-native  →  core
web         →  core-wasm (+ TS-адаптеры OPFS/fetch)  →  core
```

- `core` не зависит от платформы и поэтому собирается и в нативный код, и в `wasm32`.
- Платформенный код подключает только точка входа приложения.
- Бизнес-логика тестируется на фейках портов, без сети и диска.

Решения и компромиссы зафиксированы в [`docs/adr/`](docs/adr/README.md).

## Требования

- [Rust](https://rustup.rs) (stable, проверено на 1.99)
- [bun](https://bun.sh) 1.4+
- для web (позже): таргет `wasm32-unknown-unknown`
- для mobile (позже): Android SDK/NDK; для iOS нужен macOS

## Команды

```sh
bun install                  # установить JS-зависимости

cargo test --workspace       # тесты Rust (ядро проверяется на фейках)
bun run typecheck            # typecheck TS-пакетов

bun run dev:web              # web: dev-сервер Vite
bun run build:web            # web: продакшен-сборка в apps/web/dist

# CLI: скачать URL и сохранить в файл
cargo run -p app-cli -- fetch https://example.com /tmp/example.html
cargo build -p app-cli --release   # бинарник: target/release/app
```

Скрипты `dev:native` и `build:native` уже заведены, но `apps/native` ещё не создан.

Для изучения: [Solid 2 и Tailwind 4 для разработчика на React](docs/learning/solid-and-tailwind-for-react-developers.md).

## Дорожная карта и процесс

Актуальные планы — в закреплённом issue [Roadmap (#8)](https://github.com/DrUNE/another-useless-app/issues/8)
и связанных задачах. Работа идёт так: issue → ветка → pull request (`Closes #N`) → squash-слияние.
Подробности для людей и агентов — в [AGENTS.md](AGENTS.md).
