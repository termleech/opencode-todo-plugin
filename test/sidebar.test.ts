import { describe, expect, test } from "bun:test"
import { loadSessionTodos } from "../src/sidebar.ts"
import type { TodoItem } from "../src/todo.ts"

describe("todo sidebar data loading", () => {
  test("routes the initial read to the session's full workspace location", async () => {
    const sessionID = "ses_workspace"
    const location = { directory: "/projects/example", workspaceID: "workspace_123" }
    const todos: TodoItem[] = [{ content: "Persisted workspace todo", status: "in_progress" }]
    const calls: unknown[] = []

    const result = await loadSessionTodos(async (input, options) => {
      calls.push({ input, options })
      return { todos }
    }, sessionID, location)

    expect(calls).toEqual([{ input: { sessionID }, options: { location } }])
    expect(result).toEqual(todos)
  })
})
