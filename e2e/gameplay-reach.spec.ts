import { expect, type Locator, type Page } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"
import startHintMatch from "./startHintMatch.js"

test.use({ hasTouch: true })

for (const locale of ["en", "es-419"] as const) {
  test(`match menu keeps its actions readable without nested scrolling in ${locale}`, async ({
    page,
  }) => {
    const copy = loadCatalog(locale)
    await startHintMatch(page, { locale, hints: "no-auto-hints" })
    const menu = page.getByRole("button", {
      name: copy.interface.matchCommands.matchMenu,
      exact: true,
    })
    const dialog = page.getByRole("dialog", {
      name: copy.interface.matchCommands.matchMenu,
      exact: true,
    })
    const close = dialog.getByRole("button", {
      name: copy.interface.matchCommands.backToBoard,
      exact: true,
    })
    for (const { width, height, scale } of [
      { width: 390, height: 844, scale: 100 },
      { width: 320, height: 640, scale: 200 },
      { width: 844, height: 390, scale: 100 },
      { width: 1279, height: 800, scale: 100 },
      { width: 1280, height: 800, scale: 100 },
      { width: 1440, height: 900, scale: 100 },
    ]) {
      await page.setViewportSize({ width, height })
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size + "%"
      }, scale)
      await menu.scrollIntoViewIfNeeded()
      await menu.tap()
      await expect(dialog).toBeVisible()
      expect(
        await dialog.evaluate((element: HTMLDialogElement) =>
          element.matches(":modal"),
        ),
      ).toBe(true)
      await expect(close).toBeFocused()
      await expect(close).toBeInViewport({ ratio: 1 })
      const closeBounds = await close.boundingBox()
      if (closeBounds === null)
        throw new Error("The open menu needs a visible Close action.")
      expect(closeBounds.height).toBeGreaterThanOrEqual(48)
      expect(closeBounds.y + closeBounds.height).toBeLessThanOrEqual(height)
      const title = dialog.getByRole("heading", {
        name: copy.interface.matchCommands.matchMenu,
        exact: true,
      })
      const titleBounds = await title.boundingBox()
      if (titleBounds === null)
        throw new Error(
          "The menu title must remain in the normal content flow.",
        )
      expect(titleBounds.y).toBeGreaterThanOrEqual(
        closeBounds.y + closeBounds.height,
      )
      const nestedScrollports = () =>
        dialog.evaluate(
          (element) =>
            Array.from(element.querySelectorAll("*")).filter((child) =>
              ["auto", "scroll"].includes(getComputedStyle(child).overflowY),
            ).length,
        )
      expect(await nestedScrollports()).toBe(0)
      const settings = dialog.getByRole("button", {
        name: copy.interface.webGame.settings,
        exact: true,
      })
      const settingsBounds = await settings.boundingBox()
      if (settingsBounds === null)
        throw new Error("The match menu needs a visible Settings action.")
      expect(
        await settings.evaluate((element) => {
          const button = element.getBoundingClientRect()
          const label = document.createRange()
          label.selectNodeContents(element)
          return Array.from(label.getClientRects()).every(
            (rect) =>
              rect.left >= button.left - 1 && rect.right <= button.right + 1,
          )
        }),
      ).toBe(true)
      expect(closeBounds.y).toBeGreaterThanOrEqual(
        settingsBounds.y + settingsBounds.height,
      )
      expect(settingsBounds.width).toBeCloseTo(closeBounds.width, 0)
      const shouldFitOnOpen = scale === 100 && (width === 390 || width === 1440)
      const buttons = await dialog.getByRole("button").all()
      for (const item of [...buttons, title]) {
        if (!shouldFitOnOpen) await item.scrollIntoViewIfNeeded()
        await expect(item).toBeInViewport({ ratio: 1 })
      }
      if (shouldFitOnOpen) {
        expect(
          await dialog.evaluate(
            (element) => element.scrollHeight - element.clientHeight,
          ),
        ).toBeLessThanOrEqual(1)
      }
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1)
      if (width < 1280) {
        await page.mouse.click(1, 1)
        await expect(dialog).toBeHidden()
        await expect(menu).toBeFocused()
        await menu.tap()
        await expect(close).toBeFocused()
      }
      const history = dialog.getByText(
        copy.interface.webMatch.matchDetailsMoveHistory,
        { exact: true },
      )
      await history.scrollIntoViewIfNeeded()
      await history.tap()
      expect(await nestedScrollports()).toBe(0)
      await close.scrollIntoViewIfNeeded()
      await expect(close).toBeInViewport({ ratio: 1 })
      await close.focus()
      await page.keyboard.press("Shift+Tab")
      await expect(history).toBeFocused()
      await page
        .locator('[data-square="e2"]')
        .evaluate((square: HTMLElement) => square.focus())
      await expect(history).toBeFocused()
      await close.scrollIntoViewIfNeeded()
      await tapInPlace(page, close)
      await expect(dialog).toBeHidden()
      await expect(menu).toBeFocused()
    }
  })
}

test("centers the xl menu and dismisses only an outside click", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await startHintMatch(page)
  const menu = page.getByRole("button", { name: "Match menu", exact: true })
  const dialog = page.getByRole("dialog", { name: "Match menu", exact: true })
  const close = dialog.getByRole("button", {
    name: "Back to Board",
    exact: true,
  })
  const board = page.getByRole("grid", { name: /Chessboard/ })
  const before = await savedProfile(page)

  const square = await board.locator('[data-square="e2"]').boundingBox()
  await menu.click()
  await expect(close).toBeFocused()
  const panel = await dialog.boundingBox()
  if (panel === null || square === null)
    throw new Error("The modal and its background board must be rendered.")
  expect(panel.x + panel.width / 2).toBeCloseTo(720, 0)
  expect(panel.y + panel.height / 2).toBeCloseTo(450, 0)
  const padding = { x: panel.x + 8, y: panel.y + panel.height / 2 }
  const outside = { x: panel.x - 2, y: panel.y + panel.height / 2 }
  expect(outside.x).toBeGreaterThanOrEqual(0)

  await page.mouse.click(padding.x, padding.y)
  await expect(dialog).toBeVisible()
  await page.mouse.move(padding.x, padding.y)
  await page.mouse.down()
  await page.mouse.move(outside.x, outside.y)
  await page.mouse.up()
  await expect(dialog).toBeVisible()
  await page.mouse.click(outside.x, outside.y)
  await expect(dialog).toHaveCount(0)
  await expect(menu).toBeFocused()
  await expect(board.locator('[data-square="e2"]')).toHaveAttribute(
    "aria-selected",
    "false",
  )
  expect(await savedProfile(page)).toEqual(before)

  await menu.press("Enter")
  await expect(close).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(menu).toBeFocused()
})

async function tapInPlace(page: Page, control: Locator): Promise<void> {
  await expect(control).toBeEnabled()
  await expect(control).toBeInViewport({ ratio: 1 })
  const point = await control.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    if (!element.contains(document.elementFromPoint(x, y)))
      throw new Error(
        `Tap blocked: ${element.getAttribute("aria-label") ?? element.textContent}`,
      )
    return { x, y }
  })
  await page.touchscreen.tap(point.x, point.y)
}

for (const phone of [
  { width: 320, height: 510, locale: "en", preset: "untimed" },
  { width: 320, height: 568, locale: "en", preset: "untimed" },
  { width: 320, height: 568, locale: "es-419", preset: "1+0" },
  { width: 390, height: 700, locale: "en", preset: "untimed" },
] as const) {
  test(`sees a legal move, its battle and reachable commands at ${phone.width}×${phone.height} in ${phone.locale} · ${phone.preset}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height })
    await startHintMatch(page, {
      locale: phone.locale,
      preset: phone.preset,
      hints: "no-auto-hints",
    })
    const copy = loadCatalog(phone.locale)
    const board = page.getByRole("grid")
    const stage = page.getByRole("region", {
      name: copy.interface.reactiveBattleStage.reactiveBattleStage,
    })
    const controls = page.getByRole("region", {
      name: copy.interface.webMatch.coreMatchActions,
    })
    await expect(board).toHaveCSS("width", phone.width + "px")
    await expect(board).toHaveCSS("height", phone.width + "px")
    await expect(board.getByRole("gridcell")).toHaveCount(64)
    for (const surface of [board, stage])
      await expect(surface).toBeInViewport({ ratio: 1 })
    const boardBox = await board.boundingBox()
    const stageBox = await stage.boundingBox()
    expect(stageBox!.y).toBeCloseTo(boardBox!.y + boardBox!.height, 0)
    const undo = controls.getByRole("button", {
      name: copy.interface.matchCommands.undo,
      exact: true,
    })
    const undoBox = await undo.boundingBox()
    expect(undoBox!.x + undoBox!.width / 2).toBeCloseTo(phone.width / 2, 0)
    await expect(undo).toBeInViewport({ ratio: 1 })
    for (const control of await controls.getByRole("button").all()) {
      if (phone.height >= 568)
        await expect(control).toBeInViewport({ ratio: 1 })
      else await control.scrollIntoViewIfNeeded()
      const target = await control.boundingBox()
      expect(target!.width).toBeGreaterThanOrEqual(44)
      expect(target!.height).toBeGreaterThanOrEqual(44)
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
    const square = await board.locator('[data-square="e2"]').boundingBox()
    expect(square!.width).toBeCloseTo(phone.width / 8, 0)
    const timers = page.getByRole("timer")
    await expect(timers).toHaveCount(phone.preset === "untimed" ? 0 : 2)
    if (phone.preset !== "untimed") {
      const meter = await page.getByRole("meter").boundingBox()
      const first = await timers.first().boundingBox()
      const second = await timers.last().boundingBox()
      expect(first!.x + first!.width).toBeLessThanOrEqual(meter!.x)
      expect(second!.x).toBeGreaterThanOrEqual(meter!.x + meter!.width)
    }
    await tapInPlace(page, board.locator('[data-square="e2"]'))
    await tapInPlace(page, board.locator('[data-square="e4"]'))
    await expect
      .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
        timeout: 30000,
      })
      .toBe(2)
    await expect(stage).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => scrollY)).toBe(0)
  })
}

for (const { locale, preset } of [
  { locale: "en", preset: "untimed" },
  { locale: "es-419", preset: "untimed" },
  { locale: "en", preset: "1+0" },
  { locale: "es-419", preset: "1+0" },
] as const) {
  test(`keeps the enlarged board and battle visible and scrolls to playable controls in ${locale} · ${preset}`, async ({
    page,
  }) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width: 320, height: 568 })
    await page.addInitScript(() => {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          document.documentElement.style.fontSize = "200%"
        },
        { once: true },
      )
    })
    const copy = loadCatalog(locale)
    const bullet = preset === "1+0"
    await startHintMatch(page, {
      locale,
      hints: bullet ? "auto-move-hints" : "no-auto-hints",
      preset,
    })
    const board = page.getByRole("grid")
    const controls = page.getByRole("region", {
      name: copy.interface.webMatch.coreMatchActions,
    })
    const undo = controls.getByRole("button", {
      name: copy.interface.matchCommands.undo,
      exact: true,
    })
    const redo = controls.getByRole("button", {
      name: copy.interface.matchCommands.redo,
      exact: true,
    })
    const hint = controls.getByRole("button", {
      name: copy.gameplay.hints.getHint,
    })
    const origin = board.getByRole("gridcell", { name: /^e2,/ })
    const destination = board.getByRole("gridcell", { name: /^e4,/ })
    await expect(board).toHaveCSS("font-size", "32px")
    await expect(board).toHaveCSS("width", "320px")
    await expect(board.getByRole("gridcell")).toHaveCount(64)
    await expect(origin).toHaveAttribute("aria-disabled", "false", {
      timeout: 30000,
    })
    if (bullet) await expect(page.getByRole("timer")).toHaveCount(2)
    expect(await page.evaluate(() => scrollY)).toBe(0)
    const battle = page.getByRole("region", {
      name: copy.interface.reactiveBattleStage.reactiveBattleStage,
    })
    await expect(board).toBeInViewport({ ratio: 1 })
    await expect(battle).toBeInViewport({ ratio: 1 })
    const scrollToCommands = () =>
      page.evaluate(() =>
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "instant",
        }),
      )
    await scrollToCommands()
    const controlScroll = await page.evaluate(() => scrollY)
    expect(controlScroll).toBeGreaterThan(0)
    const help = controls.getByRole("button", {
      name: copy.shared.settingsControls.explainAutoHints,
      exact: true,
    })
    const helpBounds = await help.boundingBox()
    expect(helpBounds!.width).toBeGreaterThanOrEqual(64)
    expect(helpBounds!.height).toBeGreaterThanOrEqual(64)
    for (const control of await controls.getByRole("button").all()) {
      await expect(control).toBeInViewport({ ratio: 1 })
      expect(
        await control.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1)
    }
    const historyTop = (control: Locator) =>
      control.evaluate((element) => element.getBoundingClientRect().top)
    expect(await historyTop(undo)).toBeCloseTo(await historyTop(redo), 1)
    if (!bullet) {
      await tapInPlace(page, hint)
      await expect(page.locator('[data-hint-kind="source"]')).toHaveCount(6)
      await tapInPlace(page, hint)
    }
    await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
    await tapInPlace(page, origin)
    await tapInPlace(page, destination)
    await expect
      .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
        timeout: 30000,
      })
      .toBe(2)
    const moved = (await savedProfile(page)).activeMatch
    if (!moved) throw new Error("Expected an accepted reply")
    await expect(board).toBeInViewport({ ratio: 1 })
    await expect(battle).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => scrollY)).toBe(0)
    await scrollToCommands()
    await tapInPlace(page, undo)
    await expect
      .poll(async () => (await savedProfile(page)).activeMatch?.cursor)
      .toBe(0)
    const resume = controls.getByRole("button", {
      name: copy.gameplay.clock.resume,
      exact: true,
    })
    if (bullet) {
      await expect(resume).toBeAttached()
      expect((await savedProfile(page)).activeMatch?.clock?.paused).toBe(true)
    }
    await tapInPlace(page, redo)
    await expect
      .poll(async () => (await savedProfile(page)).activeMatch?.currentFen)
      .toBe(moved.currentFen)
    // Scroll offsets round to CSS pixels when a fractional row is laid out again.
    expect(
      Math.abs((await page.evaluate(() => scrollY)) - controlScroll),
    ).toBeLessThanOrEqual(1)
    if (bullet) {
      await scrollToCommands()
      await tapInPlace(page, resume)
      await expect(resume).toHaveCount(0)
      await expect(
        page
          .getByRole("timer")
          .filter({ hasText: copy.gameplay.clock.running }),
      ).toHaveCount(1)
    }
    await expect(
      page.getByRole("region", {
        name: copy.interface.reactiveBattleStage.reactiveBattleStage,
      }),
    ).toBeAttached()
  })
}

test("landscape preserves board width and page scrolling, then places the battle beside the desktop board", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await startHintMatch(page)
  const board = page.getByRole("grid")
  const copy = loadCatalog("en")
  const commands = page.getByRole("region", {
    name: copy.interface.webMatch.coreMatchActions,
  })
  const stage = page.getByRole("region", {
    name: copy.interface.reactiveBattleStage.reactiveBattleStage,
  })
  const bounds = (locator: Locator) =>
    locator.evaluate((element) => {
      const { left, right, top, bottom, width, height } =
        element.getBoundingClientRect()
      return { left, right, top, bottom, width, height }
    })
  const wideBoard = await bounds(board)
  expect(wideBoard.width).toBe(844)
  expect(wideBoard.height).toBe(wideBoard.width)
  expect((await bounds(stage)).top).toBeCloseTo(wideBoard.bottom, 0)
  expect((await bounds(commands)).top).toBeGreaterThanOrEqual(
    (await bounds(stage)).bottom,
  )
  await commands.scrollIntoViewIfNeeded()
  await expect(commands).toBeInViewport({ ratio: 1 })
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0)
  const initial = (await savedProfile(page)).activeMatch
  for (const name of [/^a8,/, /^h1,/]) {
    const square = board.getByRole("gridcell", { name })
    await square.scrollIntoViewIfNeeded()
    await expect(square).toBeInViewport({ ratio: 1 })
  }
  expect((await savedProfile(page)).activeMatch).toEqual(initial)
  await page.setViewportSize({ width: 1280, height: 600 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
    window.scrollTo(0, 0)
  })
  await expect
    .poll(
      async () => (await bounds(commands)).left >= (await bounds(board)).right,
    )
    .toBe(true)
  const desktopBoard = await bounds(board)
  expect((await bounds(stage)).left).toBeCloseTo(
    (await bounds(commands)).left,
    0,
  )
  expect((await bounds(stage)).bottom).toBeLessThanOrEqual(
    (await bounds(commands)).top,
  )
  expect(desktopBoard.width).toBe(832)
  for (const height of [720, 900]) {
    await page.setViewportSize({ width: 1440, height })
    expect((await bounds(board)).width).toBe(desktopBoard.width)
  }
  await expect(commands).toBeInViewport({ ratio: 1 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1440,
  )
})
