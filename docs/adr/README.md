# Architecture Decision Records

Здесь фиксируются архитектурные решения проекта: что решили, почему, какие были альтернативы
и чем за это платим. Формат и правила — в [0001](0001-record-architecture-decisions.md).

| № | Решение | Статус |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Фиксируем решения в ADR | принято |
| [0002](0002-rust-core-wasm-for-web.md) | Ядро на Rust, web через WASM | принято |
| [0003](0003-ports-and-adapters.md) | Порты и адаптеры для ввода-вывода | принято |
| [0004](0004-ports-futures-not-send.md) | Futures в портах без требования `Send` | принято |
| [0005](0005-bun-workspaces-with-catalog.md) | bun workspaces с `catalog`, без Turborepo | принято |
| [0006](0006-independent-builds.md) | Независимые сборки для каждой цели | принято |
| [0007](0007-protect-main-squash-only.md) | Защита `main` и слияние только через squash | принято |
| [0008](0008-wasm-boundary.md) | Граница WASM: порты реализуются в JS, артефакты не коммитятся | принято |
| [0009](0009-typed-ipc-tauri-specta.md) | Типизированный IPC через tauri-specta | принято |
| [0010](0010-native-app-isolation-and-trust.md) | Нативное приложение: изоляция сборки и модель доверия | принято |
| [0011](0011-oxc-lint-and-format.md) | Линтер и форматтер: oxlint и oxfmt | принято |
| [0012](0012-reproducible-dev-environment.md) | Воспроизводимое окружение: закреплённые версии, doctor и devcontainer | принято |
