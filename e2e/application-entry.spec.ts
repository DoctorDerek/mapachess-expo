import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import challengeHistoryBackup from "./fixtures/challenge-history.json" with { type: "json" }

const modeNames = [
  "Standard Story",
  "Standard Challenge",
  "Chess960 Story",
  "Chess960 Challenge",
] as const

test("retains save recovery while retrying and restores settings after success", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function () {
      IDBObjectStore.prototype.put = put
      throw new DOMException("Test storage failure", "QuotaExceededError")
    }
  })
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).click()
  const retry = page.getByRole("button", { name: "Retry Save", exact: true })
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
    page.getByText("This change was not marked saved."),
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
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await expect(
    page.getByRole("radio", { name: "No Auto Hints", exact: true }),
  ).toBeChecked()
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
      .getByRole("button", { name: "Standard Challenge", exact: true })
      .click()
    const start = await page
      .getByRole("button", { name: "Start match", exact: true })
      .elementHandle()
    if (start === null) throw new Error("Start button must exist")
    await start.scrollIntoViewIfNeeded()
    const before = await start.boundingBox()
    await start.click()
    await expect.poll(() => start.innerText()).toBe("Opening match…")
    await expect.poll(() => start.getAttribute("aria-busy")).toBe("true")
    expect(await start.isDisabled()).toBe(true)
    await expect.poll(() => start.boundingBox()).toEqual(before)
    await expect(page.locator("#match-setup-title")).toBeVisible()
  } finally {
    release.resolve()
  }
})

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
    await page.getByRole("button", { name: /Change hints/ }).click()
    await expect(
      page.getByRole("radio", { name: "Auto Move Hints", exact: true }),
    ).toBeChecked()
    await page.getByRole("button", { name: "Done", exact: true }).click()
    if (name.endsWith("Challenge")) {
      await page.getByRole("button", { name: /Change difficulty/ }).click()
      const initialDifficulty = page.getByRole("radio", {
        name: "100 Elo",
        exact: true,
      })
      await initialDifficulty.focus()
      await initialDifficulty.press("ArrowRight")
      await expect(
        page.getByRole("radio", { name: "200 Elo", exact: true }),
      ).toBeChecked()
      await page.getByRole("button", { name: "Done", exact: true }).click()
      await expect(initialDifficulty).toBeHidden()
      await expect(
        page.getByRole("button", { name: /Change difficulty/ }),
      ).toBeFocused()
      await page.getByRole("button", { name: /Change difficulty/ }).click()
      await expect(
        page.getByRole("radio", { name: "200 Elo", exact: true }),
      ).toBeChecked()
      await page.getByRole("button", { name: "Done", exact: true }).click()
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
          "A fresh number for each new setup. Start uses the number shown.",
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
    .getByRole("button", { name: "Standard Story", exact: true })
    .click()
  await page.getByRole("button", { name: /Change hints/ }).click()
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).check()
  await page.getByRole("button", { name: "Done", exact: true }).click()
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
    page.getByText(/Gold if you win without using any hints\.$/),
  ).toBeVisible()
})

test("does not retain the former private playtest route", async ({ page }) => {
  const response = await page.goto("/playtest")

  expect(response?.status()).toBe(404)
})

test("presents imported Challenge medals with stable animal artwork", async ({
  page,
}) => {
  const backup = JSON.stringify(challengeHistoryBackup)
  await page.goto("/")
  await expectModeMenu(page)
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: "tile-history.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  })
  await page
    .getByRole("button", { name: "Replace Local Player Data", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Standard Challenge", exact: true })
    .click()
  await page.getByRole("button", { name: /Change difficulty/ }).click()
  const choice = page.getByRole("radio", {
    name: "100 Elo · Best medal: Gold · Last played: Chicken Stockfish",
    exact: true,
  })
  await expect(choice).toBeChecked()
  const tile = page.locator("label").filter({ has: choice })
  const sprite = tile.locator('span[style*="background-image"]')
  if (await sprite.count()) {
    const spriteElement = await sprite.elementHandle()
    if (spriteElement === null)
      throw new Error("Expected mounted animal sprite")
    await expect
      .poll(() => sprite.evaluate((element) => element.getAnimations().length))
      .toBe(1)
    await tile.scrollIntoViewIfNeeded()
    const tileBounds = await tile.boundingBox()
    await tile.hover()
    await expect(sprite).toHaveCSS("background-image", /chicken_peck_strip9/)
    const attentionAnimation = await sprite.evaluateHandle((element) => {
      const animation = element.getAnimations()[0]
      animation.pause()
      animation.currentTime = 200
      return animation
    })
    expect(
      await attentionAnimation.evaluate(
        (animation) => animation.effect?.getTiming().duration,
      ),
    ).toBe(900)
    await expect(sprite).not.toHaveCSS("background-position", "0% 0px")
    expect(await tile.boundingBox()).toEqual(tileBounds)
    await choice.focus()
    expect(
      await sprite.evaluate(
        (element, animation) => element.getAnimations()[0] === animation,
        attentionAnimation,
      ),
    ).toBe(true)
    await attentionAnimation.evaluate((animation) => animation.finish())
    await expect(sprite).toHaveCSS("background-image", /chicken_idle/)
    await attentionAnimation.dispose()
    await page.mouse.move(0, 0)
    await page.getByRole("button", { name: "Done", exact: true }).focus()
    await page.keyboard.press("Tab")
    await expect(choice).toBeFocused()
    await expect(sprite).toHaveCSS("background-image", /chicken_peck_strip9/)
    await page.emulateMedia({ reducedMotion: "reduce" })
    await expect
      .poll(() => sprite.evaluate((element) => element.getAnimations().length))
      .toBe(0)
    await expect(sprite).toHaveCSS("background-position", "0% 0px")
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await expect
      .poll(() => sprite.evaluate((element) => element.getAnimations().length))
      .toBe(1)
    await page.getByRole("button", { name: "Done", exact: true }).click()
    await expect
      .poll(() =>
        spriteElement.evaluate((element) => element.getAnimations().length),
      )
      .toBe(0)
    await page.getByRole("button", { name: /Change difficulty/ }).click()
    await expect
      .poll(() => sprite.evaluate((element) => element.getAnimations().length))
      .toBe(1)
  } else {
    await expect(
      tile.getByText("Chicken Stockfish", { exact: true }),
    ).toBeVisible()
  }
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
