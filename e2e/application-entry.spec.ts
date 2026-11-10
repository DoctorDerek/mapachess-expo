import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"
import { test } from "./fixtures.js"
import challengeHistoryBackup from "./fixtures/challenge-history.json" with { type: "json" }

const modeNames = [
  "Standard Chess Story",
  "Standard Chess Challenge",
  "Chess960 Story",
  "Chess960 Challenge",
] as const

test("retains nested Credits Back and Forward after reloading Settings", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  const credits = page.getByRole("dialog", { name: "Credits", exact: true })
  await page.getByRole("button", { name: "Credits", exact: true }).click()
  await expect(credits).toBeVisible()
  await page.reload()
  await expect(credits).toBeVisible()
  await page
    .getByRole("button", { name: "Back to Settings", exact: true })
    .click()
  await expect(credits).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Close Settings", exact: true }),
  ).toBeVisible()
  await page.goForward()
  await expect(credits).toBeVisible()
  await page.goBack()
  await expect(credits).toHaveCount(0)
  await page.goBack()
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible()
})

test("retains save recovery while retrying and restores settings after success", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    let writes = 0
    IDBObjectStore.prototype.put = function (value, key) {
      if (++writes === 2) {
        IDBObjectStore.prototype.put = put
        throw new DOMException("Test storage failure", "QuotaExceededError")
      }
      return put.call(this, value, key)
    }
  })
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).click()
  const retry = page.getByRole("button", { name: "Retry save", exact: true })
  await expect(retry).toBeVisible()
  const button = await retry.elementHandle()
  if (button === null) throw new Error("Retry button must exist")
  await retry.scrollIntoViewIfNeeded()
  await page.mouse.move(0, 0)
  await expect(retry).toHaveCSS("translate", "none")
  const before = await retry.boundingBox()
  await page.evaluate(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    crypto.subtle.digest = async (algorithm, data) => {
      await new Promise<void>((resolve) =>
        window.addEventListener("release-save-retry", () => resolve(), {
          once: true,
        }),
      )
      return digest(algorithm, data)
    }
    window.addEventListener(
      "release-save-retry",
      () => {
        crypto.subtle.digest = digest
      },
      { once: true },
    )
  })
  await retry.click()
  await expect.poll(() => button.innerText()).toBe("Retrying save…")
  expect(await button.isDisabled()).toBe(true)
  await expect.poll(() => button.boundingBox()).toEqual(before)
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "This change is not saved yet. Choose Retry save to try again. Further changes are paused until saving succeeds.",
    }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: "Export Pending Player Data",
      exact: true,
    }),
  ).toBeVisible()
  await page.evaluate(() =>
    window.dispatchEvent(new Event("release-save-retry")),
  )
  await expect(
    page.getByRole("button", { name: "Close Settings", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("radio", { name: "No Auto Hints", exact: true }),
  ).toBeChecked()
  await page.reload()
  await expect(
    page.getByRole("button", { name: "Close Settings", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("radio", { name: "No Auto Hints", exact: true }),
  ).toBeChecked()
  expect(errors).toEqual([])
})

test("backup failures release their controls for another attempt", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.evaluate(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    crypto.subtle.digest = async () => {
      crypto.subtle.digest = digest
      throw new Error("Test export failure")
    }
    const read = File.prototype.text
    File.prototype.text = async function () {
      File.prototype.text = read
      throw new Error("Test read failure")
    }
  })
  const exportButton = page.getByRole("button", {
    name: "Export Player Data",
    exact: true,
  })
  await exportButton.click()
  await expect(
    page.getByText("The download could not be created.", { exact: false }),
  ).toBeVisible()
  await expect(exportButton).toBeEnabled()
  const download = page.waitForEvent("download")
  await exportButton.click()
  await download
  const file = {
    name: "history.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(challengeHistoryBackup)),
  }
  await page.locator('input[type="file"]').setInputFiles(file)
  await expect(
    page.getByText("That file could not be read.", { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Import Backup", exact: true }),
  ).toBeEnabled()
  await page.locator('input[type="file"]').setInputFiles(file)
  await expect(
    page.getByRole("button", { name: "Cancel Import", exact: true }),
  ).toBeVisible()
})

test("guards backup preparation and file reading while keeping their buttons stable", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle)
    crypto.subtle.digest = async (algorithm, data) => {
      await new Promise<void>((resolve) =>
        window.addEventListener("release-backup-export", () => resolve(), {
          once: true,
        }),
      )
      return original(algorithm, data)
    }
    window.addEventListener(
      "release-backup-export",
      () => {
        crypto.subtle.digest = original
      },
      { once: true },
    )
  })
  const downloads: string[] = []
  page.on("download", (download) =>
    downloads.push(download.suggestedFilename()),
  )
  const exportButton = page.getByRole("button", {
    name: "Export Player Data",
    exact: true,
  })
  await exportButton.scrollIntoViewIfNeeded()
  const exportBox = await exportButton.boundingBox()
  await exportButton.evaluate((button) => {
    button.click()
    button.click()
  })
  const preparing = page.getByRole("button", {
    name: "Preparing backup…",
    exact: true,
  })
  await expect(preparing).toBeDisabled()
  expect(await preparing.boundingBox()).toEqual(exportBox)
  const download = page.waitForEvent("download")
  await page.evaluate(() =>
    window.dispatchEvent(new Event("release-backup-export")),
  )
  await download
  await expect(exportButton).toBeEnabled()
  expect(downloads).toHaveLength(1)

  await page.evaluate(() => {
    const original = File.prototype.text
    File.prototype.text = async function () {
      await new Promise<void>((resolve) =>
        window.addEventListener("release-backup-read", () => resolve(), {
          once: true,
        }),
      )
      return original.call(this)
    }
    window.addEventListener(
      "release-backup-read",
      () => {
        File.prototype.text = original
      },
      { once: true },
    )
  })
  const importButton = page.getByRole("button", {
    name: "Import Backup",
    exact: true,
  })
  await importButton.scrollIntoViewIfNeeded()
  const importBox = await importButton.boundingBox()
  await page.locator('input[type="file"]').setInputFiles({
    name: "history.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(challengeHistoryBackup)),
  })
  const reading = page.getByRole("button", {
    name: "Reading backup…",
    exact: true,
  })
  await expect(reading).toBeDisabled()
  expect(await reading.boundingBox()).toEqual(importBox)
  await expect(page.locator('input[type="file"]')).toBeDisabled()
  await page.evaluate(() =>
    window.dispatchEvent(new Event("release-backup-read")),
  )
  await expect(
    page.getByRole("button", { name: "Cancel Import", exact: true }),
  ).toBeVisible()
})

test("retains setup and button geometry while match opening is pending", async ({
  page,
}) => {
  const release = Promise.withResolvers<void>()
  await page.route("**/stockfish-runtime/**", async (route) => {
    await release.promise
    await route.abort()
  })
  try {
    await page.goto("/")
    await page
      .getByRole("button", { name: "Standard Chess Challenge", exact: true })
      .click()
    const start = await page
      .getByRole("button", { name: "Start match", exact: true })
      .elementHandle()
    if (start === null) throw new Error("Start button must exist")
    await start.scrollIntoViewIfNeeded()
    const before = await start.boundingBox()
    if (before === null) throw new Error("Start button must be visible")
    await start.click()
    await expect.poll(() => start.innerText()).toBe("Opening match…")
    await expect.poll(() => start.getAttribute("aria-busy")).toBe("true")
    expect(await start.isDisabled()).toBe(true)
    await expect
      .poll(() => start.boundingBox())
      .toEqual({
        x: expect.closeTo(before.x, 2),
        y: expect.closeTo(before.y, 2),
        width: expect.closeTo(before.width, 2),
        height: expect.closeTo(before.height, 2),
      })
    await expect(page.locator("#match-setup-title")).toBeVisible()
  } finally {
    release.resolve()
  }
})

const expectModeMenu = async (page: Page): Promise<void> => {
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Mapachess",
      exact: true,
    }),
  ).toBeVisible()
  for (const name of modeNames) {
    await expect(page.getByRole("button", { name, exact: true })).toBeEnabled()
  }
}

test("offers four direct modes with Challenge controls and saved hint preferences", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(60000)
  await page.goto("/?source=canonical-check")

  await expect(page).toHaveTitle(
    "Mapachess | Free Chess vs. Stockfish With Better Hints",
  )
  await expect(page).toHaveURL(
    new URL("/?source=canonical-check", baseURL).href,
  )
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://mapachess.com",
  )
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://mapachess.com",
  )
  await expectModeMenu(page)
  for (const name of modeNames) {
    await page.getByRole("button", { name, exact: true }).click()
    await expect(
      page.getByRole("heading", { level: 1, name, exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Start match", exact: true }),
    ).toBeEnabled()
    await page.getByRole("button", { name: /Change hints/ }).click()
    await expect(
      page.getByRole("radio", { name: "Auto Move Hints", exact: true }),
    ).toBeChecked()
    await page.getByRole("button", { name: "Done", exact: true }).click()
    if (name.endsWith("Challenge")) {
      const exact = page.getByRole("textbox", {
        name: "Opponent Elo",
        exact: true,
      })
      const range = page.getByRole("slider", { name: "Adjust opponent Elo" })
      await expect(exact).toHaveValue("100")
      await range.press("ArrowRight")
      await expect(exact).toHaveValue("125")
      await exact.fill("1012")
      await exact.press("Enter")
      await expect(
        page.getByText("Enter 100–2350 Elo in steps of 25.", { exact: true }),
      ).toBeVisible()
      await expect(range).toHaveValue("125")
      await page
        .getByRole("button", { name: "Start match", exact: true })
        .click()
      await expect(exact).toBeFocused()
      await expect(exact).toHaveValue("1012")
      await exact.fill("2350")
      await exact.press("Enter")
      await expect(range).toHaveValue("2350")
      await range.press("Home")
      await range.press("ArrowRight")
      await expect(exact).toHaveValue("125")
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await page.getByRole("button", { name: /Change animal/ }).click()
      await expect(
        page.getByRole("radio", { name: "Chicken Stockfish", exact: true }),
      ).toBeChecked()
      await page.keyboard.press("Escape")
      await expect(
        page.getByRole("button", { name: /Change animal/ }),
      ).toBeFocused()
      await expect(
        page.getByRole("radio", { name: "White", exact: true }),
      ).toBeChecked()
      await page.getByRole("radio", { name: "Black", exact: true }).check()
      await expect(
        page.getByRole("radio", { name: "Black", exact: true }),
      ).toBeChecked()
    }
    if (name === "Chess960 Challenge") {
      const position = page.getByRole("spinbutton", {
        name: "Position number (0–959)",
        exact: true,
      })
      await expect(position).toBeEnabled()
      const initialNumber = Number(await position.inputValue())
      expect(initialNumber).toBeGreaterThanOrEqual(0)
      expect(initialNumber).toBeLessThanOrEqual(959)
      await position.fill("959")
      await expect(position).toHaveValue("959")
      await page.getByRole("radio", { name: "Random", exact: true }).check()
      await page.getByRole("button", { name: /Change hints/ }).click()
      await page
        .getByRole("radio", { name: "No Auto Hints", exact: true })
        .check()
      await page.getByRole("button", { name: "Done", exact: true }).click()
      await expect(position).toHaveValue("959")
      await expect(
        page.getByText(
          "This position is remembered until you choose Randomize.",
          { exact: true },
        ),
      ).toBeVisible()
      await page.getByRole("button", { name: "Randomize", exact: true }).click()
      await expect(
        page.getByText(
          "Each new setup gets a random position number. Start match uses the number shown.",
          { exact: true },
        ),
      ).toBeVisible()
      await expect(
        page.getByRole("radio", { name: "Random", exact: true }),
      ).toBeChecked()
      await expect(position).toHaveAttribute("min", "0")
      await expect(position).toHaveAttribute("max", "959")
    }
    await page
      .getByRole("button", { name: "All game modes", exact: true })
      .click()
    await expectModeMenu(page)
  }

  await page
    .getByRole("button", { name: "Standard Chess Story", exact: true })
    .click()
  await page.getByRole("button", { name: /Change hints/ }).click()
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).check()
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await expect(
    page.getByRole("dialog", { name: "Better Hints", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Start match", exact: true }),
  ).toBeEnabled()
  await page.reload()
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Standard Chess Story",
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Start match", exact: true }),
  ).toBeEnabled()
  await page
    .getByRole("button", { name: "All game modes", exact: true })
    .click()
  await expectModeMenu(page)
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await expect(
    page.getByRole("radio", { name: "No Auto Hints", exact: true }),
  ).toBeChecked()
  await expect(
    page.getByText(/Gold if you win without using any hints\.$/),
  ).toBeVisible()
})

test("does not retain the former private playtest route", async ({ page }) => {
  const response = await page.goto("/playtest")

  expect(response?.status()).toBe(404)
})

test("shows imported Challenge history inline at the selected Elo", async ({
  page,
}) => {
  const backup = JSON.stringify(challengeHistoryBackup)
  await page.goto("/")
  await expectModeMenu(page)
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: "challenge-history.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  })
  await page
    .getByRole("button", { name: "Replace Local Player Data", exact: true })
    .click()
  await expectModeMenu(page)
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()

  const exact = page.getByRole("textbox", { name: "Opponent Elo", exact: true })
  const slider = page.getByRole("slider", { name: "Adjust opponent Elo" })
  const lastPlayed = page.getByText("Last played", { exact: true })
  const bestMedal = page.getByText("Best medal", { exact: true })
  await expect(exact).toHaveValue("100")
  await expect(bestMedal).toBeVisible()
  await expect(page.getByText("Gold", { exact: true })).toBeVisible()
  await expect(lastPlayed).toBeVisible()
  await expect(
    page.getByText("Chicken Stockfish", { exact: true }).last(),
  ).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await slider.press("ArrowRight")
  await expect(exact).toHaveValue("125")
  await expect(
    page.getByText("No matches at this Elo.", { exact: true }),
  ).toBeVisible()
  await expect(bestMedal).toHaveCount(0)
  await expect(lastPlayed).toHaveCount(0)
  await expect(
    page.getByText("Chicken Stockfish", { exact: true }),
  ).toBeVisible()
  await slider.press("ArrowLeft")
  await expect(bestMedal).toBeVisible()
  await expect(lastPlayed).toBeVisible()
})

test("loads the app icon without browser console errors", async ({
  page,
  request,
  workerOrigin,
}) => {
  const browserConsoleErrors: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error") browserConsoleErrors.push(message.text())
  })

  await page.goto(workerOrigin)
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
      name: "Your game customization",
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
