# Proposal

## Why

OpenCode V1 shipped a todo tool that let an agent lay out a plan as an ordered checklist and update each item's status as it worked. OpenCode V2 dropped it, so agents have no structured way to track multi-step work and users can't see where an agent is in its plan. This plugin brings the tool back on the V2 plugin API and shows the list in the TUI sidebar.

## What Changes

- New OpenCode V2 plugin package with a server entrypoint (`index.ts`) and a TUI entrypoint (`tui.tsx`).
- Server plugin registers two agent tools:
  - `todowrite`: replaces the session's whole todo list with an ordered array of `{ content, status }` items. `status` is one of `not_started`, `in_progress`, or `completed`.
  - `todoread`: returns the session's current list.
- Todos are stored durably per session in plugin storage and survive restarts. Each session (including subagent child sessions) has its own list.
- Server plugin exposes a small RPC contract (`todo.list` method and `todo.updated` event) so clients can read the list and get live updates.
- TUI plugin appends a "Todos" section to the right sidebar (`sidebar.content` slot) for the viewed session. It shows each item in order with a status marker and updates live when the agent writes. The section is hidden when the session has no todos.

## Capabilities

### New Capabilities

- `todo-tracking`: Agent-facing todo tools, the todo data model and validation, per-session durable storage, and the RPC contract for reading and observing a session's list.
- `todo-sidebar`: TUI display of the viewed session's todo list in the right sidebar, including ordering, status presentation, live updates, and the empty state.

### Modified Capabilities

None. The project has no existing specs.

## Impact

- New code: plugin package (`package.json`, `src/index.ts`, `src/rpc.ts`, `src/tui.tsx`, shared types, tests).
- Dependencies: `@opencode/plugin` (pinned to the targeted OpenCode V2 release, currently `2.0.21`), with peer dependencies `@opentui/core`, `@opentui/solid`, and `solid-js` for the TUI entrypoint.
- Runtime surface: two new tools visible to every agent unless permissions restrict them, one RPC namespace (`todo`), and one sidebar section.
- Out of scope: editing todos from the TUI, priorities, cross-session or project-wide lists, rolling child-session todos up into the parent, and V1 compatibility.
