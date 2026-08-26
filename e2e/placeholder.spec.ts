import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("presents the honest Mapachess pre-production status", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page).toHaveTitle("Mapachess — In Development")
  await expect(
    page.getByRole("heading", { level: 1, name: "Mapachess" }),
  ).toBeVisible()
  await expect(page.getByText("Pre-production", { exact: true })).toBeVisible()
  await expect(
    page.getByText(
      "No playable public build yet. Mapachess is in development.",
      { exact: true },
    ),
  ).toBeVisible()
})

test("loads the app icon without browser console errors", async ({
  page,
  request,
}) => {
  const browserConsoleErrors: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error") browserConsoleErrors.push(message.text())
  })

  await page.goto("/")
  await page.waitForLoadState("networkidle")

  const iconHref = await page
    .locator('link[rel="icon"]')
    .first()
    .getAttribute("href")

  expect(iconHref).not.toBeNull()

  if (!iconHref) throw new Error("Mapachess did not publish an app icon.")

  const iconResponse = await request.get(new URL(iconHref, page.url()).href)

  expect(iconResponse.ok()).toBe(true)
  expect(browserConsoleErrors).toEqual([])
})

test("has no serious or critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/")

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
  const highImpactViolations = accessibilityScanResults.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  )

  expect(highImpactViolations).toEqual([])
})
