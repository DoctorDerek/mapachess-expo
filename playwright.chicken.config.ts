import { defineConfig, devices } from "@playwright/test"

const localChickenPlaywrightPort = 3108
const localChickenPlaywrightBaseUrl = `http://127.0.0.1:${localChickenPlaywrightPort}`

export default defineConfig({
  testDir: "./e2e-chicken",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: "list",
  use: {
    baseURL: localChickenPlaywrightBaseUrl,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm --filter @mapachess/web dev --hostname 127.0.0.1 --port ${localChickenPlaywrightPort}`,
    url: localChickenPlaywrightBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
