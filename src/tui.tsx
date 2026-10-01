import { TextAttributes } from "@opentui/core"
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { For, Show, createEffect, createMemo, on } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { Todo } from "./rpc.ts"
import { countTodos, marker } from "./todo.ts"
import type { TodoItem } from "./todo.ts"

type TodoState = {
  todos: Record<string, TodoItem[]>
}

export default Plugin.define({
  id: "todo.tui",
  setup(context) {
    const rpc = context.client.rpc(Todo)
    const [state, setState] = createStore<TodoState>({ todos: {} })
    // Bumped on every live event, so a fetch that started before an event can't overwrite it.
    const revisions = new Map<string, number>()

    const apply = (sessionID: string, todos: TodoItem[]) => {
      setState("todos", sessionID, reconcile(todos))
    }

    const locationOf = async (sessionID: string) => {
      if (!context.data.session.get(sessionID)) await context.data.session.sync(sessionID).catch(() => {})
      return context.data.session.get(sessionID)?.location ?? context.location ?? context.data.location.default()
    }

    const refresh = async (sessionID: string) => {
      const revision = revisions.get(sessionID) ?? 0
      try {
        const location = await locationOf(sessionID)
        const result = await rpc.list({ sessionID }, { location: { directory: location.directory } })
        if ((revisions.get(sessionID) ?? 0) !== revision) return
        apply(sessionID, (result as { todos: TodoItem[] }).todos)
      } catch (error) {
        console.error("todo.tui: failed to load todos", error)
      }
    }

    const stopUpdated = rpc.events.on("updated", (event) => {
      const { sessionID, todos } = event.data as { sessionID: string; todos: TodoItem[] }
      revisions.set(sessionID, (revisions.get(sessionID) ?? 0) + 1)
      apply(sessionID, todos)
    })

    const watched = new Set<string>()
    const stopSucceeded = context.data.on("session.execution.succeeded", (event) => {
      if (watched.has(event.data.sessionID)) void refresh(event.data.sessionID)
    })

    const TodoSection = (props: { sessionID: string }) => {
      const plugin = usePlugin()
      const theme = () => plugin.theme

      createEffect(
        on(
          () => props.sessionID,
          (sessionID, previous) => {
            if (previous) watched.delete(previous)
            watched.add(sessionID)
            void refresh(sessionID)
          },
        ),
      )

      const todos = createMemo(() => state.todos[props.sessionID] ?? [])
      const completed = createMemo(() => countTodos(todos()).completed)

      const color = (status: TodoItem["status"]) =>
        status === "in_progress" ? theme().text.action.primary.base : status === "completed" ? theme().text.muted : theme().text.base

      const attributes = (status: TodoItem["status"]) =>
        status === "in_progress"
          ? TextAttributes.BOLD
          : status === "completed"
            ? TextAttributes.STRIKETHROUGH
            : TextAttributes.NONE

      return (
        <Show when={todos().length > 0}>
          <box flexDirection="column">
            <box flexDirection="row" justifyContent="space-between">
              <text fg={theme().text.base} attributes={TextAttributes.BOLD}>
                Todos
              </text>
              <text fg={theme().text.muted}>
                {completed()}/{todos().length}
              </text>
            </box>
            <For each={todos()}>
              {(todo) => (
                <box flexDirection="row" gap={1}>
                  <text fg={color(todo.status)} flexShrink={0}>
                    {marker(todo.status)}
                  </text>
                  <text fg={color(todo.status)} attributes={attributes(todo.status)} wrapMode="word" flexGrow={1} flexShrink={1}>
                    {todo.content}
                  </text>
                </box>
              )}
            </For>
          </box>
        </Show>
      )
    }

    const releaseSlot = context.ui.slot({
      append: "sidebar.content",
      render: (input) => <TodoSection sessionID={input.sessionID} />,
    })

    return () => {
      releaseSlot()
      stopUpdated()
      stopSucceeded()
    }
  },
})
