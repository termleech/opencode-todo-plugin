# opencode-todo-plugin

An OpenCode V2 plugin that brings back the V1 todo tools and shows the current session's todos in the right sidebar.

## Install

```sh
opencode plugin add opencode-todo-plugin
```

Or add it to `plugins` in `opencode.json(c)`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-todo-plugin"],
}
```

The package has a server entrypoint (the tools) and a TUI entrypoint (the sidebar). OpenCode loads both from one `plugins` entry.

## Tools

| Tool        | Input                                   | Behavior                                                         |
| ----------- | --------------------------------------- | ---------------------------------------------------------------- |
| `todowrite` | `{ todos: { content, status }[] }`      | Replaces the session's whole list, in the order given. `[]` clears it. |
| `todoread`  | none                                    | Returns the session's current list.                              |

`status` is one of `not_started`, `in_progress`, or `completed`. Content is trimmed and must not be empty. A list can hold up to 100 items of up to 500 characters each. If any item is invalid, the call fails with the item's index and the stored list doesn't change.

Both tools return the list as text:

```
[x] Write failing test
[>] Implement parser
[ ] Update docs
1 completed, 1 in progress, 1 not started
```

Each session has its own list, saved in plugin storage, so it survives restarts. A subagent's child session has a list separate from its parent's.

## Sidebar

When the session you're viewing has todos, a **Todos** section appears in the right sidebar. It shows completed/total in the header and one row per item:

- `[ ]` not started
- `[>]` in progress (highlighted, bold)
- `[x]` completed (muted, struck through)

It updates live as the agent writes and disappears when the list is empty. It shows only the viewed session's list.

## RPC

Other plugins and clients can import the contract from `opencode-todo-plugin/rpc`:

```ts
import { Todo } from "opencode-todo-plugin/rpc"

const todo = client.rpc(Todo)
const { todos } = await todo.list({ sessionID })
todo.events.on("updated", (event) => console.log(event.data.sessionID, event.data.todos))
```

## Development

```sh
bun install
bun test
bunx tsc --noEmit
```

`.opencode/plugins/todo/` contains shims that load `src/` into OpenCode sessions opened in this repo. Server changes need the location to reload:

```sh
opencode api post '/api/location/reload?location[directory]='"$PWD" -d '{}'
# or, for a full restart (ends running sessions):
opencode service restart
```

The TUI entrypoint reloads when files under `.opencode/plugins/` change.
