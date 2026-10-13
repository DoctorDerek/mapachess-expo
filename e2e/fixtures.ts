import { test as base } from "@playwright/test"
import createPreviewTest from "doctorderek-cicd/playwright"

export const firstArrivalTest = createPreviewTest(base, {
  minimumValidityMs: 90_000,
})

export const test = firstArrivalTest.extend({
  page: async ({ page }, use) => {
    const start = page.getByRole("button", { name: "Start", exact: true })
    await page.addLocatorHandler(start, () => start.click())
    await use(page)
  },
})
