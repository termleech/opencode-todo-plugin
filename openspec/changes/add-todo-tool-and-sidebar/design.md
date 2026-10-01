# Design

## Context

See proposal.md for motivation. Facts from the V2 plugin API (`@opencode/plugin` 2.0.21, OpenCode v2.0.21) that shape the approach:

- A plugin package can export a server entrypoint (`.`) and a TUI entrypoint (`./tui`). When the package is listed in `opencode.json(c)` `plugins` (or placed under `.opencode/plugins/<name>/` as `index.ts` + `tui.ts`), the CLI loads the TUI entrypoint automatically.
- Server plugins register tools with `ctx.tool.transform((editor) => editor.add(...))`. JSON Schema input is allowed. The executor's context includes `sessionID`, `agent`, `messageID`, `signal`, and `progress`.
- Tool `options.codemode` controls whether the tool is only reachable through Code Mode. `codemode: false` makes it a direct tool.
- `ctx.storage` is durable JSON storage scoped to the plugin ID, with `get`/`set`/`remove`/`scan`.
- `Rpc.define` (from `@opencode/plugin/rpc`) declares methods and events. The server registers handlers with `ctx.rpc.register`, which returns `events.emit`. Clients call `client.rpc(Def)`. Calls accept an optional `location`. Events arrive as `rpc.<id>.<name>` with `data` and `location`, and are live only.
- The TUI `sidebar.content` slot passes a reactive `{ sessionID }`. `context.data.session.get(sessionID)` returns `SessionInfo`, which includes `location`.
- Plugin instances are per location, so the TUI must route RPC calls to the location of the session being viewed.

## Goals / Non-Goals

**Goals:**
- Match V1 `todowrite`/`todoread` behavior closely enough that agents prompted the V1 way still work, using the new status names.
- Keep one source of truth (server storage). The TUI only reads and subscribes.
- Ship as one installable package with a server entrypoint and a TUI entrypoint.

**Non-Goals:**
- No editing from the TUI and no keyboard commands. Display only.
- No Effect-based plugin. Use the Promise API.
- No V1 `server()` compatibility export.

## Decisions

### Package layout

```
package.json         exports: ".", "./tui", "./rpc"
src/todo.ts          TodoItem type, status enum, validation, text formatting (pure)
src/store.ts         per-session load/save over ctx.storage, per-session write queue
src/rpc.ts           Rpc.define contract (id "todo")
src/index.ts         server Plugin.define: tools + RPC registration
src/tui.tsx          TUI Plugin.define: sidebar slot
test/*.test.ts       bun tests for todo.ts and store.ts
.opencode/plugins/todo/  dev only: shims that load src/ into this repo's OpenCode
```

Dev loading uses `.opencode/plugins/todo/{index,tui}.ts` shims that re-export `src/`. On OpenCode 2.0.21, listing this repo as a package directory in `opencode.jsonc` (`"."`, `"./"`, a relative path, or an absolute path) did not load it: `"."` failed with an npm install error against the home directory, and the other forms were dropped without an error. The local-file shim loads both entrypoints.

Keeping validation and formatting in a pure module (`todo.ts`) lets one tested module serve both tools and the RPC. Exporting `./rpc` separately lets the TUI, and later other clients, import the contract without loading the server code.

Alternative considered: a `.opencode/plugins/todo/` local plugin as the only form. It's simple for dogfooding, but it can't be published, so the package stays the product and the local plugin is just a dev shim.

### Plugin and tool IDs

- Server plugin ID `todo`, TUI plugin ID `todo.tui`, RPC ID `todo`.
- Tool names `todowrite` and `todoread`, without a namespace, to match V1 names that agents and prompts already use. Both are registered with `options: { codemode: false }` so they're direct tools the agent calls every turn, not Code Mode functions.
- Alternative considered: namespaced `todo_write`. Rejected because it breaks familiarity with V1 and gains nothing, since V2 has no built-in todo tool that could collide.

### Data model and storage

- `TodoItem = { content: string; status: "not_started" | "in_progress" | "completed" }`. Content is trimmed on write. No IDs, because the full-list-replace model doesn't need them.
- Storage key `session/<sessionID>` holds `{ todos: TodoItem[], updatedAt: number }`. Clearing writes `todos: []` instead of removing the key, so the timestamp survives. A missing key reads as `[]`.
- Writes go through a per-session promise chain kept in memory, so overlapping `todowrite` calls in one session apply in call order and don't interleave read-modify-write. Full replacement means last write wins. That is the intended semantics.
- Alternative considered: in-memory map with no storage. Rejected because the user chose durable per-session lists.

### Validation

- Use a hand-written validator in `todo.ts` that returns the first error as `{ index, reason }`, instead of relying only on JSON Schema rejection at the host. Host-level schema errors are generic, and the spec requires the error to name the item index and the allowed statuses.
- The JSON Schema on the tool still declares the enum and `required` fields, so models get the shape up front.
- Multiple `in_progress` items are allowed. The tool description steers the agent toward one at a time, matching V1, which guided this rather than enforcing it.

### Tool descriptions

Port the V1 `todowrite` guidance: when to use it (multi-step or non-trivial tasks, user-provided lists), when not to (single trivial steps), and conventions (mark `in_progress` before starting, `completed` immediately after finishing, keep one `in_progress`, send the full list every call). The descriptions live in `src/index.ts` as constants.

### Tool output

Both tools return `{ content: string }` in this format:

```
[x] Write failing test
[>] Implement parser
[ ] Update docs
1 completed, 1 in progress, 1 not started
```

`todoread` on an empty list returns `No todos.` The text is plain so it reads well in any model's context.

### RPC contract

```
Rpc.define({
  id: "todo",
  methods: {
    list: { input: { sessionID: string }, output: { todos: TodoItem[] } },
  },
  events: {
    updated: { schema: { sessionID: string, todos: TodoItem[] } },
  },
})
```

`todowrite` emits `updated` after the storage write succeeds. The event carries the full list so the TUI never needs a follow-up fetch.

### TUI rendering

- In `setup`, create a Solid store `todosBySession: Record<sessionID, TodoItem[]>` and subscribe once to `rpc(Todo).events.on("updated", ...)`, which writes into the store. Unsubscribe in cleanup.
- Claim `{ append: "sidebar.content", render: ({ sessionID }) => <TodoSection sessionID={sessionID} /> }`.
- `TodoSection` reacts to `sessionID`. When it changes, it looks up the session's `location` through `context.data.session.get` and calls `rpc(Todo).list({ sessionID }, { location })` to seed the store. That covers the "Current state on open" requirement and any events missed while disconnected.
- The section renders nothing when the list is empty. Otherwise it shows a header `Todos <completed>/<total>` and one row per item. Markers: `[ ]` for not started (muted), `[>]` for in progress (accent, bold), `[x]` for completed (muted, struck through if the theme supports it, otherwise muted only). Rows wrap within the sidebar width.
- Colors come from `context.theme`: `text.base` for not started, `text.action.primary.base` plus bold for in progress, and `text.muted` plus `TextAttributes.STRIKETHROUGH` for completed. Content text uses `wrapMode="word"`.
- `src/rpc.ts` is a plain object checked with `satisfies Rpc.PortableDefinition` and imports `Rpc` as a type only. The CLI resolves `@opencode/plugin/tui` at runtime but not `@opencode/plugin/rpc`, so a runtime `Rpc.define` call broke the TUI entrypoint. `Rpc.define` only rejects reserved `rpc.*` error names, and this contract declares no errors.

## Risks / Trade-offs

- [Live RPC events are dropped while disconnected] → Refetch on session change, and also on `session.execution.succeeded` for the viewed session, so the sidebar converges after each agent turn.
- [Plugin storage may be scoped per location, so a session viewed from a different directory may not find its list] → Always route `list` calls to the session's own `location`. Verify during implementation by viewing a session from another workspace.
- [Agents ignore the tool or keep stale statuses] → Tool description guidance. Adding a `context` hook later to inject the current list into the system prompt is possible but out of scope.
- [Global tool names can be overridden by another plugin's later registration] → Accepted. The last registration wins by design in V2, and that matches user expectations for plugin precedence.
- [Unbounded list size] → Cap at 100 items and 500 characters per item in validation, so a runaway agent can't bloat storage or the sidebar.

## Migration Plan

New package with no migration. To roll back, remove it from `plugins`. Stored lists stay in plugin storage and are ignored.
