import { describe, expect, test } from "bun:test"
import { MAX_CONTENT_LENGTH, MAX_TODOS, describeValidationError, formatTodos, validateTodos } from "../src/todo.ts"
import type { TodoItem } from "../src/todo.ts"

describe("validateTodos", () => {
  test("accepts a valid item", () => {
    const result = validateTodos([{ content: "Write tests", status: "in_progress" }])
    expect(result).toEqual({ ok: true, todos: [{ content: "Write tests", status: "in_progress" }] })
  })

  test("accepts every status and preserves order", () => {
    const todos: TodoItem[] = [
      { content: "C", status: "not_started" },
      { content: "A", status: "completed" },
      { content: "B", status: "in_progress" },
    ]
    expect(validateTodos(todos)).toEqual({ ok: true, todos })
  })

  test("accepts an empty list", () => {
    expect(validateTodos([])).toEqual({ ok: true, todos: [] })
  })

  test("trims content", () => {
    const result = validateTodos([{ content: "  padded  ", status: "not_started" }])
    expect(result).toEqual({ ok: true, todos: [{ content: "padded", status: "not_started" }] })
  })

  test("rejects an unknown status with the index and allowed statuses", () => {
    const result = validateTodos([
      { content: "ok", status: "completed" },
      { content: "ok", status: "completed" },
      { content: "bad", status: "done" },
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.index).toBe(2)
    expect(describeValidationError(result.error)).toBe(
      "Invalid todo at index 2: status must be one of not_started, in_progress, completed",
    )
  })

  test.each(["", "   ", "\n\t"])("rejects blank content %p", (content) => {
    const result = validateTodos([{ content, status: "not_started" }])
    expect(result).toEqual({ ok: false, error: { index: 0, reason: "content must not be empty" } })
  })

  test("rejects non-string content and non-object items", () => {
    expect(validateTodos([{ content: 1, status: "not_started" }]).ok).toBe(false)
    expect(validateTodos(["string"]).ok).toBe(false)
    expect(validateTodos("nope").ok).toBe(false)
  })

  test("accepts exactly the limits", () => {
    const todos = Array.from({ length: MAX_TODOS }, () => ({
      content: "x".repeat(MAX_CONTENT_LENGTH),
      status: "not_started",
    }))
    expect(validateTodos(todos).ok).toBe(true)
  })

  test("rejects more than 100 items", () => {
    const todos = Array.from({ length: MAX_TODOS + 1 }, () => ({ content: "x", status: "not_started" }))
    const result = validateTodos(todos)
    expect(result.ok).toBe(false)
  })

  test("rejects content longer than 500 characters after trimming", () => {
    const result = validateTodos([{ content: ` ${"x".repeat(MAX_CONTENT_LENGTH + 1)} `, status: "not_started" }])
    expect(result).toEqual({ ok: false, error: { index: 0, reason: "content must be at most 500 characters" } })
  })
})

describe("formatTodos", () => {
  test("lists items in order with statuses and counts", () => {
    expect(
      formatTodos([
        { content: "A", status: "completed" },
        { content: "B", status: "in_progress" },
        { content: "C", status: "not_started" },
      ]),
    ).toBe(["[x] A", "[>] B", "[ ] C", "1 completed, 1 in progress, 1 not started"].join("\n"))
  })

  test("reports an empty list", () => {
    expect(formatTodos([])).toBe("No todos.")
  })
})
