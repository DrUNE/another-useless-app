# AGENTS.md

[Русская версия](AGENTS.ru.md)

Instructions for AI agents working in this repository. See `README.md` for the project overview.

## Context

This is a learning project about cross-platform architecture. Understanding decisions matters more
than the application itself.

- Work in small steps: one idea at a time, verified by builds/tests.
- Explain the chosen decision, its rationale, and the alternative.
- Read `docs/adr/` before changing architecture. Record significant decisions in a new ADR
  (format and rules in `docs/adr/0001-*`); replace accepted ADRs with new ones instead of rewriting.
- User experience: TypeScript and React — high; Rust, Solid, Tailwind — low. Apply best practices in
  these three areas and explain why.
- Use React/TS analogies and explicitly call out concepts that look similar but work differently
  (Solid components run once, unlike React renders; signals are functions, not `useState` values;
  destructuring props breaks reactivity; use `Show`/`For` instead of ternaries and `map`; Rust uses
  `Result` instead of exceptions, and a trait is not the same as an interface).
- Explain only non-trivial TypeScript/React topics.
- Communicate with the user in Russian. Code, identifiers, and commits are in English.

## Structure

- `crates/core` — domain, use cases, ports (`Fs`, `Http`). Platform-independent.
- `crates/platform-native` — native port adapters (tokio, reqwest).
- `crates/cli` — console application (`app` binary).
- `crates/core-wasm` — thin `wasm-bindgen` wrapper around the core for browsers (no logic).
- `packages/platform` — TS ports (`Fs`, `Http`, `Platform`).
- `packages/platform-web` — browser port adapters (OPFS, `fetch`).
- `packages/core-wasm` — WASM build, TS port bridge (`src/bridge.ts`), `createCore(platform)`.
- `packages/config` — shared tsconfig and `theme.css` (Tailwind).
- `tools/doctor` — environment diagnostics; `tools/boundaries` — dependency boundary checks with
  rules in `rules.json`.
- `tools/ci` — selects CI jobs from changed files (`select` with tests), ADR-0017.
- `tools/dev-server` — background Vite for browser launch, readiness checks, and shutdown.
- `deny.toml` — Rust dependency policy for `cargo-deny`; `.github/workflows/audit.yml` — weekly
  vulnerability checks.
- `tests/e2e` — web E2E (`vitest` + `playwright-core`, system Chrome); skipped without a browser,
  failing with `E2E_REQUIRE_BROWSER=1`.
- `packages/core-api` — core contract (ADR-0014): `Core`, `CoreError`/`CoreException`,
  `contract/scenarios.json`, and `defineCoreContract` for tests. No dependencies.
- `packages/app` — shared Solid UI. Depends only on `@app/core-api`; core comes from `CoreContext`
  supplied by the entry point.
- `apps/web` — entry point: creates `createCore(createWebPlatform())` (WASM + OPFS + fetch) and
  provides it through `CoreContext`. Dev/build/check builds WASM and requires Rust and
  `wasm-bindgen-cli`.
- `apps/native` — Tauri 2. `src/` contains the IPC service (`core.ts`) and generated bindings
  (`bindings.ts`); `src-tauri/` contains Rust commands, capabilities, and `tauri.conf.json`.
- Planned: `packages/ui`, `packages/features/*`.

## Hard architecture rules

1. `app-core` must not depend on tokio, reqwest, `std::fs`, DOM, or Tauri. It must build for
   `wasm32`. Do not add dependencies that break this without discussion.
2. I/O goes only through ports. A new platform capability means a new port in `core` (and in
   `packages/platform` for TS) plus adapters in `platform-*`.
3. Port futures do not require `Send` (wasm32 futures are `!Send`).
4. Only application entry points (`cli`, `src-tauri`, `apps/web`, `apps/native/src`) connect adapters
   and concrete cores. `packages/app` does not know the core, and applications do not depend on each
   other.
5. No `if (isTauri)` checks in application code: differences are expressed through port presence
   (`hasCapability` / `requirePort`).
6. Builds are independent: CLI does not require Node/Vite, web does not require Tauri. Web requires
   Rust, the wasm32 target, and `wasm-bindgen-cli` (ADR-0008).
7. Cover new logic with tests using fake ports (see `crates/core/src/fetcher.rs`).
8. WASM boundary: `packages/core-wasm/pkg` is generated and not committed. The `wasm-bindgen-cli`
   version equals the pinned `wasm-bindgen` crate version (`=x.y.z`). JS port shapes are declared in
   Rust (`typescript_custom_section`); TS types come from there, not from handwritten duplicates.
9. One port does not imply identical behavior: browser `Http` obeys CORS, and OPFS is not the user's
   filesystem. Do not promise native semantics for web in UI or documentation.
10. Native application (ADR-0009, ADR-0010): Tauri commands are declared in `build.rs` and allowed in
    both capabilities (`allow-<name>`); UI paths are untrusted and confined to the data directory
    (`resolve()`); TS bindings are generated (`bun run update:bindings`), never edited manually;
    system plugins (`fs`, `http`) are not enabled.
11. UI/core boundary (ADR-0014): UI sees only `Core` from `@app/core-api` via `CoreContext`; failures
    are always `CoreException` with a typed `kind` (UI translates it via `describeError`). A new core
    capability requires a `Core` method, scenarios in `contract/scenarios.json`, both implementations
    (WASM and IPC), and tests. Untrusted paths follow one policy: `app_core::path::validate_relative`;
    CLI is trusted and does not apply it.
12. Dependency boundaries (ADR-0015) are data in `tools/boundaries/rules.json`. Update rules with
    architecture changes and verify each new rule by intentionally violating it in a real manifest
    (stale rules must fail, not silently pass).
13. Rust dependencies (ADR-0018): run `bun run deny` after every `Cargo.toml`/`Cargo.lock` change.
    Exceptions in `deny.toml` require a reason (tested); do not add `openssl`, `native-tls` (TLS is
    `rustls` only), or packages outside crates.io.

## Commands

```sh
bun install
bun run test:rust                 # Rust tests without Tauri (`--exclude app-native`; WebKit not needed)
bun run test:native               # Tauri crate: IPC, permissions, binding freshness (system libraries required)
bun run update:bindings           # regenerate apps/native/src/bindings.ts
cargo fmt --all --check           # formatting (checked by CI)
bun run typecheck                 # TS typecheck (native tsc from TypeScript 7), Rust not needed
bun run lint                      # oxlint --type-aware: types, package boundaries, Solid rules
bun run boundaries                # dependency boundaries from real Rust/TS graphs (ADR-0015; Rust required)
bun run deny                      # Rust dependencies: advisories, licenses, bans, sources (cargo-deny required)
bun run format                    # oxfmt + cargo fmt: fixes formatting
bun run format:check              # TS formatting check (CI)
bun run test                      # TS tests (vitest)
bun run check:wasm                # WASM build and typecheck of pkg-dependent code (core-wasm and web)
bun run test:wasm                 # TS tests of the Rust↔JS boundary on real WASM (wasm-bindgen-cli required)
bun run test:e2e                  # end-to-end web scenario in a real browser (Chrome/Chromium, CHROME_PATH)
bun run dev:web                   # web dev server (Vite; builds WASM first)
bun run dev:web:start             # ensure background Vite for browser launch
bun run dev:web:stop              # stop Vite started through dev:web:start
bun run build:web                 # production web build in apps/web/dist
bun run dev:native                # Tauri window (opens a real window: do not run without user request)
bun run build:native -- --no-bundle   # release build without packaging (same as CI)
cargo run -p app-cli -- fetch <url> <path>
```

Before finishing, run `bun run format:check`, `bun run format:check:rust`, `bun run lint`,
`bun run test:rust`, `bun run typecheck`, and `bun run test`. For web changes also run
`bun run build:web` (typecheck misses plugin and Tailwind errors); for `core`, `core-wasm`, or
`platform-web` changes also run `bun run check:wasm` and `bun run test:wasm`; for `src-tauri` or
command changes also run `bun run test:native`. Explicitly report anything that could not be checked.

**Environment (ADR-0012).** `bun run doctor` reports missing tools and never installs anything.
Versions have one source: Rust — `rust-toolchain.toml`, bun — `package.json` (`packageManager`),
`wasm-bindgen-cli` — `Cargo.lock`, Debian system packages — `tools/system-deps/debian.txt`. Do not
write versions in `ci.yml` or scripts; read these files (checked by `tools/doctor/src/consistency.test.ts`).
Node.js is not needed: checks run on bun (ADR-0013). Checking “without Node.js” on a host with
`fnm`/`nvm` is unreliable because `bun run` may find another Node; the container is authoritative.
Its image is in `.devcontainer/`.

## Stack and versions

- bun workspaces; dependency versions are pinned in the root `package.json` `catalog`. Add packages
  with `"catalog:"`, not a separate version.
- Solid 2 is currently RC (`solid-js` and `@solidjs/web` `2.0.0-rc.x`; Vite plugin
  `@solidjs/vite-plugin` `3.0.0-next.x`; `vite-plugin-solid` was renamed and is unused). APIs differ
  from Solid 1.x and React: consult `node_modules/solid-js/CHEATSHEET.md` and `docs/learning/`, not
  memory or old tutorials. `jsxImportSource` is `@solidjs/web`; DOM APIs (`render`, etc.) are imported
  from `@solidjs/web`.
- TypeScript 7: the native compiler is invoked as `tsc` (not `tsgo`).
- Tailwind 4 uses CSS-first mode; theme is in `packages/config/theme.css`, class sources via `@source`.
- Rust edition 2024, resolver 3. Shared crate dependencies use `[workspace.dependencies]`.

## Style

- Rust: `cargo fmt`, library errors through `thiserror`.
- TS/TSX/JSON/CSS: `oxfmt` (`bun run format`), linted by `oxlint` (ADR-0011). Do not enable the
  `react` plugin or `solid/imports` (they target React and Solid 1.x). Generated files (`bindings.ts`,
  `pkg/`) are in `ignorePatterns` and are not formatted or linted.
- Package import boundaries use `no-restricted-imports` in `.oxlintrc.json`. Verify new boundaries
  with an intentional violation: patterns follow gitignore style, `*` does not cross `/`, so use `**`.
- TS: strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`; tsconfig extends `@app/config`.
- Comments explain “why”, not “what”. Follow the surrounding comment density.
- Documentation files are bilingual: English is canonical (`.md`), Russian is next to it (`.ru.md`),
  with cross-links. Special filenames fixed by GitHub may contain both languages inline.
- Ordinary `//` comments are Russian. Rustdoc (`///`, `//!`) and TSDoc (`/** ... */`) are English for
  docs.rs, declaration output, and IDE quick info. Do not edit generated files to enforce these rules.
  There is no standalone generated API site (ADR-0021).
- Existing legacy documents and API comments are migrated in separate PRs. The consistency test
  checks language pairs but cannot judge translation quality.

## GitHub workflow

Work happens through issues and pull requests. GitHub Issues are the source of truth for plans;
the pinned Roadmap issue provides the overview.

1. **Issue.** Every task starts with an issue (`Task` or `Bug` template). Create one if needed and
   link it to the Roadmap.
2. **Branch.** One branch per issue from fresh `main`: `<type>/<summary>`, for example
   `feat/web-skeleton`, `docs/adr-0007`. No direct commits to `main`.
3. **Commits.** Small Conventional Commits in English (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`),
   one idea each.
4. **Pull request.** Fill the template and include `Closes #N`. Title follows commit style in
   English; description is in Russian. List skipped checks honestly under “Not verified”.
5. **Merge.** Squash only, after the aggregate `ci` check is green (it collects all jobs and the OS
   matrix; path-skipped jobs count as success, ADR-0017). The branch is deleted automatically.
   These settings are enforced by GitHub (see `docs/adr/0007-*`): direct pushes to `main` are
   impossible. Adding an OS or job does not require branch-protection changes. The Roadmap updates
   automatically when an issue closes. Job selection keeps a list of “known irrelevant” files in
   `tools/ci/src/select.ts`: unknown files are considered relevant. Update that list and tests when
   adding directories or dependencies between project areas.

User confirmation is required for commits, pushes, creating/closing issues and PRs, and merging.
A user request to “create an issue/PR” confirms those named actions only, not other actions such as
merging.

Do not add `node_modules`, `target`, or `dist` to the repository (see `.gitignore`).
