import { expect, type Locator, type Page } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import type { ShippedLocale } from "../packages/localization/src/locale.js"
import { MATCH_MODE_CHOICES } from "../packages/match/src/matchSetup.js"
import { activate, injectControllerInput, press } from "./controllerInput.js"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"
import startHintMatch from "./startHintMatch.js"

test.use({ hasTouch: true })

async function playTimedTurn(page: Page, locale: ShippedLocale) {
  await startHintMatch(page, { locale, preset: "1+0" })
  const board = page.getByRole("grid")
  await board.getByRole("gridcell", { name: /^e2,/ }).tap()
  await board.getByRole("gridcell", { name: /^e4,/ }).tap()
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
      timeout: 30000,
    })
    .toBe(2)
  const match = (await savedProfile(page)).activeMatch
  if (match === null)
    throw new Error("Expected a retained match with an opponent reply")
  return match
}

const bounds = (locator: Locator) =>
  locator.evaluate((element) => {
    const { left, right, top, bottom } = element.getBoundingClientRect()
    return { left, right, top, bottom }
  })

function matchMenuControls(page: Page, locale: ShippedLocale) {
  const copy = loadCatalog(locale)
  return {
    menu: page.getByLabel(copy.interface.matchCommands.matchMenu, {
      exact: true,
    }),
    history: page.getByText(copy.interface.webMatch.matchDetailsMoveHistory, {
      exact: true,
    }),
    details: page.getByLabel(copy.interface.webMatch.currentMatchData, {
      exact: true,
    }),
    close: page.getByRole("button", {
      name: copy.shared.settingsControls.close,
      exact: true,
    }),
  }
}

for (const locale of ["en", "es-419"] as const) {
  const copy = loadCatalog(locale)
  test(`returning Home puts the one retained match beside all four play choices in ${locale}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const original = await playTimedTurn(page, locale)
    await page.goBack()
    await page
      .getByRole("button", { name: copy.setup.allModes, exact: true })
      .tap()
    const home = page.getByRole("region", { name: "Mapachess", exact: true })
    const label = `${copy.interface.webGame.resumeMatch} ${copy.gameplay.clock.preset(copy.gameplay.clock.category.bullet, "1+0")}`
    const resume = home.getByRole("button", { name: label, exact: true })
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toHaveCount(1)
    await expect(resume).toBeEnabled()
    const saved = await savedProfile(page)
    expect(saved.activeMatch).toMatchObject({
      matchId: original.matchId,
      cursor: 2,
      moveIds: original.moveIds,
      currentFen: original.currentFen,
      timeControl: original.timeControl,
      clock: { paused: true },
    })
    const share = home.getByRole("button", {
      name: copy.setup.shareProfile,
      exact: true,
    })
    const modes = MATCH_MODE_CHOICES.map(({ variant, mode }) =>
      home.getByRole("button", {
        name: copy.setup.presentations[variant][mode].title,
        exact: true,
      }),
    )
    for (const { width, height, scale } of [
      { width: 390, height: 844, scale: 100 },
      { width: 320, height: 640, scale: 200 },
      { width: 1280, height: 720, scale: 100 },
      { width: 1280, height: 600, scale: 200 },
    ]) {
      await page.setViewportSize({ width, height })
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size + "%"
        window.scrollTo(0, 0)
      }, scale)
      await expect
        .poll(async () => {
          const [action, card] = await Promise.all([
            bounds(resume),
            bounds(share),
          ])
          const choices = await Promise.all(modes.map(bounds))
          return {
            aboveModes:
              action.bottom <= Math.min(...choices.map((box) => box.top)),
            fillsPlayWidth:
              Math.abs(
                action.left - Math.min(...choices.map((box) => box.left)),
              ) < 1 &&
              Math.abs(
                action.right - Math.max(...choices.map((box) => box.right)),
              ) < 1,
            cardFirst:
              width < 1280
                ? card.bottom <= action.top
                : card.right <= action.left,
          }
        })
        .toEqual({ aboveModes: true, fillsPlayWidth: true, cardFirst: true })
      expect(
        await resume.evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBeLessThanOrEqual(1)
      if (width === 390) await expect(resume).toBeInViewport({ ratio: 1 })
    }
    await share.focus()
    await page.keyboard.press("Tab")
    await expect(resume).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(modes[0]!).toBeFocused()
    await resume.tap()
    await expect(page.getByRole("grid")).toBeVisible()
    await expect(
      page.getByRole("button", {
        name: copy.gameplay.clock.resume,
        exact: true,
      }),
    ).toBeVisible()
    expect(await savedProfile(page)).toEqual(saved)
  })

  test(`one tap on Close dismisses expanded history; Forward, Back and Escape remain layered in ${locale}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await playTimedTurn(page, locale)
    const { menu, history, details, close } = matchMenuControls(page, locale)
    await menu.tap()
    await expect
      .poll(async () => (await savedProfile(page)).activeMatch?.clock?.paused)
      .toBe(true)
    const saved = await savedProfile(page)
    await history.tap()
    await expect(details).toBeVisible()
    await close.tap()
    await expect(close).toBeHidden()
    await expect(details).toBeHidden()
    await expect(menu).toBeFocused()
    await expect(page.getByRole("grid")).toBeVisible()
    await page.goForward()
    await expect(history).toBeVisible()
    await expect(details).toBeHidden()
    await page.goForward()
    await expect(details).toBeVisible()
    await page.goBack()
    await expect(history).toBeVisible()
    await expect(details).toBeHidden()
    await page.goBack()
    await expect(close).toBeHidden()
    await menu.tap()
    await history.tap()
    await expect(details).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(details).toBeHidden()
    await expect(history).toBeFocused()
    await page.keyboard.press("Escape")
    await expect(close).toBeHidden()
    await expect(menu).toBeFocused()
    await menu.tap()
    await close.tap()
    await expect(close).toBeHidden()
    await expect(
      page.getByRole("button", {
        name: copy.gameplay.clock.resume,
        exact: true,
      }),
    ).toBeVisible()
    await page.goBack()
    await expect(
      page.getByRole("button", { name: copy.setup.allModes, exact: true }),
    ).toBeVisible()
    await page.goForward()
    await expect(page.getByRole("grid")).toBeVisible()
    await expect(close).toBeHidden()
    expect(await savedProfile(page)).toEqual(saved)
  })
}

test("controller Cancel stays stepwise and explicit Close works after reloading expanded history", async ({
  page,
}) => {
  await injectControllerInput(page)
  await playTimedTurn(page, "en")
  const { menu, history, details, close } = matchMenuControls(page, "en")
  await activate(page, menu)
  await activate(page, history)
  await expect(details).toBeVisible()
  await press(page, 1)
  await expect(details).toBeHidden()
  await expect(history).toBeFocused()
  await press(page, 1)
  await expect(close).toBeHidden()
  await expect(menu).toBeFocused()
  await activate(page, menu)
  await activate(page, history)
  await expect(details).toBeVisible()
  const saved = await savedProfile(page)
  await page.reload()
  await expect(details).toBeVisible()
  await activate(page, close)
  await expect(close).toBeHidden()
  await expect(page.getByRole("grid")).toBeVisible()
  await expect(menu).toBeFocused()
  expect(await savedProfile(page)).toEqual(saved)
})
