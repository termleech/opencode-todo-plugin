import { describe, expect, test } from "bun:test"
import { createTodoStore } from "../src/store.ts"
import type { KeyValueStorage } from "../src/store.ts"
import type { TodoItem } from "../src/todo.ts"

type Json = Parameters<KeyValueStorage["set"]>[1]

function memoryStorage(options: { setDelay?: (value: unknown) => number } = {}) {
  const data = new Map<string, unknown>()
  const storage: KeyValueStorage = {
    get: async (key) => data.get(key) as Json | undefined,
    set: async (key, value) => {
      const delay = options.setDelay?.(value) ?? 0
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
      data.set(key, value)
    },
  }
  return { data, storage }
}

const a: TodoItem = { content: "A", status: "in_progress" }
const b: TodoItem = { content: "B", status: "not_started" }

describe("createTodoStore", () => {
  test("missing key loads as an empty list", async () => {
    const store = createTodoStore(memoryStorage().storage)
    expect(await store.load("ses_missing")).toEqual([])
  })

  test("saves under session/<id> with a timestamp and loads it back", async () => {
    const { data, storage } = memoryStorage()
    const store = createTodoStore(storage, () => 42)
    await store.save("ses_1", [a, b])
    expect(data.get("session/ses_1")).toEqual({ todos: [a, b], updatedAt: 42 })
    expect(await store.load("ses_1")).toEqual([a, b])
  })

  test("sessions are isolated", async () => {
    const store = createTodoStore(memoryStorage().storage)
    await store.save("ses_1", [a])
    expect(await store.load("ses_2")).toEqual([])
  })

  test("clearing persists an empty list rather than removing the key", async () => {
    const { data, storage } = memoryStorage()
    const store = createTodoStore(storage, () => 7)
    await store.save("ses_1", [a])
    await store.save("ses_1", [])
    expect(data.get("session/ses_1")).toEqual({ todos: [], updatedAt: 7 })
    expect(await store.load("ses_1")).toEqual([])
  })

  test("concurrent saves for one session apply in call order", async () => {
    // The first save is slower than the second; without queueing the first would land last.
    const { storage } = memoryStorage({
      setDelay: (value) => ((value as { todos: TodoItem[] }).todos.length === 1 ? 20 : 0),
    })
    const store = createTodoStore(storage)
    await Promise.all([store.save("ses_1", [a]), store.save("ses_1", [a, b])])
    expect(await store.load("ses_1")).toEqual([a, b])
  })

  test("a failed save does not block later saves", async () => {
    let fail = true
    const { storage } = memoryStorage()
    const flaky: KeyValueStorage = {
      get: storage.get,
      set: async (key, value) => {
        if (fail) {
          fail = false
          throw new Error("disk full")
        }
        await storage.set(key, value)
      },
    }
    const store = createTodoStore(flaky)
    await expect(store.save("ses_1", [a])).rejects.toThrow("disk full")
    await store.save("ses_1", [b])
    expect(await store.load("ses_1")).toEqual([b])
  })

  test("corrupt stored data loads as an empty list", async () => {
    const { data, storage } = memoryStorage()
    data.set("session/ses_1", { todos: [{ content: "", status: "nope" }], updatedAt: 1 })
    const store = createTodoStore(storage)
    expect(await store.load("ses_1")).toEqual([])
  })
})
