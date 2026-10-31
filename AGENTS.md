# AGENTS.md

Инструкции для ИИ-агентов, работающих в этом репозитории. Обзор проекта — в `README.md`.

## Контекст

Учебный проект по практикам кроссплатформенной архитектуры. Ценность в понимании решений,
а не в самом приложении.

- Двигайтесь небольшими шагами: одна идея за раз, с проверкой сборкой/тестами.
- Объясняйте, какое решение принято, почему и какая была альтернатива.
- Перед изменением архитектуры прочитайте `docs/adr/`. Значимые решения фиксируйте новым ADR
  (формат и правила — в `docs/adr/0001-*`); принятые ADR не переписывайте, а заменяйте новыми.
- Уровень пользователя: TypeScript и React — высокий; Rust, Solid, Tailwind — низкий. В этих трёх
  областях применяйте лучшие практики и объясняйте, почему именно так.
- Проводите аналогии с React/TS и отдельно выделяйте концепты, которые выглядят похоже, но работают
  иначе (например: компонент Solid выполняется один раз, а не на каждый рендер; сигнал — это функция,
  а не значение `useState`; деструктуризация props ломает реактивность; `Show`/`For` вместо
  тернарников и `map`; в Rust `Result` вместо исключений, trait не то же самое, что interface).
  В TS/React объясняйте только нетривиальное.
- Общайтесь с пользователем по-русски. Код, идентификаторы и коммиты — на английском.

## Структура

- `crates/core` — домен, use-cases, порты (`Fs`, `Http`). Платформо-независимый.
- `crates/platform-native` — нативные адаптеры портов (tokio, reqwest).
- `crates/cli` — консольное приложение (бинарник `app`).
- `crates/core-wasm` — тонкая `wasm-bindgen`-привязка ядра для браузера (логики нет).
- `packages/platform` — TS-порты (`Fs`, `Http`, `Platform`).
- `packages/platform-web` — адаптеры портов для браузера (OPFS, `fetch`).
- `packages/core-wasm` — сборка WASM, TS-мост портов (`src/bridge.ts`), `createCore(platform)`.
- `packages/config` — общие tsconfig и `theme.css` (Tailwind).
- `tools/doctor` — диагностика окружения; `tools/boundaries` — проверка границ зависимостей, правила в `rules.json`.
- `tests/e2e` — сквозные тесты веба (`vitest` + `playwright-core`, системный Chrome); без браузера пропускаются, а с `E2E_REQUIRE_BROWSER=1` падают.
- `packages/core-api` — контракт ядра (ADR-0014): интерфейс `Core`, `CoreError`/`CoreException`, `contract/scenarios.json`
  и `defineCoreContract` для тестов. Ни от чего не зависит.
- `packages/app` — общий UI на Solid. Знает только `@app/core-api`; ядро берёт из `CoreContext`, его подставляет точка входа.
- `apps/web` — точка входа: создаёт `createCore(createWebPlatform())` (WASM + OPFS + fetch) и кладёт в `CoreContext`.
  Для dev/build/check собирает WASM, поэтому требует Rust и `wasm-bindgen-cli`.
- `apps/native` — Tauri 2. `src/` — точка входа с IPC-сервисом (`core.ts`) и сгенерированными привязками
  (`bindings.ts`); `src-tauri/` — Rust: команды (`commands.rs`), capabilities, `tauri.conf.json`.
- Планируются: `packages/ui`, `packages/features/*`.

## Жёсткие правила архитектуры

1. `app-core` не зависит от tokio, reqwest, `std::fs`, DOM, Tauri. Должен собираться под `wasm32`.
   Не добавляйте в него зависимости, ломающие это, без обсуждения.
2. Ввод-вывод только через порты. Новая платформенная возможность = новый порт в `core`
   (и в `packages/platform` для TS) + адаптеры в `platform-*`.
3. Futures в портах без требования `Send` (в wasm32 они `!Send`).
4. Адаптеры и конкретное ядро подключает только точка входа приложения (`cli`, `src-tauri`, `apps/web`,
   `apps/native/src`). `packages/app` ядра не знает. Приложения не зависят друг от друга.
5. Нет проверок вида `if (isTauri)` в прикладном коде: отличия выражаются через наличие порта
   (`hasCapability` / `requirePort`).
6. Сборки независимы: CLI не должен требовать Node/Vite, web — Tauri. (Web требует Rust, таргет wasm32
   и `wasm-bindgen-cli`: ADR-0008.)
7. Новую логику покрывайте тестами на фейках портов (см. `crates/core/src/fetcher.rs`).
8. Граница WASM: `packages/core-wasm/pkg` генерируется и не коммитится. Версия `wasm-bindgen-cli`
   равна версии крейта `wasm-bindgen` (закреплён как `=x.y.z`). Форма JS-портов описана в Rust
   (`typescript_custom_section`), TS-типы берутся оттуда, а не пишутся вручную.
9. Один порт не значит одинаковое поведение: в вебе `Http` подчиняется CORS, а OPFS не является
   файловой системой пользователя. Не обещайте в UI и текстах нативной семантики для web.
10. Нативное приложение (ADR-0009, ADR-0010): команды Tauri объявлены в `build.rs` и разрешены в обеих
    capabilities (`allow-<имя>`); пути из UI недоверенные и ограничены каталогом данных (`resolve()`);
    TS-привязки генерируются (`bun run update:bindings`), руками `bindings.ts` не правят; системные плагины
    (`fs`, `http`) не подключаются.
11. Граница UI и ядра (ADR-0014): интерфейс видит только `Core` из `@app/core-api` и получает его через `CoreContext`;
    отказ всегда `CoreException` с типизированной причиной `kind` (UI переводит её в текст, `describeError`). Новая
    возможность ядра = метод в `Core` + сценарии в `contract/scenarios.json` + обе реализации (WASM и IPC) + тесты.
    Политика путей для недоверенных входов одна: `app_core::path::validate_relative`; CLI как доверенный её не применяет.

12. Границы зависимостей (ADR-0015) заданы данными в `tools/boundaries/rules.json`. Меняя архитектуру, обновляйте правила
    и проверяйте новое правило намеренным нарушением в настоящем манифесте (устаревшее правило падает, а не молчит).

## Команды

```sh
bun install
bun run test:rust                 # Rust-тесты без Tauri (`--exclude app-native`; WebKit не нужен)
bun run test:native               # Tauri-крейт: IPC, права, актуальность привязок (нужны системные библиотеки)
bun run update:bindings           # перегенерировать apps/native/src/bindings.ts
cargo fmt --all --check           # форматирование (CI это проверяет)
bun run typecheck                 # TS typecheck (tsc из TypeScript 7), Rust не нужен
bun run lint                      # oxlint --type-aware: типы, границы пакетов, правила Solid
bun run boundaries                # границы зависимостей по реальным графам Rust и TS (ADR-0015; нужен Rust)
bun run format                    # oxfmt + cargo fmt: исправляет форматирование
bun run format:check              # проверка форматирования TS (CI)
bun run test                      # TS-тесты (vitest)
bun run check:wasm                # сборка WASM + typecheck кода, зависящего от pkg (core-wasm и web)
bun run test:wasm                 # TS-тесты границы Rust↔JS на реальном WASM (собирает его; нужен wasm-bindgen-cli)
bun run test:e2e                  # сквозной сценарий веба в настоящем браузере (ADR-0016; нужен Chrome/Chromium, CHROME_PATH)
bun run dev:web                   # dev-сервер web (Vite; сначала собирает WASM)
bun run build:web                 # продакшен-сборка web в apps/web/dist
bun run dev:native                # окно Tauri (открывает настоящее окно: не запускайте без просьбы пользователя)
bun run build:native -- --no-bundle   # релизная сборка без упаковки (как в CI)
cargo run -p app-cli -- fetch <url> <path>
```

Перед завершением задачи прогоните `bun run format:check`, `bun run format:check:rust`, `bun run lint`, `bun run test:rust`,
`bun run typecheck` и `bun run test`; если менялся web — ещё `bun run build:web` (typecheck не ловит
ошибки плагинов и Tailwind), если менялись `core`, `core-wasm` или `platform-web` — ещё `bun run check:wasm`
и `bun run test:wasm`; если менялись `src-tauri` или команды — ещё `bun run test:native`.
Если что-то не удалось проверить (например, нет wasm-таргета), прямо скажите об этом.

**Окружение (ADR-0012).** `bun run doctor` показывает, чего не хватает; он только читает и ничего не ставит. Версии живут в
одном месте: Rust — `rust-toolchain.toml`, bun — `package.json` (`packageManager`), `wasm-bindgen-cli` — `Cargo.lock`, системные
пакеты Debian — `tools/system-deps/debian.txt`. Не прописывайте версии в `ci.yml` и скриптах, читайте из этих файлов (это проверяет
`tools/doctor/src/consistency.test.ts`). Node.js не нужен: все проверки идут на bun (ADR-0013). Проверять «без Node.js» на хосте с `fnm`/`nvm` ненадёжно, `bun run` может найти чужой Node; арбитр — контейнер. Образ — `.devcontainer/`.

## Стек и версии

- bun workspaces; версии зависимостей закреплены в `catalog` корневого `package.json`.
  Добавляя пакет, используйте `"catalog:"`, а не отдельную версию.
- Solid 2 пока в RC (`solid-js` и `@solidjs/web` `2.0.0-rc.x`, плагин Vite — `@solidjs/vite-plugin`
  `3.0.0-next.x`; `vite-plugin-solid` переименован и не используется). API отличается от Solid 1.x и от React:
  сверяйтесь с `node_modules/solid-js/CHEATSHEET.md` и `docs/learning/`, а не с памятью и старыми туториалами.
  В tsconfig `jsxImportSource` — `@solidjs/web`; DOM-API (`render` и др.) импортируются из `@solidjs/web`.
- TypeScript 7: нативный компилятор запускается как `tsc` (не `tsgo`).
- Tailwind 4 в CSS-first режиме; тема в `packages/config/theme.css`, источники классов через `@source`.
- Rust edition 2024, resolver 3. Зависимости общих крейтов — через `[workspace.dependencies]`.

## Стиль

- Rust: форматирование `cargo fmt`, ошибки через `thiserror` в библиотеках.
- TS/TSX/JSON/CSS: форматирует `oxfmt` (`bun run format`), линтит `oxlint` (ADR-0011). Не включайте плагин `react`
  и правило `solid/imports` (они для React и Solid 1.x). Сгенерированные файлы (`bindings.ts`, `pkg/`) не форматируйте
  и не линтите: они в `ignorePatterns`.
- Границы между пакетами заданы правилами `no-restricted-imports` в `.oxlintrc.json`. Новую границу проверяйте
  намеренным нарушением: шаблоны в стиле gitignore, `*` не пересекает `/`, нужны `**`.
- TS: strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`; tsconfig наследуются от `@app/config`.
- Комментарии объясняют «почему», а не «что». Следуйте плотности комментариев вокруг.

## Рабочий процесс (GitHub)

Работа ведётся через issue и pull request. Источник правды о планах — GitHub Issues;
обзор текущих дел — закреплённый issue «Roadmap» со списком задач.

1. **Issue.** Любая работа начинается с issue (шаблон `Task` или `Bug`). Если подходящего нет,
   создайте его и свяжите с Roadmap.
2. **Ветка.** Одна ветка на issue от свежего `main`: `<тип>/<кратко>`, например `feat/web-skeleton`,
   `docs/adr-0007`. Прямых коммитов в `main` нет.
3. **Коммиты.** Conventional Commits на английском (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`),
   небольшие и по одной идее.
4. **Pull request.** Заполняйте шаблон, указывайте `Closes #N`. Заголовок PR — в стиле коммита,
   на английском; описание — на русском. В «Не проверено» честно перечисляйте пропущенное.
5. **Слияние.** Только squash, только после зелёных проверок `rust (cargo test)`, `ts (typecheck)`,
   `wasm (build and test)` и `native (desktop build)`;
   ветка удаляется автоматически. Это закреплено настройками GitHub (см. `docs/adr/0007-*`):
   прямой пуш в `main` невозможен. Имена проверок совпадают с именами job в `ci.yml`; при
   переименовании job обновите защиту ветки. Roadmap обновляется сам, когда закрывается issue.

Что требует подтверждения пользователя: коммиты, пуши, создание/закрытие issue и PR, слияние.
Просьба пользователя «создай issue/PR» — это и есть подтверждение для названных действий,
но не для других (например, слияния).

Не добавляйте в репозиторий `node_modules`, `target`, `dist` (см. `.gitignore`).
