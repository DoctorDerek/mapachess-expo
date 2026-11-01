import { expect, type Locator, type Page } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"
import startHintMatch from "./startHintMatch.js"

test.use({ hasTouch: true })

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

for (const { locale, preset } of [
  { locale: "en", preset: "untimed" },
  { locale: "es-419", preset: "untimed" },
  { locale: "en", preset: "1+0" },
  { locale: "es-419", preset: "1+0" },
] as const) {
  test(`one scroll reaches the board, hints and history at enlarged text in ${locale} · ${preset}`, async ({
    page,
  }) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width: 320, height: 640 })
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
    if (!bullet && locale === "en")
      await expect(hint).toBeInViewport({ ratio: 0.5 })
    await redo.evaluate((element) =>
      element.scrollIntoView({ block: "nearest" }),
    )
    const restingScroll = await page.evaluate(() => scrollY)
    const boardWidth = await board.evaluate(
      (element) => element.getBoundingClientRect().width,
    )
    expect(restingScroll).toBeLessThan(boardWidth)
    await expect(board).toBeInViewport({ ratio: 1 })
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
    await tapInPlace(page, origin)
    await tapInPlace(page, destination)
    await expect
      .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
        timeout: 30000,
      })
      .toBe(2)
    const moved = (await savedProfile(page)).activeMatch
    if (!moved) throw new Error("Expected an accepted reply")
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
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(restingScroll, 0)
    if (bullet) {
      await resume.scrollIntoViewIfNeeded()
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

test("short landscape keeps both ends of the full-width board reachable; short desktop keeps commands beside it", async ({
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
  await expect(board).toHaveCSS("width", "844px")
  const wideBoard = await bounds(board)
  expect(wideBoard.height).toBe(wideBoard.width)
  expect((await bounds(commands)).top).toBeGreaterThanOrEqual(wideBoard.bottom)
  expect((await bounds(stage)).top).toBeGreaterThanOrEqual(
    (await bounds(commands)).bottom,
  )
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
  expect((await bounds(stage)).left).toBeCloseTo(desktopBoard.left, 0)
  expect((await bounds(stage)).top).toBeGreaterThanOrEqual(desktopBoard.bottom)
  await expect(commands).toBeInViewport({ ratio: 1 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1280,
  )
})
