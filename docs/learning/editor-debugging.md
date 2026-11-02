# Debugging frontend and backend in VS Code and Zed

[Русская версия](editor-debugging.ru.md)

A practical guide to the configurations in `.vscode/` and `.zed/`. It covers the web frontend, Rust
CLI, and Tauri backend/frontend. Hotkeys below use the default Linux keymap; some macOS shortcuts
differ — check **Keyboard Shortcuts** in VS Code and `keymap.json` in Zed.

## Launch or attach

- **Launch** starts the required environment. For web it runs `web: ensure dev server`: builds WASM,
  starts Vite if necessary, and checks HTTP readiness.
- **Attach** only connects to an existing server or browser. It does not start or stop anything.

| Target                                | Scenario                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Web in Chrome/Chromium/Yandex Browser | `Web frontend: launch Chromium`, `Web frontend: launch Chromium (CHROME_PATH)`, `Web frontend: attach Chromium` |
| Web in Firefox (VS Code only)         | `Web frontend: launch Firefox`, `Web frontend: attach Firefox`                                                  |
| CLI                                   | `CLI backend: development`, `CLI backend: release`                                                              |
| Rust backend Tauri                    | `Native backend: development`, `Native backend: release`                                                        |
| Frontend Tauri on Windows             | `Native frontend: attach WebView2 (Windows)`                                                                    |

Rust release scenarios keep optimisation but add `profile.release.debug=true`, preserving symbols
and source information.

## VS Code panels and hotkeys

### Main actions

| Action                      | How                                                          |
| --------------------------- | ------------------------------------------------------------ |
| Open **Run and Debug**      | `Ctrl+Shift+D` or the play-with-bug icon on the Activity Bar |
| Select a scenario           | Dropdown at the top of **Run and Debug**                     |
| Start the selected scenario | `F5` or the green play button next to the dropdown           |
| Toggle a breakpoint         | `F9` on the line or click the gutter next to its number      |
| Run a task                  | `Ctrl+Shift+P` → **Tasks: Run Task** → task name             |
| Open Debug Console          | `Ctrl+Shift+Y` or **View → Debug Console**                   |
| Open the terminal           | `` Ctrl+` ``                                                 |

**Run and Debug** provides **Variables**, **Watch**, **Call Stack**, and **Breakpoints**. The
**Debug Console** evaluates expressions in the selected stack frame. The terminal shows task output
from Vite and builds.

### Execution controls

| Action                                            | Hotkeys         |
| ------------------------------------------------- | --------------- |
| Continue / Pause                                  | `F5`            |
| Step Over — next line without entering a function | `F10`           |
| Step Into — enter a function                      | `F11`           |
| Step Out — leave the current function             | `Shift+F11`     |
| Restart with the same scenario                    | `Ctrl+Shift+F5` |
| Stop                                              | `Shift+F5`      |

The same actions are available on the floating **Debug toolbar**. Right-click a breakpoint in the
gutter to add a condition or logpoint.

## Zed panels and hotkeys

### Main actions

| Action                               | How                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Open the debug scenario list         | `F4` or `Ctrl+Shift+P` → **debugger: start**                           |
| Select and start a scenario          | Select it in **New Debug Session** and press `Enter`                   |
| Start a new session from Debug Panel | `+` at the top right of the panel                                      |
| Toggle a breakpoint                  | Click the gutter next to the line number; `F9` is not bound by default |
| Run a task                           | `Alt+Shift+T` or `Ctrl+Shift+P` → **task: spawn**                      |
| Rerun the last task                  | `Alt+T`                                                                |
| Toggle the bottom dock               | `Ctrl+J`                                                               |
| Select a thread                      | `Ctrl+T` while Debug Panel has focus                                   |
| Select a debug session               | `Ctrl+I` while Debug Panel has focus                                   |

Debug Panel contains variables, call stack, breakpoints, console, terminal, and threads.
Right-click a breakpoint to add a condition, hit count, or logpoint. In the **Breakpoints** list,
`Space` toggles a breakpoint and `Backspace` deletes it.

### Execution controls

| Action                                 | Hotkeys                        |
| -------------------------------------- | ------------------------------ |
| Rerun the last debug session           | `F5` outside a breakpoint stop |
| Continue while stopped on a breakpoint | `F5`                           |
| Pause while running                    | `F6`                           |
| Step Over                              | `F10` or `F7`                  |
| Step Into                              | `F11` or `Ctrl+F11`            |
| Step Out                               | `Shift+F11`                    |
| Restart the current session            | `Ctrl+Shift+F5`                |
| Stop                                   | `Shift+F5`                     |

The same controls are available in the Debug Panel toolbar.

## Web frontend: launch in Chrome, Chromium, or Yandex Browser

### VS Code

1. Install the recommended extensions if you have not already. Chromium-compatible browsers need
   no additional browser extension.
2. Open `packages/app/src/SaveForm.tsx` and press `F9`, for example on line 19
   (`setBusy(true)`) or line 22 (`core.saveUrl(...)`).
3. Press `Ctrl+Shift+D` and select `Web frontend: launch Chromium`.
4. Press `F5`. Wait for the WASM build and Vite startup; a new browser window opens.
5. In **that new window**, click “Download and save”. When execution stops, inspect **Variables**,
   **Watch**, and **Call Stack**.

If Chrome/Chromium is not detected automatically, or you use Yandex Browser, set the executable
before starting the editor:

```bash
export CHROME_PATH=/usr/bin/yandex-browser
code .
```

Then select `Web frontend: launch Chromium (CHROME_PATH)` instead of the default launch.

### Zed

1. Open `packages/app/src/SaveForm.tsx` and click the gutter on the desired line.
2. Press `F4`, select `Web frontend: launch Chromium`, and confirm with `Enter`.
3. Wait for the build task and the new browser window.
4. Interact with the application. Variables and the call stack appear in Debug Panel.

For Yandex Browser start Zed as follows:

```bash
export CHROME_PATH=/usr/bin/yandex-browser
zed .
```

Then select `Web frontend: launch Chromium (CHROME_PATH)`.

A Solid component body runs once, not on every update like a React render. To inspect a button
click, put the breakpoint inside `submit`, not only in the `SaveForm` body.

## Web frontend: attach to a Chromium-compatible browser

Use this when the browser is configured manually. Attach does not start Vite itself.

```bash
bun run dev:web:start
"$CHROME_PATH" --remote-debugging-port=9222 \
  --user-data-dir=/tmp/another-useless-app-browser \
  http://localhost:5173
```

If `CHROME_PATH` is unset, replace it with the path to Chrome, Chromium, or Yandex Browser.
A separate `user-data-dir` avoids connecting to the browser's normal profile.

Next:

- in VS Code open **Run and Debug**, select `Web frontend: attach Chromium`, and press `F5`;
- in Zed press `F4`, select `Web frontend: attach Chromium`, and confirm with `Enter`.

Open the page in the browser that received port `9222` and set breakpoints in advance.

## Web frontend: Firefox (VS Code only)

Zed's built-in JavaScript adapter supports Node and Chromium-compatible browsers, but not Firefox.
Use Firefox Developer Tools with Zed. In VS Code install the recommended **Debugger for Firefox**
extension (`firefox-devtools.vscode-firefox-debug`).

### Launch

1. Set a breakpoint in a TS/TSX file.
2. Press `Ctrl+Shift+D`, select `Web frontend: launch Firefox`, and press `F5`.
3. Wait for Vite and a new Firefox window.

### Attach

```bash
bun run dev:web:start
firefox -start-debugger-server
```

Open `http://localhost:5173` in Firefox, then select `Web frontend: attach Firefox` and `F5`.
Firefox uses port `6000`, not CDP port `9222`. If a breakpoint is not mapped to a file, use the
extension's **Path Mapping Wizard**: source maps must lead to the monorepo root.

## Managing Vite

Launch reuses an existing server or leaves a new one running for subsequent sessions. PID and logs
are in `target/web-dev-server.pid` and `target/web-dev-server.log`.

To stop it:

- VS Code: `Ctrl+Shift+P` → **Tasks: Run Task** → `web: stop dev server`;
- Zed: `Alt+Shift+T` → `web: stop dev server`;
- terminal: `bun run dev:web:stop`.

For normal development with visible terminal output use `web: dev server` or `bun run dev:web`.
`WEB_DEV_SERVER_PORT` changes the helper port; set the same port in the debug scenario's `url`.

## Rust CLI backend

VS Code needs **CodeLLDB** (`vadimcn.vscode-lldb`); the adapter is built into Zed.

1. Set a breakpoint, for example in `crates/cli/src/main.rs` or `crates/core/src/fetcher.rs:30`.
2. Select `CLI backend: development`:
   - VS Code: `Ctrl+Shift+D` → scenario → `F5`;
   - Zed: `F4` → scenario → `Enter`.
3. Cargo builds `app`, then the CLI downloads `https://example.com` into
   `target/debug-example.html`.

`CLI backend: release` uses release optimisation and writes `target/release-example.html`.
Edit the scenario's `args` to use a different URL and path.

## Tauri backend

### Development

The frontend server starts separately, then the Tauri window opens:

1. Run `native: dev server`:
   - VS Code: `Ctrl+Shift+P` → **Tasks: Run Task**;
   - Zed: `Alt+Shift+T`.
2. Set a breakpoint in `apps/native/src-tauri/src/commands.rs`.
3. Select `Native backend: development` with `F5` in VS Code or `F4` in Zed.

### Release

Select `Native backend: release`. VS Code builds the frontend through `preLaunchTask`.
In Zed first run `native: build frontend` through `Alt+Shift+T`, then start the scenario with `F4`.

## Tauri frontend

### Windows: WebView2

1. Run `native: dev server`, then `Native backend: development`.
2. After the Tauri window opens, select `Native frontend: attach WebView2 (Windows)`.
3. Set breakpoints in `apps/native/src` and `packages/app`.

The backend development scenario passes `--remote-debugging-port=9222` to WebView2. Attach uses the
same Chromium-compatible port, while the frontend is served on `localhost:1420`.

### Linux and macOS: WebKit

Chrome-compatible attach is unavailable here. Open the native WebView Inspector in the Tauri window:

- Linux: `Ctrl+Shift+I`;
- macOS: `Cmd+Option+I`.

Breakpoints are available in the WebKit inspector, not in the VS Code or Zed panel.

## Troubleshooting

- **The page is unavailable after launch:** check `target/web-dev-server.log`. Vite uses
  `strictPort`, so an occupied port is an error rather than a reason to switch ports silently.
- **The browser is not found:** set `CHROME_PATH` and use the scenario with the `(CHROME_PATH)` suffix.
- **A breakpoint is grey or does not fire:** use Vite's dev server and the new browser window opened
  by the debug scenario. `webRoot` must point to the monorepo root.
- **A Solid breakpoint does not fire again:** a component body runs once; move the breakpoint into
  an event handler or reactive computation.
- **Rust diagnostics do not start:** run `bun run doctor` and `rustup toolchain install`.
  `clippy` and `rust-analyzer` are listed in `rust-toolchain.toml`.
- **Browser launch in a devcontainer:** ensure the browser executable is available in the same
  environment as the debug adapter. Local project setup is simpler for browser debugging.
