import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import savedProfile from "./savedProfile.js"

for (const width of [320, 1280]) {
  test(`keeps the ${width}px board fixed through Menu and Settings navigation`, async ({
    page,
  }) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/")
    await page
      .getByRole("button", { name: "Standard Chess Challenge", exact: true })
      .click()
    await page.getByRole("button", { name: "Start match", exact: true }).click()
    await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6, {
      timeout: 30000,
    })
    const board = page.locator('[role="grid"]')
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
      name: "Settings & Player Data",
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
    await page.getByText("Credits", { exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Close Credits", exact: true }),
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(
      page.getByRole("button", { name: "Close Credits", exact: true }),
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
    name: "Settings & Player Data",
    exact: true,
  })
  await settings
    .getByRole("button", { name: "Reset Standard Chess Elo", exact: true })
    .click()
  await expect(
    settings.getByRole("heading", {
      name: "Reset Standard Chess Elo?",
      exact: true,
    }),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(
    settings.getByRole("heading", {
      name: "Reset Standard Chess Elo?",
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
