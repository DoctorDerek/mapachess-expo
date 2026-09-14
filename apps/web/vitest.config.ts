import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    name: "web",
    environment: "node",
    include: ["components/**/*.test.tsx", "lib/**/*.test.ts"],
    coverage: {
      reportOnFailure: true,
      provider: "v8",
      reporter: [
        "text",
        ["lcov", { projectRoot: resolve(import.meta.dirname, "../..") }],
      ],
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts"],
    },
  },
})
