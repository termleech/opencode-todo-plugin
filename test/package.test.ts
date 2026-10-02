import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"

const root = new URL("..", import.meta.url).pathname

describe("published package entrypoints", () => {
  // OpenCode skips its Solid JSX transform for files under node_modules, so an installed
  // TUI entrypoint must already be Solid-compiled or the sidebar never reacts to data.
  test("the TUI export is precompiled Solid output, not JSX source", async () => {
    const build = Bun.spawnSync(["bun", "scripts/build.ts"], { cwd: root, stderr: "pipe" })
    expect(build.stderr.toString()).toBe("")
    expect(build.exitCode).toBe(0)

    const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"))
    expect(pkg.exports["./tui"]).toBe("./dist/tui.js")
    expect(pkg.files).toContain("dist")
    expect(pkg.scripts.prepack).toBe("bun run build")

    const output = readFileSync(`${root}dist/tui.js`, "utf8")
    expect(output).not.toMatch(/jsx-(dev-)?runtime|jsxDEV/)
    expect(output).toMatch(/from "@opentui\/solid"/)
    expect(output).toMatch(/\b(createComponent|insert)\b/)
  })
})
