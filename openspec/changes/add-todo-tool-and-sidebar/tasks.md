# Tasks

## 1. Scaffold the package

- [x] 1.1 Create `package.json` (name `opencode-todo-plugin`, `type: module`, exports `.` → `src/index.ts`, `./tui` → `src/tui.tsx`, `./rpc` → `src/rpc.ts`; dependency `@opencode/plugin@2.0.21`; peers `@opentui/core`, `@opentui/solid`, `solid-js`), `tsconfig.json` (Solid JSX for OpenTUI), and `.gitignore`. Verify `bun install` succeeds and `bunx tsc --noEmit` passes on stub entrypoints.
- [x] 1.2 Add dev-only shims `.opencode/plugins/todo/index.ts` and `.opencode/plugins/todo/tui.ts` that re-export `src/index.ts` and `src/tui.tsx`. Verify `opencode api get /api/info` still responds and the plugin list for this directory shows `todo` with server and TUI features active (after group 3 lands a real setup).

## 2. Todo model and storage

- [x] 2.1 Implement `src/todo.ts`: `TodoStatus`, `TodoItem`, `validateTodos` (non-empty trimmed content ≤ 500 characters, status enum, ≤ 100 items, returns first `{ index, reason }`), and `formatTodos` (marker lines plus status counts, `No todos.` when empty). Verify with `test/todo.test.ts` covering every scenario in the "Todo item shape", "Todo list size limits", and "Write result reports the stored list" requirements (`bun test`).
- [x] 2.2 Implement `src/store.ts` over a minimal storage interface (`get`/`set`): `load(sessionID)` returns `[]` when missing, and `save(sessionID, todos)` writes `{ todos, updatedAt }` through a per-session promise chain. Verify with `test/store.test.ts` using an in-memory fake: missing key returns empty, sessions are isolated, clearing persists `[]`, and two concurrent saves apply in call order.

## 3. Server plugin: tools and RPC

- [x] 3.1 Define the RPC contract in `src/rpc.ts` (`id: "todo"`, method `list`, event `updated`) with JSON Schemas matching `TodoItem`. Use a plain object checked with `satisfies Rpc.PortableDefinition` and a type-only import, because the TUI runtime resolves only `@opencode/plugin/tui`. Verify it type-checks and imports cleanly from both `src/index.ts` and `src/tui.tsx`.
- [x] 3.2 Implement `src/index.ts` with `Plugin.define({ id: "todo" })`. Register `todowrite` and `todoread` through `ctx.tool.transform` with `codemode: false` and V1-derived descriptions, using `context.sessionID`. Register the RPC `list` handler, and emit `updated` only after a successful save. Verify with `test/plugin.test.ts`, which drives `setup` with a fake ctx (captures the tool executors, RPC handlers, and emits) and covers replace, reorder, clear, invalid-write-leaves-list-unchanged, no event on failure, and RPC list for an unknown session.
- [x] 3.3 Dogfood in this repo: restart with `opencode service restart`, confirm `todowrite`/`todoread` appear in the tool list, have an agent write and update a 3-item list, then restart the service and confirm `todoread` returns the same list.

## 4. TUI sidebar

- [x] 4.1 Implement `src/tui.tsx` with `Plugin.define({ id: "todo.tui" })`: a Solid store keyed by session, one `rpc(Todo).events.on("updated")` subscription disposed in cleanup, and a `sidebar.content` append slot rendering `TodoSection`. Verify `bunx tsc --noEmit` passes and the plugin loads without errors in `~/.local/share/opencode/log/opencode.log` (`role=cli`).
- [x] 4.2 In `TodoSection`, seed the store from `rpc(Todo).list({ sessionID }, { location })` using the session's `location` whenever `sessionID` changes, and refetch on `session.execution.succeeded` for the viewed session. Verify manually: open a session with stored todos after a TUI restart and see the list, switch to another session and see that session's list (or none), and view a parent while its subagent writes todos and see only the parent's list.
- [x] 4.3 Render the header `Todos <completed>/<total>` and rows with distinct markers and theme colors (emphasized in-progress, de-emphasized completed). Wrap long content and render nothing for an empty list. Resolve the theme-token and strikethrough open question here. Verify manually: a mixed-status list shows three distinct markers and the correct count, a 300-character item stays inside the sidebar, and clearing the list removes the section live.

## 5. Documentation and release readiness

- [ ] 5.1 Write `README.md` covering install (`opencode plugin add` and a `plugins` entry), tool behavior and status values, sidebar behavior, and the dev loop (`opencode.jsonc` + `opencode service restart`). Verify the documented install steps work from a clean project directory.
- [ ] 5.2 End-to-end check against the installed package rather than the workspace copy: `npm pack`, install the tarball in a scratch project, and confirm both tools work and the sidebar updates live during a multi-step agent task.
