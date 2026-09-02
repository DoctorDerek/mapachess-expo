import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("enters Standard Story through the ordinary application route", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page).toHaveTitle("Mapachess")
  await expect(
    page.getByRole("heading", { level: 1, name: "Start with Auto-Hints?" }),
  ).toBeVisible()
  await expect(page.getByText("Before your first game")).toBeVisible()
  await page.getByRole("button", { name: "Turn Auto-Hints Off" }).click()

  await expect(
    page.getByRole("heading", { level: 1, name: "Standard Story" }),
  ).toBeVisible()
  await expect(page.getByText("Story opponent 1 of 23")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Play Chicken Stockfish" }),
  ).toBeVisible()
})

test("does not retain the former private playtest route", async ({ page }) => {
  const response = await page.goto("/playtest")

  expect(response?.status()).toBe(404)
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

  const firstRunResults = await new AxeBuilder({ page }).analyze()
  const firstRunViolations = firstRunResults.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  )
  expect(firstRunViolations).toEqual([])

  await page.getByRole("button", { name: "Turn Auto-Hints Off" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Standard Story" }),
  ).toBeVisible()
  const menuResults = await new AxeBuilder({ page }).analyze()
  const menuViolations = menuResults.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  )

  expect(menuViolations).toEqual([])
})
