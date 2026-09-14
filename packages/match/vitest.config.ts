import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "match",
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      reportOnFailure: true,
      provider: "v8",
      reporter: [
        "text",
        ["lcov", { projectRoot: resolve(import.meta.dirname, "../..") }],
      ],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
    },
  },
})
