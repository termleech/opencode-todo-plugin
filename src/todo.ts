export const TODO_STATUSES = ["not_started", "in_progress", "completed"] as const

export type TodoStatus = (typeof TODO_STATUSES)[number]

export interface TodoItem {
  content: string
  status: TodoStatus
}

export const MAX_TODOS = 100
export const MAX_CONTENT_LENGTH = 500

export interface TodoValidationError {
  index: number | undefined
  reason: string
}

export type TodoValidationResult =
  | { ok: true; todos: TodoItem[] }
  | { ok: false; error: TodoValidationError }

const fail = (index: number | undefined, reason: string): TodoValidationResult => ({
  ok: false,
  error: { index, reason },
})

const isStatus = (value: unknown): value is TodoStatus =>
  typeof value === "string" && (TODO_STATUSES as readonly string[]).includes(value)

/** Validates an untrusted todo list and returns trimmed copies, or the first error found. */
export function validateTodos(input: unknown): TodoValidationResult {
  if (!Array.isArray(input)) return fail(undefined, "todos must be an array")
  if (input.length > MAX_TODOS) return fail(undefined, `todos must contain at most ${MAX_TODOS} items`)

  const todos: TodoItem[] = []
  for (const [index, item] of input.entries()) {
    if (typeof item !== "object" || item === null) return fail(index, "item must be an object")
    const { content, status } = item as Record<string, unknown>
    if (typeof content !== "string") return fail(index, "content must be a string")
    const trimmed = content.trim()
    if (trimmed.length === 0) return fail(index, "content must not be empty")
    if (trimmed.length > MAX_CONTENT_LENGTH)
      return fail(index, `content must be at most ${MAX_CONTENT_LENGTH} characters`)
    if (!isStatus(status)) return fail(index, `status must be one of ${TODO_STATUSES.join(", ")}`)
    todos.push({ content: trimmed, status })
  }
  return { ok: true, todos }
}

export function describeValidationError(error: TodoValidationError): string {
  return error.index === undefined ? `Invalid todos: ${error.reason}` : `Invalid todo at index ${error.index}: ${error.reason}`
}

const MARKERS: Record<TodoStatus, string> = {
  not_started: "[ ]",
  in_progress: "[>]",
  completed: "[x]",
}

const LABELS: Record<TodoStatus, string> = {
  completed: "completed",
  in_progress: "in progress",
  not_started: "not started",
}

export const marker = (status: TodoStatus) => MARKERS[status]

export function countTodos(todos: readonly TodoItem[]): Record<TodoStatus, number> {
  const counts: Record<TodoStatus, number> = { not_started: 0, in_progress: 0, completed: 0 }
  for (const todo of todos) counts[todo.status]++
  return counts
}

/** Renders a list as one `[marker] content` line per item followed by per-status counts. */
export function formatTodos(todos: readonly TodoItem[]): string {
  if (todos.length === 0) return "No todos."
  const counts = countTodos(todos)
  const lines = todos.map((todo) => `${MARKERS[todo.status]} ${todo.content}`)
  const summary = (["completed", "in_progress", "not_started"] as const)
    .map((status) => `${counts[status]} ${LABELS[status]}`)
    .join(", ")
  return [...lines, summary].join("\n")
}
