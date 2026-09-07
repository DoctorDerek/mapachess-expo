import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const expectStoryMenu = async (page: Page): Promise<void> => {
  await expect(
    page.getByRole("heading", { level: 1, name: "Story", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Play Chicken Stockfish", exact: true }),
  ).toBeVisible()
}

test("shows the current Story menu through the ordinary application route", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page).toHaveTitle("Mapachess")
  await expectStoryMenu(page)
  const variant = page.getByRole("combobox", { name: "Variant", exact: true })
  await expect(variant).toHaveValue("standard")
  await variant.selectOption("chess960")
  await expect(variant).toHaveValue("chess960")
  await expect(page.getByText("Story opponent 1 of 23")).toBeVisible()
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
  await expectStoryMenu(page)

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
  await expectStoryMenu(page)
  const menuResults = await new AxeBuilder({ page }).analyze()
  const menuViolations = menuResults.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  )

  expect(menuViolations).toEqual([])

  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Settings & Player Data",
      exact: true,
    }),
  ).toBeVisible()
  const settingsResults = await new AxeBuilder({ page }).analyze()
  const settingsViolations = settingsResults.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  )
  expect(settingsViolations).toEqual([])
})
