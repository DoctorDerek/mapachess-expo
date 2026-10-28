import AxeBuilder from "@axe-core/playwright"
import { expect } from "@playwright/test"
import { test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

for (const spanish of [false, true]) {
  test(`${spanish ? "Spanish" : "English"} Settings reflows enlarged text without losing controls or changing saved data`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    await page.getByRole("button", { name: "Settings", exact: true }).click()
    if (spanish)
      await page
        .getByRole("combobox", { name: "Language" })
        .selectOption("es-419")
    const settings = page.getByRole("dialog", {
      name: spanish ? "Personaliza tu juego" : "Your game customization",
      exact: true,
    })
    await expect(settings).toBeVisible()
    const original = await savedProfile(page)
    await page.addStyleTag({ content: ":root { font-size: 200%; }" })
    await expect
      .poll(() =>
        settings.evaluate((element) => getComputedStyle(element).fontSize),
      )
      .toBe("32px")
    await expect
      .poll(() =>
        settings.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      )
      .toBe(true)
    const close = settings.getByRole("button", {
      name: spanish ? "Cerrar configuración" : "Close Settings",
      exact: true,
    })
    await close.focus()
    await expect(close).toBeInViewport({ ratio: 1 })
    await expect(close).toBeFocused()
    await page.screenshot({
      path: testInfo.outputPath("settings-text-200-percent.png"),
    })
    await close.press("Enter")
    await expect(settings).toHaveCount(0)
    expect(await savedProfile(page)).toEqual(original)
  })
}

for (const width of [320, 1280]) {
  test(`previews customization inline and keeps the ${width}px match brief focused on its participants`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto("/")
    await page.getByRole("button", { name: "Settings", exact: true }).click()
    const settings = page.getByRole("dialog", {
      name: "Your game customization",
      exact: true,
    })
    const original = await savedProfile(page)
    for (const area of ["coach", "pieces", "board"]) {
      await expect(
        settings.getByRole("button", {
          name: `Change ${area}`,
          exact: true,
        }),
      ).toHaveAttribute("aria-haspopup", "dialog")
    }
    await expect(
      settings.getByRole("group", { name: "Coach", exact: true }),
    ).toHaveCount(0)
    await expect(
      settings.getByRole("img", { name: /board preview/ }),
    ).toHaveCount(0)
    const coachChange = settings.getByRole("button", {
      name: "Change coach",
      exact: true,
    })
    const coachPreview = coachChange.locator("..").locator("img")
    await expect(coachPreview).toHaveCount(1)
    await expect
      .poll(() =>
        coachPreview.evaluate(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth > 0,
        ),
      )
      .toBe(true)
    await page.screenshot({
      path: testInfo.outputPath("customization-closed.png"),
    })
    await coachChange.focus()
    await page.keyboard.press("Enter")
    await expect(
      settings
        .getByRole("group", { name: "Coach", exact: true })
        .getByRole("radio"),
    ).toHaveCount(2)
    await settings
      .getByRole("button", { name: "Done choosing coach", exact: true })
      .click()
    await expect(coachChange).toBeFocused()
    await settings
      .getByRole("button", { name: "Change pieces", exact: true })
      .click()
    await expect(
      settings.getByRole("img", { name: /board preview/ }),
    ).toBeVisible()
    await settings
      .getByRole("button", { name: "Done choosing pieces", exact: true })
      .click()
    await expect(
      settings.getByRole("img", { name: /board preview/ }),
    ).toHaveCount(0)
    expect(await savedProfile(page)).toEqual(original)
    expect(
      (
        await new AxeBuilder({ page })
          .include("#profile-settings-panel")
          .analyze()
      ).violations,
    ).toEqual([])
    await settings
      .getByRole("button", { name: "Close Settings", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Standard Chess Story", exact: true })
      .click()
    await expect(
      page.getByRole("button", { name: /^Play as Raccoon/ }),
    ).toHaveText("Change")
    await expect(
      page.getByRole("button", { name: "Change Story opponent", exact: true }),
    ).toHaveText("Change")
    await expect(
      page.getByText("Chicken Stockfish", { exact: true }),
    ).toBeVisible()
    await expect(page.getByText("100 Elo", { exact: true })).toBeVisible()
    await expect(page.getByRole("radio")).toHaveCount(0)
    const startMatch = page.getByRole("button", {
      name: "Start match",
      exact: true,
    })
    await startMatch.evaluate((button) =>
      button.scrollIntoView({ block: "center", behavior: "instant" }),
    )
    await expect(startMatch).toBeInViewport({ ratio: 1 })
    await expect(startMatch).toBeEnabled()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({ path: testInfo.outputPath("match-brief.png") })
  })

  test(`keeps the ${width}px board fixed through Menu and Settings navigation`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width, height: 800 })
    await page.goto("/")
    await page
      .getByRole("button", { name: "Standard Chess Challenge", exact: true })
      .click()
    await page.getByRole("button", { name: "Start match", exact: true }).click()
    await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6, {
      timeout: 30000,
    })
    const board = page.locator('[role="grid"]')
    await page.screenshot({ path: testInfo.outputPath("fine-point-hints.png") })
    const bounds = await board.boundingBox()
    const original = await savedProfile(page)
    const menu = page.locator("summary").filter({ hasText: "Menu" })
    await menu.click()
    expect(await board.boundingBox()).toEqual(bounds)
    const settingsButton = page.getByRole("button", {
      name: "Settings",
      exact: true,
    })
    await settingsButton.click()
    const settings = page.getByRole("dialog", {
      name: "Your game customization",
      exact: true,
    })
    await expect(settings).toBeVisible()
    await expect(settings).toHaveJSProperty("open", true)
    expect(await board.boundingBox()).toEqual(bounds)
    await expect(
      settings.getByRole("button", { name: "Close Settings", exact: true }),
    ).toBeFocused()
    await page.keyboard.press("Shift+Tab")
    expect(
      await settings.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true)
    await page.goBack()
    await expect(settings).toHaveCount(0)
    await expect(settingsButton).toBeFocused()
    expect(await board.boundingBox()).toEqual(bounds)
    await page.goForward()
    await expect(settings).toBeVisible()
    expect(await board.boundingBox()).toEqual(bounds)
    await page.getByRole("button", { name: "Credits", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Back to Settings", exact: true }),
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(
      page.getByRole("button", { name: "Back to Settings", exact: true }),
    ).toHaveCount(0)
    await expect(settings).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(settings).toHaveCount(0)
    await expect(settingsButton).toBeFocused()
    expect(await board.boundingBox()).toEqual(bounds)
    expect((await savedProfile(page)).activeMatch).toEqual(original.activeMatch)
    await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6)
    await page.keyboard.press("Escape")
    await expect(menu.locator("..")).not.toHaveAttribute("open")
    await expect(menu).toBeFocused()
  })
}

test("player animal selection survives Back, Forward and reload without changing Story progress", async ({
  page,
}) => {
  await page.goto("/")
  await page
    .getByRole("button", { name: "Standard Chess Story", exact: true })
    .click()
  const original = await savedProfile(page)
  const trigger = page.getByRole("button", { name: /^Play as Raccoon/ })
  const chooser = page.getByRole("dialog", { name: "Play as", exact: true })
  await trigger.click()
  await expect(chooser).toBeVisible()
  await expect(chooser.getByRole("radio")).toHaveCount(23)
  await expect(chooser.getByRole("radio", { name: /Chicken/ })).toBeDisabled()
  await page.goBack()
  await expect(chooser).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await page.goForward()
  await expect(chooser).toBeVisible()
  await page.reload()
  await expect(chooser).toBeVisible()
  await expect(chooser.getByRole("radio", { name: /Raccoon/ })).toBeChecked()
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await expect(chooser).toHaveCount(0)
  expect((await savedProfile(page)).storyProgress).toEqual(
    original.storyProgress,
  )
  expect((await savedProfile(page)).appearance).toEqual(original.appearance)
})

test("Settings retains its recovery and reset controls inside the non-shifting dialog", async ({
  page,
}) => {
  await page.goto("/")
  const trigger = page.getByRole("button", { name: "Settings", exact: true })
  await trigger.click()
  const original = await savedProfile(page)
  const settings = page.getByRole("dialog", {
    name: "Your game customization",
    exact: true,
  })
  await settings
    .getByRole("button", {
      name: "Reset Standard Chess · Untimed · Gold Elo",
      exact: true,
    })
    .click()
  await expect(
    settings.getByRole("heading", {
      name: "Reset Standard Chess · Untimed · Gold Elo?",
      exact: true,
    }),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(
    settings.getByRole("heading", {
      name: "Reset Standard Chess · Untimed · Gold Elo?",
      exact: true,
    }),
  ).toHaveCount(0)
  await expect(settings).toBeVisible()
  expect(await savedProfile(page)).toEqual(original)
  const report = await new AxeBuilder({ page }).analyze()
  expect(
    report.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([])
  await settings
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await expect(trigger).toBeFocused()
})
