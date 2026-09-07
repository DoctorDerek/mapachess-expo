import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const modeNames = [
  "Standard Story",
  "Standard Challenge",
  "Chess960 Story",
  "Chess960 Challenge",
] as const

const expectModeMenu = async (page: Page): Promise<void> => {
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Choose your game",
      exact: true,
    }),
  ).toBeVisible()
  for (const name of modeNames) {
    await expect(page.getByRole("button", { name, exact: true })).toBeEnabled()
  }
}

test("offers four direct modes with Challenge controls and saved hint preferences", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page).toHaveTitle("Mapachess")
  await expectModeMenu(page)
  for (const name of modeNames) {
    await page.getByRole("button", { name, exact: true }).click()
    await expect(
      page.getByRole("heading", { level: 1, name, exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Start match", exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole("radio", { name: "Auto Move Hints", exact: true }),
    ).toBeChecked()
    if (name.endsWith("Challenge")) {
      await expect(
        page.getByRole("radio", { name: "White", exact: true }),
      ).toBeChecked()
      await page.getByRole("radio", { name: "Black", exact: true }).check()
      await expect(
        page.getByRole("radio", { name: "Black", exact: true }),
      ).toBeChecked()
    }
    if (name === "Chess960 Challenge") {
      await expect(
        page.getByRole("radio", { name: "Random position", exact: true }),
      ).toBeChecked()
      const position = page.getByRole("spinbutton", {
        name: "Position number (0–959)",
        exact: true,
      })
      await expect(position).toBeDisabled()
      await page
        .getByRole("radio", { name: "Choose a position number", exact: true })
        .check()
      await expect(position).toHaveValue("0")
      await position.fill("959")
      await expect(position).toHaveValue("959")
      await expect(position).toHaveAttribute("min", "0")
      await expect(position).toHaveAttribute("max", "959")
    }
    await page
      .getByRole("button", { name: "All game modes", exact: true })
      .click()
    await expectModeMenu(page)
  }

  await page
    .getByRole("button", { name: "Standard Story", exact: true })
    .click()
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).check()
  await expect(
    page.getByRole("button", { name: "Start match", exact: true }),
  ).toBeEnabled()
  await page.reload()
  await expectModeMenu(page)
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await expect(
    page.getByRole("radio", { name: "No Auto Hints", exact: true }),
  ).toBeChecked()
  await expect(
    page.getByText("Gold if you win without using any hints.", { exact: true }),
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
  await expectModeMenu(page)

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
  await expectModeMenu(page)
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

  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Chess960 Challenge", exact: true })
    .click()
  const setupResults = await new AxeBuilder({ page }).analyze()
  expect(
    setupResults.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([])
})
