import { test as base } from "@playwright/test"
import createPreviewTest from "doctorderek-cicd/playwright"
import { isolateControllerInput } from "./controllerInput.js"
import startOrigin from "./offlineOrigin.js"

export const firstArrivalTest = createPreviewTest(base, {
  minimumValidityMs: 90_000,
}).extend<{ workerOrigin: string }>({
  workerOrigin: async ({ baseURL, request }, use) => {
    if (!baseURL) throw Error("Expected a web target")
    if (process.env.PLAYWRIGHT_VERCEL_TRUSTED_OIDC !== "true") {
      await use(baseURL)
      return
    }
    // Browsers do not attach Playwright's OIDC header when fetching a service worker.
    // The loopback origin uses the authenticated request fixture for this exact deployment.
    const origin = await startOrigin(baseURL, request)
    try {
      await use(origin.url)
    } finally {
      await origin.close()
    }
  },
  page: async ({ page }, use) => {
    await isolateControllerInput(page)
    await use(page)
  },
})

export const test = firstArrivalTest.extend({
  page: async ({ page }, use) => {
    const start = page.getByRole("button", { name: "Start", exact: true })
    await page.addLocatorHandler(start, () => start.click())
    await use(page)
  },
})
