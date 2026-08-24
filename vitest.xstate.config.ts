import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
    },
  },
  test: {
    include: ["__tests__/scripts/xstate-diff/**/*.test.ts"],
    coverage: {
      include: ["scripts/xstate-diff/**/*.ts"],
      exclude: ["scripts/xstate-diff/xstateDiff.cli.ts"],
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
})
