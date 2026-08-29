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
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts"],
    },
  },
})
