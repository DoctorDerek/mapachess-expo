import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "evaluation",
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
    },
  },
})
