import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname) },
    dedupe: ["react", "react-dom"],
  },
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    name: "web",
    environment: "node",
    maxWorkers: 2,
    setupFiles: ["../../packages/localization/test/catalogHealth.setup.ts"],
    include: [
      "components/**/*.test.tsx",
      "lib/**/*.test.ts",
      "app/**/*.test.ts",
    ],
    coverage: {
      reportOnFailure: true,
      provider: "v8",
      allowExternal: true,
      reporter: [
        "text",
        ["lcov", { projectRoot: resolve(import.meta.dirname, "../..") }],
      ],
      include: [
        "lib/**/*.ts",
        "components/**/*.tsx",
        "app/**/*.{ts,tsx}",
        "**/packages/{application-ui,diagnostics,evaluation,gameplay,hints,match,match-presentation,profile,stockfish}/dist/**/*.js",
      ],
      exclude: ["**/*.test.{ts,tsx}"],
    },
  },
})
