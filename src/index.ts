import { Plugin } from "@opencode/plugin"
import { Error as ToolError } from "@opencode/plugin/promise/tool"
import { Todo, todoItemSchema } from "./rpc.ts"
import { createTodoStore } from "./store.ts"
import { MAX_CONTENT_LENGTH, MAX_TODOS, describeValidationError, formatTodos, validateTodos } from "./todo.ts"

const TODOWRITE_DESCRIPTION = `Create and maintain an ordered todo list for the current session. Use it to plan and track multi-step work so you and the user can see progress.

Each call REPLACES the whole list: always send every item, in the order they should be done, with its current status.

Statuses:
- not_started: not begun yet
- in_progress: being worked on right now
- completed: finished

When to use:
- The task needs three or more distinct steps, or is non-trivial and benefits from planning
- The user gives you a list of things to do, or explicitly asks for a todo list
- New requirements come up mid-task (add them to the list)

When not to use:
- A single, straightforward step, or a purely conversational request

How to use:
- Write the list before starting work
- Mark an item in_progress before you begin it, and keep only one item in_progress at a time
- Mark an item completed as soon as it is done; do not batch completions
- Only mark an item completed when it is fully done; if blocked, keep it in_progress and add an item for the blocker
- Remove items that are no longer relevant
- Send an empty list to clear it

Limits: at most ${MAX_TODOS} items, ${MAX_CONTENT_LENGTH} characters per item.`

const TODOREAD_DESCRIPTION = `Read the current session's todo list, in order, with each item's status (not_started, in_progress, completed). Use it to check progress before deciding what to do next.`

export default Plugin.define({
  id: "todo",
  async setup(ctx) {
    const store = createTodoStore(ctx.storage)

    const rpc = await ctx.rpc.register(Todo, {
      list: async (input) => {
        const { sessionID } = input as { sessionID: string }
        return { todos: await store.load(sessionID) }
      },
    })

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "todowrite",
        description: TODOWRITE_DESCRIPTION,
        input: {
          type: "object",
          properties: {
            todos: {
              type: "array",
              description: "The complete, ordered todo list",
              items: todoItemSchema,
            },
          },
          required: ["todos"],
          additionalProperties: false,
        },
        options: { codemode: false },
        execute: async (input, context) => {
          const result = validateTodos((input as { todos?: unknown } | undefined)?.todos)
          if (!result.ok) throw new ToolError({ message: describeValidationError(result.error) })
          const todos = await store.save(context.sessionID, result.todos)
          // The list is saved; a failed notification must not turn the write into an error.
          await rpc.events.emit("updated", { sessionID: context.sessionID, todos }).catch((error) => {
            console.error("todo: failed to emit updated event", error)
          })
          return { content: formatTodos(todos) }
        },
      })

      editor.add({
        name: "todoread",
        description: TODOREAD_DESCRIPTION,
        input: { type: "object", properties: {}, additionalProperties: false },
        options: { codemode: false },
        execute: async (_input, context) => ({ content: formatTodos(await store.load(context.sessionID)) }),
      })
    })
  },
})
