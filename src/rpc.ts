// Type-only import: the TUI runtime resolves @opencode/plugin/tui but not other @opencode/plugin subpaths.
import type { Rpc } from "@opencode/plugin/rpc"
import { TODO_STATUSES } from "./todo.ts"

export const todoItemSchema = {
  type: "object",
  properties: {
    content: { type: "string" },
    status: { type: "string", enum: [...TODO_STATUSES] },
  },
  required: ["content", "status"],
  additionalProperties: false,
} as const

const todoListSchema = { type: "array", items: todoItemSchema } as const

export const Todo = {
  id: "todo",
  methods: {
    list: {
      input: {
        type: "object",
        properties: { sessionID: { type: "string" } },
        required: ["sessionID"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: { todos: todoListSchema },
        required: ["todos"],
        additionalProperties: false,
      },
    },
  },
  events: {
    updated: {
      schema: {
        type: "object",
        properties: { sessionID: { type: "string" }, todos: todoListSchema },
        required: ["sessionID", "todos"],
        additionalProperties: false,
      },
    },
  },
} as const satisfies Rpc.PortableDefinition
