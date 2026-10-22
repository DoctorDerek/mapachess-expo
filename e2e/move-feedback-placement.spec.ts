import { expect, type Locator, type Page } from "@playwright/test"
import { listLegalMatchMoves } from "../packages/match/src/matchMove.js"
import { reconstructMatchPosition } from "../packages/match/src/matchPosition.js"
import type { MoveReactionPlacement } from "../packages/profile/src/presentationPreferences.js"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

const placementLabels = {
  top: "Top",
  middle: "Midpoint",
  bottom: "Bottom",
} as const

async function boxOf(locator: Locator) {
  await expect(locator).toBeVisible()
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return {
      x: box.x + scrollX,
      y: box.y + scrollY,
      width: box.width,
      height: box.height,
    }
  })
}

function expectSameBox(
  actual: Awaited<ReturnType<typeof boxOf>>,
  expected: Awaited<ReturnType<typeof boxOf>>,
) {
  expect(actual.x).toBeCloseTo(expected.x, 2)
  expect(actual.y).toBeCloseTo(expected.y, 2)
  expect(actual.width).toBeCloseTo(expected.width, 2)
  expect(actual.height).toBeCloseTo(expected.height, 2)
}

async function openGame(
  page: Page,
  placement: MoveReactionPlacement,
  color: "White" | "Black" = "White",
  fontSize = 16,
) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.clock.install()
  await page.goto("/")
  await page.addStyleTag({ content: `html { font-size: ${fontSize}px; }` })
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  const choices = page.getByRole("group", {
    name: "Move rating position",
    exact: true,
  })
  await expect(
    choices.getByRole("radio", { name: "Top", exact: true }),
  ).toBeChecked()
  await choices
    .getByRole("radio", { name: placementLabels[placement], exact: true })
    .check()
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).check()
  await expect
    .poll(async () => (await savedProfile(page)).settings.moveReactionPlacement)
    .toBe(placement)
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()
  await page.getByRole("radio", { name: color, exact: true }).check()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  await expect(page.getByRole("grid", { name: /Chessboard/ })).toBeVisible()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  if (color === "Black")
    await expect(
      page.getByRole("button", { name: /^Dismiss White 1\. / }),
    ).toBeVisible()
}

async function playLegalMove(page: Page, preferred: string, keyboard = false) {
  const before = (await savedProfile(page)).activeMatch
  if (before === null) throw new Error("Expected active game")
  const position = reconstructMatchPosition(
    before.startingPosition,
    before.currentFen,
  )
  if (!position.ok) throw new Error("Expected legal position")
  const legal = listLegalMatchMoves(position.position)
  const move =
    legal.find(({ uci }) => uci === preferred) ??
    legal.find(
      (candidate) =>
        candidate.kind === "normal" && candidate.promotion === null,
    )
  if (move === undefined) throw new Error("Expected legal continuation")
  const origin = page.getByRole("gridcell", {
    name: new RegExp(`^${move.from},`),
  })
  await expect(origin).toHaveAttribute("aria-disabled", "false")
  const destination = page.getByRole("gridcell", {
    name: new RegExp(`^${move.to},`),
  })
  if (keyboard) {
    await origin.press("Enter")
    await destination.press("Enter")
  } else {
    await origin.click()
    await destination.click()
  }
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.cursor)
    .toBe(before.cursor + 2)
}

for (const configuration of [
  { width: 320, placement: "middle", color: "White" },
  { width: 390, placement: "top", color: "Black" },
  { width: 1279, placement: "bottom", color: "White" },
  { width: 1280, placement: "middle", color: "Black" },
  { width: 1440, placement: "top", color: "White" },
  { width: 1440, placement: "bottom", color: "Black" },
] as const) {
  test(`${configuration.width}px ${configuration.placement} feedback keeps the board stable for a ${configuration.color} player`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: configuration.width, height: 900 })
    await openGame(page, configuration.placement, configuration.color)
    const board = page.getByRole("grid", { name: /Chessboard/ })
    const commands = page.getByRole("region", {
      name: "Core match actions",
      exact: true,
    })
    const battle = page.getByRole("region", {
      name: "Reactive Battle Stage",
      exact: true,
    })
    const before = {
      board: await boxOf(board),
      commands: await boxOf(commands),
      battle: await boxOf(battle),
    }
    await playLegalMove(page, configuration.color === "White" ? "e2e4" : "e7e5")
    const hero = page.getByRole("button", {
      name: new RegExp(`^Dismiss ${configuration.color} `),
    })
    const opponent = page.getByRole("button", {
      name: new RegExp(
        `^Dismiss ${configuration.color === "White" ? "Black" : "White"} `,
      ),
    })
    await expect(hero).toHaveCount(1)
    await expect(opponent).toHaveCount(1)
    await expect(hero).toHaveAccessibleName(
      new RegExp(`^Dismiss ${configuration.color} 1\\.`),
    )
    await expect(opponent).toHaveAccessibleName(
      configuration.color === "White"
        ? /^Dismiss Black 1\.\.\. /
        : /^Dismiss White 2\. /,
    )
    const heroBox = await boxOf(hero)
    const desktop = configuration.width >= 1280
    const top = desktop
      ? before.commands.y + before.commands.height + 8
      : configuration.placement === "top"
        ? (await boxOf(page.getByRole("heading", { level: 1 }))).y + 4
        : before.board.y + 4
    const bottom = before.board.y + before.board.height - (desktop ? 0 : 4)
    if (configuration.placement === "top") expect(heroBox.y).toBeCloseTo(top, 0)
    else if (configuration.placement === "bottom")
      expect(heroBox.y + heroBox.height).toBeCloseTo(bottom, 0)
    else
      expect(heroBox.y + heroBox.height / 2).toBeCloseTo((top + bottom) / 2, 0)
    for (const card of await page
      .getByRole("button", { name: /^Dismiss / })
      .all()) {
      const cardBox = await boxOf(card)
      if (desktop)
        expect(cardBox.x).toBeGreaterThan(before.board.x + before.board.width)
      expect(cardBox.y).toBeGreaterThanOrEqual(top - 1)
      expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(bottom + 1)
      expect(
        await card.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true)
    }
    expectSameBox(await boxOf(board), before.board)
    expectSameBox(await boxOf(commands), before.commands)
    expectSameBox(await boxOf(battle), before.battle)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath("placement.png"),
      fullPage: true,
    })
    const opponentBefore = await boxOf(opponent.first())
    const savedBeforeDismiss = await savedProfile(page)
    await hero.click()
    await expect(hero).toHaveCount(0)
    expectSameBox(await boxOf(opponent.first()), opponentBefore)
    expect(await savedProfile(page)).toEqual(savedBeforeDismiss)
    expectSameBox(await boxOf(board), before.board)
  })
}

test("crossing the layout boundary preserves card identities and remaining lifetimes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await openGame(page, "middle")
  await playLegalMove(page, "e2e4")
  const cards = page.getByRole("button", { name: /^Dismiss / })
  await expect(cards).toHaveCount(2)
  const firstCard = await cards.first().elementHandle()
  if (firstCard === null) throw new Error("Expected reaction card")
  await page.clock.runFor(2000)
  await page.setViewportSize({ width: 1440, height: 900 })
  expect(await firstCard.evaluate((element) => element.isConnected)).toBe(true)
  await expect(cards).toHaveCount(2)
  await page.clock.runFor(3100)
  await expect(cards).toHaveCount(0)
  await firstCard.dispose()
})

for (const width of [320, 1440]) {
  test(`rapid keyboard-play keeps one readable card per participant at ${width}px and enlarged text`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 })
    await openGame(page, "top", "White", 24)
    const board = page.getByRole("grid", { name: /Chessboard/ })
    const before = await boxOf(board)
    const hero = page.getByRole("button", { name: /^Dismiss White / })
    const opponent = page.getByRole("button", { name: /^Dismiss Black / })
    for (const preferred of ["e2e4", "g1f3", "f1c4"]) {
      await playLegalMove(page, preferred, true)
      await expect(hero).toHaveCount(1)
      await expect(opponent).toHaveCount(1)
    }
    expectSameBox(await boxOf(board), before)
    await expect(hero.first()).toHaveAccessibleName(/^Dismiss White 3\. /)
    await expect(opponent.first()).toHaveAccessibleName(
      /^Dismiss Black 3\.\.\. /,
    )
    for (const card of await page
      .getByRole("button", { name: /^Dismiss / })
      .all()) {
      expect(
        await card.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true)
      await expect(card.locator('[aria-hidden="true"]')).toBeHidden()
    }
    if (width < 1280) {
      expect(
        await page.evaluate(
          ({ x, y }) =>
            document
              .elementFromPoint(x - scrollX, y - scrollY)
              ?.closest('[role="gridcell"]') != null,
          {
            x: before.x + before.width / 2,
            y: before.y + before.height / 2,
          },
        ),
      ).toBe(true)
    }
    await page.screenshot({
      path: testInfo.outputPath("rapid-enlarged.png"),
      fullPage: true,
    })
    const opponentBefore = await boxOf(opponent.first())
    await hero.focus()
    await hero.press("Enter")
    await expect(hero).toHaveCount(0)
    expectSameBox(await boxOf(opponent.first()), opponentBefore)
    await opponent.first().press("Space")
    await expect(opponent).toHaveCount(0)
    expectSameBox(await boxOf(board), before)
  })
}

test("Mexican Spanish placement is saved across reload and subsequent changes", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.getByRole("combobox", { name: "Language" }).selectOption("es-419")
  await page.getByRole("button", { name: "Comenzar", exact: true }).click()
  await page.getByRole("button", { name: "Configuración", exact: true }).click()
  const choices = page.getByRole("group", {
    name: "Posición de los avisos de jugada",
    exact: true,
  })
  await expect(
    choices.getByRole("radio", { name: "Arriba", exact: true }),
  ).toBeChecked()
  await choices.getByRole("radio", { name: "Abajo", exact: true }).check()
  await expect
    .poll(async () => (await savedProfile(page)).settings.moveReactionPlacement)
    .toBe("bottom")
  await choices.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("spanish-setting.png") })
  const before = await savedProfile(page)
  await page.reload()
  await expect(
    page.getByRole("dialog", { name: "Personaliza tu juego", exact: true }),
  ).toBeVisible()
  await expect(
    choices.getByRole("radio", { name: "Abajo", exact: true }),
  ).toBeChecked()
  expect(await savedProfile(page)).toEqual(before)
  await choices.getByRole("radio", { name: "Arriba", exact: true }).check()
  await choices.getByRole("radio", { name: "Centro", exact: true }).check()
  await expect
    .poll(async () => (await savedProfile(page)).settings.moveReactionPlacement)
    .toBe("middle")
})
