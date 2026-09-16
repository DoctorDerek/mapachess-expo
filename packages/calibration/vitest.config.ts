import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "calibration",
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
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
