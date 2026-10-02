import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import * as ts from "typescript"

describe("published package entrypoints", () => {
  test("the TUI selects OpenTUI's JSX runtime without the workspace tsconfig", () => {
    const source = readFileSync(new URL("../src/tui.tsx", import.meta.url), "utf8")
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    })

    expect(outputText).toContain('"@opentui/solid/jsx-runtime"')
    expect(outputText).not.toContain('"react/jsx-runtime"')
  })
})
