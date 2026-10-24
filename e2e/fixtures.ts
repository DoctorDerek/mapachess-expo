import { test as base } from "@playwright/test"
import createPreviewTest from "doctorderek-cicd/playwright"
import { isolateControllerInput } from "./controllerInput.js"

export const firstArrivalTest = createPreviewTest(base, {
  minimumValidityMs: 90_000,
}).extend({
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
