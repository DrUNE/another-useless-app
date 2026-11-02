# another-useless-app

[Русская версия](README.ru.md)

[![CI](https://github.com/DrUNE/another-useless-app/actions/workflows/ci.yml/badge.svg)](https://github.com/DrUNE/another-useless-app/actions/workflows/ci.yml)

A learning project: the application itself is intentionally useless, but it demonstrates how to build
cross-platform applications with one core and independent builds for each target.

**Goal:** practise cross-platform architecture: ports and adapters, a shared core, dependency
boundaries, independent builds, and platform-free tests.

## Build targets

Each target builds independently and does not pull in another target's toolchains (the CLI build
does not require Node/Vite, and the web build does not require native Rust applications).

| Target  | Stack                          | Status                                                                     |
| ------- | ------------------------------ | -------------------------------------------------------------------------- |
| CLI     | Rust (`crates/cli`)            | ready                                                                      |
| Web     | Solid 2 + Tailwind + WASM core | works: UI on WASM, files in OPFS (verified in Chromium and Yandex Browser) |
| Desktop | Tauri 2                        | works on Linux (IPC, tests, build, rpm); Windows and macOS unverified      |
| Mobile  | Tauri 2 (Android, iOS)         | planned                                                                    |

## Stack

- **Rust** (edition 2024) — core and native adapters
- **Tauri 2** — desktop and mobile
- **Solid 2** (`2.0.0-rc.x`), **TypeScript 7** (native `tsc`), **Tailwind 4**, **Vite 8**
- **bun** — package manager and workspaces (dependency versions pinned through `catalog`)

## Architecture

One platform-independent core; everything environment-specific is hidden behind ports (Rust traits,
TypeScript interfaces). Implementations are connected at each application's entry point.

```
apps/
  web/              # Vite + Solid 2 + Tailwind: thin entry point
  native/           # Tauri 2: thin Solid entry point + src-tauri (Rust commands, capabilities)
crates/
  core/             # domain, use cases, Fs/Http ports. No tokio/reqwest/std::fs
  platform-native/  # adapters: tokio::fs, reqwest (CLI and Tauri)
  core-wasm/        # thin wasm-bindgen wrapper for the browser
  cli/              # `app` binary
packages/
  config/           # shared tsconfig and Tailwind theme (theme.css)
  app/              # shared Solid UI; core comes from CoreContext
  core-api/         # core contract, typed errors, contract scenarios
  platform/         # TS ports Fs/Http/Platform
  platform-web/     # browser adapters: OPFS, fetch
  core-wasm/        # WASM build, TS port bridge, createCore(platform)
```

Dependency rules:

```
cli, native →  platform-native  →  core
web         →  core-wasm (+ OPFS/fetch TS adapters)  →  core
web, native →  app (shared UI)
```

- `core` has no platform dependencies and builds both natively and for `wasm32`.
- Only application entry points connect platform code.
- Business logic is tested with fake ports, without network or disk access.

Decisions and trade-offs are recorded in [`docs/adr/`](docs/adr/README.md), including the bilingual
documentation policy in [ADR-0020](docs/adr/0020-bilingual-docs-and-api-reference.md).

## Development environment

Tool versions live in repository files, not in this README: `rust-toolchain.toml` (Rust, wasm32,
components), `package.json` → `packageManager` (bun), `Cargo.lock` (`wasm-bindgen-cli`), and
`tools/system-deps/debian.txt` (system packages). CI, the container, and `bun run doctor` read the
same files. Package scripts, builds, linting, and tests run on bun: Node.js and pnpm are not needed.

**Option 1. Devcontainer** (Linux container with all tools; Docker or Podman and VS Code or another
environment with devcontainer support): open the repository and choose **Reopen in Container**.
Web, WASM, CLI, tests, lint, and Linux Tauri builds/tests work. A Tauri window (graphics forwarding),
Windows/macOS Tauri builds, Android emulation (KVM), and iOS do not work in the container.

The initial image build downloads several gigabytes and can take a while: base development tools,
WebKitGTK/GTK, Rust with WASM, and `wasm-bindgen-cli` are included. Subsequent runs are faster due
to layers and named volumes for dependencies and build artifacts.

**Option 2. Local setup:**

```sh
rustup toolchain install   # repository root: Rust, wasm32, and components from rust-toolchain.toml
bun install
bun run doctor             # missing tools and OS-specific hints
```

`bun run doctor` only reads the system. Groups can be selected: `bun run doctor core wasm native`.
Desktop Tauri requires system libraries (WebKitGTK, GTK 3, etc.): on Debian and Ubuntu use
`xargs -a tools/system-deps/debian.txt sudo apt-get install -y`; for other systems see
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). CLI, WASM, and web do not need
those packages. Mobile will additionally require Android SDK/NDK; iOS requires macOS.

### Editors

Workspace settings are provided for **VS Code** (`.vscode/`) and **Zed** (`.zed/`). After
`bun install`, both editors use local Oxlint and Oxfmt: diagnostics come from `.oxlintrc.json`,
formatting runs on save, and Rust is formatted through `rust-analyzer`.

VS Code recommends Rust Analyzer, Oxc, Tailwind CSS, Tauri, CodeLLDB, and Debugger for Firefox;
these extensions are preinstalled in the devcontainer. For Zed, install Oxc, HTML, TOML, and
Dockerfile through **zed: extensions**. Automatic extension installation belongs only in the user's
`settings.json`, not the project file. Rust, TypeScript, and their debug adapters are built in.

#### Debugging

Step-by-step instructions with panels, buttons, and hotkeys:
[Debugging frontend and backend in VS Code and Zed](docs/learning/editor-debugging.md).

Scenarios are in `.vscode/launch.json` and `.zed/debug.json`; tasks are in `.vscode/tasks.json` and
`.zed/tasks.json`. In VS Code use **Tasks: Run Task** and **F5**; in Zed use **task: spawn** and
**F4**. Shared scenarios and tasks match; Firefox is available only in VS Code.

| Scenario                                      | Preparation                                                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Web frontend: launch Chromium`               | Just launch: `web: ensure dev server` builds WASM, starts Vite if needed, waits for readiness, and opens Chrome/Chromium.          |
| `Web frontend: launch Chromium (CHROME_PATH)` | Set `CHROME_PATH` before starting the editor, for example `export CHROME_PATH=/usr/bin/yandex-browser`; Vite starts automatically. |
| `Web frontend: attach Chromium`               | Start Vite and a Chromium-compatible browser with `--remote-debugging-port=9222` and a separate `--user-data-dir`.                 |
| `Web frontend: launch Firefox` (VS Code)      | Vite starts automatically; Debugger for Firefox opens the browser after it is ready.                                               |
| `Web frontend: attach Firefox` (VS Code)      | Start Vite and `firefox -start-debugger-server`; port 6000 is used instead of CDP port 9222.                                       |
| `CLI backend: development` / `release`        | No preparation: Cargo builds the binary. The example downloads `https://example.com` into the ignored `target/` directory.         |
| `Native backend: development`                 | Run `native: dev server`, then the scenario; it opens the Tauri window.                                                            |
| `Native backend: release`                     | VS Code builds the frontend through `preLaunchTask`; in Zed run `native: build frontend` first.                                    |
| `Native frontend: attach WebView2 (Windows)`  | Run `Native backend: development` first to pass port 9222 to WebView2, then run the attach scenario.                               |

Launch scenarios call `web: ensure dev server`: an existing server is reused, and a new one remains
for subsequent sessions. Stop it with `web: stop dev server` or `bun run dev:web:stop`; PID and logs
are in `target/`. Attach scenarios neither start nor stop the server. `WEB_DEV_SERVER_PORT` changes
the helper port; update `url` in the scenario to match.

Rust release scenarios pass `profile.release.debug=true`, keeping release optimisation while adding
debug symbols. Vite enables source maps in development, and `webRoot` points to the monorepo root so
breakpoints work in both `apps/web` and `packages/app`.

The Tauri frontend on Linux and macOS uses the native WebView Inspector (**Ctrl+Shift+I** on Linux,
**Cmd+Option+I** on macOS), not a Chrome-compatible port. WebView2 attach is Windows-only. Zed's
built-in JavaScript adapter supports Node and Chromium-compatible browsers but not Firefox; use
VS Code with the recommended extension or Firefox Developer Tools.

## Commands

```sh
bun install                  # install JS dependencies

bun run test:rust            # Rust tests without Tauri (`cargo test --workspace --exclude app-native`)
bun run typecheck            # TypeScript checks (Rust is not required)
bun run lint                 # oxlint: types, dependency boundaries, Solid rules
bun run boundaries           # Rust and TS dependency boundaries (Rust required)
bun run deny                 # Rust dependencies: advisories, licenses, bans, sources (`cargo install cargo-deny --locked --version 0.20.2`)
bun run format               # oxfmt (TS/JSON/CSS/HTML) and cargo fmt
bun run format:check         # TS formatting check
bun run test                 # TS tests (vitest)

bun run build:wasm           # build the core to WASM: packages/core-wasm/pkg
bun run check:wasm           # build WASM and typecheck dependent code
bun run test:wasm            # test the Rust ↔ JS boundary on real WASM
bun run test:e2e             # browser E2E (Chrome/Chromium; CHROME_PATH is supported)

bun run dev:web              # web: Vite dev server in the current terminal
bun run dev:web:start        # web: ensure a background Vite server for browser launch
bun run dev:web:stop         # web: stop the Vite server started by the previous command
bun run build:web            # web: production build in apps/web/dist

bun run dev:native           # desktop: Tauri window with hot reload
bun run build:native         # desktop: release build and packaging (rpm/deb/AppImage)
bun run test:native          # Tauri crate tests: IPC, permissions, binding freshness
bun run update:bindings      # regenerate apps/native/src/bindings.ts after command changes

# CLI: download a URL and save it to a file
cargo run -p app-cli -- fetch https://example.com /tmp/example.html
cargo build -p app-cli --release   # binary: target/release/app
```

Further reading:
[Solid 2 and Tailwind 4 for React developers](docs/learning/solid-and-tailwind-for-react-developers.md),
[Rust for TypeScript developers](docs/learning/rust-for-typescript-developers.md),
[editor debugging guide](docs/learning/editor-debugging.md).

## Roadmap and process

Current plans live in the pinned [Roadmap issue (#8)](https://github.com/DrUNE/another-useless-app/issues/8)
and linked issues. Work follows issue → branch → pull request (`Closes #N`) → squash merge.
Details for people and agents are in [AGENTS.md](AGENTS.md).

## License

- **Code** (`crates/`, `packages/`, `apps/`, `tools/`, `tests/`, this README and AGENTS.md): [MIT](LICENSE), © 2026 Andrey Litvinov.
- **Texts in [`docs/`](docs/)** (ADRs and guides): [CC BY 4.0](docs/LICENSE). Use and modification are allowed with attribution; code fragments inside remain under MIT.
- Dependencies have their own licenses. For Rust, `bun run deny` checks permissive licenses and MPL-2.0. Preserve dependency notices when distributing binaries (not automated yet; see [ADR-0019](docs/adr/0019-licenses.md)).
