import type { LocationRef } from "@opencode/client"
import type { TodoItem } from "./todo.ts"

type TodoList = (
  input: { sessionID: string },
  options: { location: LocationRef },
) => Promise<{ todos: TodoItem[] }>

/** Reads the viewed session's todos from the plugin instance at that session's full location. */
export async function loadSessionTodos(list: TodoList, sessionID: string, location: LocationRef): Promise<TodoItem[]> {
  const result = await list({ sessionID }, { location })
  return result.todos
}
