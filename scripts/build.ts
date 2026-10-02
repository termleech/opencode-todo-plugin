// OpenCode only runs Solid's JSX compiler on files outside node_modules, so the published
// TUI entrypoint must be precompiled or its JSX is not reactive once installed.
import solidPlugin from "@opentui/solid/bun-plugin"

const result = await Bun.build({
  entrypoints: ["src/tui.tsx"],
  outdir: "dist",
  target: "bun",
  format: "esm",
  plugins: [solidPlugin],
  external: ["@opencode/*", "@opentui/*", "solid-js", "solid-js/*"],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
