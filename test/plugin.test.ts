import { describe, expect, test } from "bun:test"
import plugin from "../src/index.ts"
import type { TodoItem } from "../src/todo.ts"

type Executor = (input: unknown, context: { sessionID: string }) => Promise<{ content?: unknown }>
type Handler = (input: unknown, context: unknown) => Promise<unknown>

async function load() {
  const data = new Map<string, unknown>()
  const tools = new Map<string, { execute: Executor; options?: unknown; input: unknown }>()
  const handlers: Record<string, Handler> = {}
  const events: { name: string; data: unknown }[] = []

  const ctx = {
    storage: {
      get: async (key: string) => data.get(key),
      set: async (key: string, value: unknown) => void data.set(key, value),
    },
    rpc: {
      register: async (_definition: unknown, registered: Record<string, Handler>) => {
        Object.assign(handlers, registered)
        return {
          dispose: async () => {},
          events: { emit: async (name: string, payload: unknown) => void events.push({ name, data: payload }) },
        }
      },
    },
    tool: {
      transform: async (callback: (editor: { add: (tool: any) => void }) => void) => {
        callback({ add: (tool) => tools.set(tool.name, tool) })
        return { dispose: async () => {} }
      },
    },
  }

  await plugin.setup(ctx as never)

  const call = (name: string, sessionID: string, input: unknown = {}) =>
    tools.get(name)!.execute(input, { sessionID })
  const write = (sessionID: string, todos: unknown) => call("todowrite", sessionID, { todos })
  const read = (sessionID: string) => call("todoread", sessionID)
  const list = async (sessionID: string) =>
    ((await handlers.list!({ sessionID }, {})) as { todos: TodoItem[] }).todos

  return { tools, events, write, read, list }
}

const a: TodoItem = { content: "A", status: "in_progress" }
const b: TodoItem = { content: "B", status: "not_started" }
const c: TodoItem = { content: "C", status: "not_started" }

describe("todo plugin", () => {
  test("registers direct (non Code Mode) todowrite and todoread tools", async () => {
    const { tools } = await load()
    expect([...tools.keys()].sort()).toEqual(["todoread", "todowrite"])
    for (const tool of tools.values()) expect(tool.options).toEqual({ codemode: false })
  })

  test("first write stores the list in order and reports it", async () => {
    const { write, list } = await load()
    const result = await write("ses_1", [a, b, c])
    expect(await list("ses_1")).toEqual([a, b, c])
    expect(result.content).toBe("[>] A\n[ ] B\n[ ] C\n0 completed, 1 in progress, 2 not started")
  })

  test("rewrite updates statuses and order", async () => {
    const { write, list } = await load()
    await write("ses_1", [a, b])
    await write("ses_1", [
      { content: "B", status: "in_progress" },
      { content: "A", status: "completed" },
    ])
    expect(await list("ses_1")).toEqual([
      { content: "B", status: "in_progress" },
      { content: "A", status: "completed" },
    ])
  })

  test("empty list clears", async () => {
    const { write, read, list } = await load()
    await write("ses_1", [a])
    await write("ses_1", [])
    expect(await list("ses_1")).toEqual([])
    expect((await read("ses_1")).content).toBe("No todos.")
  })

  test("invalid write errors with the index, leaves the list unchanged, and emits nothing", async () => {
    const { write, list, events } = await load()
    await write("ses_1", [a])
    events.length = 0
    await expect(write("ses_1", [a, b, { content: "bad", status: "blocked" }])).rejects.toMatchObject({
      message: "Invalid todo at index 2: status must be one of not_started, in_progress, completed",
    })
    expect(await list("ses_1")).toEqual([a])
    expect(events).toEqual([])
  })

  test("successful write emits updated with the session and full list", async () => {
    const { write, events } = await load()
    await write("ses_1", [a, b])
    expect(events).toEqual([{ name: "updated", data: { sessionID: "ses_1", todos: [a, b] } }])
  })

  test("todoread returns the calling session's list", async () => {
    const { write, read } = await load()
    await write("ses_1", [a, b])
    expect((await read("ses_1")).content).toBe("[>] A\n[ ] B\n0 completed, 1 in progress, 1 not started")
    expect((await read("ses_2")).content).toBe("No todos.")
  })

  test("child sessions are separate from their parent", async () => {
    const { write, list } = await load()
    await write("ses_parent", [a])
    await write("ses_child", [b])
    expect(await list("ses_parent")).toEqual([a])
    expect(await list("ses_child")).toEqual([b])
  })

  test("RPC list returns an empty list for an unknown session", async () => {
    const { list } = await load()
    expect(await list("ses_unknown")).toEqual([])
  })
})
