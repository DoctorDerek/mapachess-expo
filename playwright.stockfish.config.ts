import { defineConfig, devices } from "@playwright/test"

const localStockfishPlaywrightPort = 3107
const localStockfishPlaywrightBaseUrl = `http://127.0.0.1:${localStockfishPlaywrightPort}`

export default defineConfig({
  testDir: "./e2e-stockfish",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: "list",
  use: {
    baseURL: localStockfishPlaywrightBaseUrl,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command:
      "pnpm --filter @mapachess/web exec vite --config vite.stockfish.config.ts",
    url: localStockfishPlaywrightBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
