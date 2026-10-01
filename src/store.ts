import type { StorageDomain } from "@opencode/plugin/promise/storage"
import { validateTodos } from "./todo.ts"
import type { TodoItem } from "./todo.ts"

export type KeyValueStorage = Pick<StorageDomain, "get" | "set">

export interface StoredTodos {
  todos: TodoItem[]
  updatedAt: number
}

const keyFor = (sessionID: string) => `session/${sessionID}`

export interface TodoStore {
  load(sessionID: string): Promise<TodoItem[]>
  save(sessionID: string, todos: TodoItem[]): Promise<TodoItem[]>
}

/** Per-session todo persistence. Saves for one session run in call order. */
export function createTodoStore(storage: KeyValueStorage, now: () => number = Date.now): TodoStore {
  const queues = new Map<string, Promise<unknown>>()

  const enqueue = <T>(sessionID: string, work: () => Promise<T>): Promise<T> => {
    const previous = queues.get(sessionID) ?? Promise.resolve()
    const next = previous.then(work, work)
    const settled = next.catch(() => {})
    queues.set(sessionID, settled)
    void settled.then(() => {
      if (queues.get(sessionID) === settled) queues.delete(sessionID)
    })
    return next
  }

  const read = async (sessionID: string): Promise<TodoItem[]> => {
    const value = await storage.get(keyFor(sessionID))
    if (typeof value !== "object" || value === null || Array.isArray(value)) return []
    const result = validateTodos((value as Record<string, unknown>).todos)
    return result.ok ? result.todos : []
  }

  return {
    load: (sessionID) => enqueue(sessionID, () => read(sessionID)),
    save: (sessionID, todos) =>
      enqueue(sessionID, async () => {
        const record = { todos: todos.map((todo) => ({ ...todo })), updatedAt: now() } satisfies StoredTodos
        await storage.set(keyFor(sessionID), record)
        return record.todos
      }),
  }
}
