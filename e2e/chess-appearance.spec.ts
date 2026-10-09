import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Locator, type Page } from "@playwright/test"
import {
  CHESS_BOARDS,
  CHESS_PIECE_SETS,
} from "../packages/match-presentation/src/chessAppearanceCatalog.js"
import { parseMatchMoveId } from "../packages/match/src/matchMove.js"
import { createInitialMatchPosition } from "../packages/match/src/matchPosition.js"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  currentMatchPosition,
} from "../packages/match/src/matchTimeline.js"
import importPlayerData from "./importPlayerData.js"
import savedProfile from "./savedProfile.js"

const appearanceSection = (page: Page) =>
  page.getByRole("region", { name: "Board & Pieces", exact: true })
const expectLoadedArtwork = async (surface: Locator): Promise<void> => {
  await expect
    .poll(() =>
      surface
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0 &&
              getComputedStyle(image).opacity === "1",
          ),
        ),
    )
    .toBe(true)
}
const expectAccessibleChoices = async (page: Page): Promise<void> => {
  const headingId =
    await appearanceSection(page).getAttribute("aria-labelledby")
  const report = await new AxeBuilder({ page })
    .include(`section[aria-labelledby="${headingId}"]`)
    .analyze()
  expect(report.violations).toEqual([])
}
const openGallery = async (
  page: Page,
  name: "Pieces" | "Board",
): Promise<void> => {
  const disclosure = appearanceSection(page)
    .locator("details")
    .filter({
      has: page.locator("summary").filter({ hasText: new RegExp(name) }),
    })
  if (!(await disclosure.evaluate((element) => element.hasAttribute("open"))))
    await disclosure.locator("summary").click()
}
const openSettings = async (page: Page): Promise<void> => {
  const settings = page.getByRole("button", { name: "Settings", exact: true })
  const menu = page.locator("summary").filter({ hasText: "Menu" })
  await expect(settings.or(menu)).toBeVisible({ timeout: 30000 })
  if (!(await settings.isVisible())) await menu.click()
  await settings.click()
}

test("selects every piece set and board independently, retaining exact profile state through reload", async ({
  page,
}) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  await openSettings(page)
  const original = await savedProfile(page)
  expect(original.settings.chessAppearance).toEqual({
    pieceSetId: "current",
    boardId: "current",
  })
  await openGallery(page, "Pieces")
  await expect(appearanceSection(page).getByRole("radio")).toHaveCount(
    CHESS_PIECE_SETS.length,
  )
  await expectLoadedArtwork(appearanceSection(page))
  await expectAccessibleChoices(page)
  const preview = appearanceSection(page).getByRole("img", {
    name: /board preview/,
  })
  for (const pieces of CHESS_PIECE_SETS) {
    await appearanceSection(page)
      .getByRole("radio", { name: pieces.label, exact: true })
      .check()
    await expect
      .poll(async () => (await savedProfile(page)).settings.chessAppearance)
      .toEqual({ pieceSetId: pieces.id, boardId: "current" })
    if (pieces.kind === "artwork") {
      await expect
        .poll(() => preview.locator("img").first().getAttribute("src"))
        .toContain(pieces.pieces.black.rook.path)
      await expectLoadedArtwork(preview)
    }
  }
  await openGallery(page, "Board")
  await expect(appearanceSection(page).getByRole("radio")).toHaveCount(
    CHESS_BOARDS.length,
  )
  await expectLoadedArtwork(appearanceSection(page))
  await expectAccessibleChoices(page)
  for (const board of CHESS_BOARDS) {
    await appearanceSection(page)
      .getByRole("radio", { name: board.label, exact: true })
      .check()
    await expect
      .poll(async () => (await savedProfile(page)).settings.chessAppearance)
      .toEqual({ pieceSetId: "cat-chess", boardId: board.id })
    if (board.kind === "artwork") {
      await expect
        .poll(() => preview.locator("img").first().getAttribute("src"))
        .toContain(board.image.path)
      await expectLoadedArtwork(preview)
    }
  }
  const after = await savedProfile(page)
  expect({
    ...after,
    revision: original.revision,
    settings: original.settings,
  }).toEqual(original)
  await page.reload()
  await openGallery(page, "Pieces")
  await expect(
    appearanceSection(page).getByRole("radio", {
      name: "Cat chess",
      exact: true,
    }),
  ).toBeChecked()
  await openGallery(page, "Board")
  await expect(
    appearanceSection(page).getByRole("radio", {
      name: "Cat chess · green / white",
      exact: true,
    }),
  ).toBeChecked()
  expect(errors).toEqual([])
})

test("uses two thumbnail columns and keyboard radio selection at 320px", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 915 })
  await page.goto("/")
  await openSettings(page)
  await openGallery(page, "Pieces")
  const choices = appearanceSection(page).getByRole("radio")
  await choices.first().focus()
  await page.keyboard.press("ArrowRight")
  await expect(choices.nth(1)).toBeChecked()
  const tiles = appearanceSection(page).locator("fieldset label")
  const first = await tiles.nth(0).boundingBox()
  const second = await tiles.nth(1).boundingBox()
  expect(first?.y).toBe(second?.y)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await expectLoadedArtwork(appearanceSection(page))
  await appearanceSection(page).screenshot({
    path: testInfo.outputPath("settings-narrow.png"),
  })
})

for (const { mode, color, pieceSetId, boardId } of [
  {
    mode: "Standard Chess Story",
    color: "random",
    pieceSetId: "skoll",
    boardId: "back-h",
  },
  {
    mode: "Chess960 Challenge",
    color: "White",
    pieceSetId: "skoll",
    boardId: "back-h",
  },
  {
    mode: "Chess960 Challenge",
    color: "Black",
    pieceSetId: "skoll",
    boardId: "back-h",
  },
  {
    mode: "Standard Chess Story",
    color: "random",
    pieceSetId: "cosunosuke",
    boardId: "cosunosuke",
  },
  {
    mode: "Chess960 Challenge",
    color: "White",
    pieceSetId: "cosunosuke",
    boardId: "cosunosuke",
  },
  {
    mode: "Chess960 Challenge",
    color: "Black",
    pieceSetId: "cosunosuke",
    boardId: "cosunosuke",
  },
] as const) {
  test(`changes artwork to ${pieceSetId} without replacing the ${mode} ${color} board, selection or accepted hints`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000)
    if (pieceSetId === "cosunosuke" && color === "White")
      await page.setViewportSize({ width: 320, height: 915 })
    await page.goto("/")
    await page.getByRole("button", { name: mode, exact: true }).click()
    if (color !== "random")
      await page.getByRole("radio", { name: color, exact: true }).check()
    await page.getByRole("button", { name: "Start match", exact: true }).click()
    const board = page.getByRole("grid", { name: /Chessboard/ })
    await expect(board.locator('[data-square="e2"]')).toHaveAttribute(
      "aria-disabled",
      "false",
      { timeout: 30000 },
    )
    await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6, {
      timeout: 30000,
    })
    const before = await savedProfile(page)
    const playerColor = before.activeMatch?.playerColor
    expect(playerColor).toBeDefined()
    const pawn = board.getByRole("gridcell", {
      name: playerColor === "white" ? /^e2,/ : /^e7,/,
    })
    await pawn.click()
    await expect(pawn).toHaveAttribute("aria-selected", "true")
    await expect(board.getByRole("gridcell").first()).toHaveAttribute(
      "data-square",
      playerColor === "white" ? "a8" : "h1",
    )
    const element = await board.elementHandle()
    if (element === null) throw new Error("Expected live board")
    const hints = await page
      .locator('[data-hint-kind="move"]')
      .evaluateAll((elements) => elements.map((el) => el.outerHTML))
    const pieces = CHESS_PIECE_SETS.find(({ id }) => id === pieceSetId)
    const boardArt = CHESS_BOARDS.find(({ id }) => id === boardId)
    if (!pieces || !boardArt) throw new Error("Expected catalog fixture")
    await openSettings(page)
    await openGallery(page, "Pieces")
    await appearanceSection(page)
      .getByRole("radio", { name: pieces.label, exact: true })
      .check()
    await openGallery(page, "Board")
    await appearanceSection(page)
      .getByRole("radio", { name: boardArt.label, exact: true })
      .check()
    await expect
      .poll(async () => (await savedProfile(page)).settings.chessAppearance)
      .toEqual({ pieceSetId, boardId })
    await page
      .getByRole("button", { name: "Close Settings", exact: true })
      .click()
    await page.getByLabel("Match menu", { exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Settings", exact: true }),
    ).not.toBeVisible()
    expect(await element.evaluate((node) => node.isConnected)).toBe(true)
    await expect(pawn).toHaveAttribute("aria-selected", "true")
    await expect(pawn).toHaveCSS("box-shadow", /4px/)
    await expect(pawn).toHaveCSS("box-shadow", /6px/)
    await expect(pawn).toHaveCSS("z-index", "10")
    expect(
      await page
        .locator('[data-hint-kind="move"]')
        .evaluateAll((elements) => elements.map((el) => el.outerHTML)),
    ).toEqual(hints)
    expect((await savedProfile(page)).activeMatch).toEqual(before.activeMatch)
    await expect(
      board.locator(`img[src*="${pieceSetId}/pieces/"]`).first(),
    ).toHaveCSS("opacity", "1")
    await expect(board.locator(`img[src$="/boards/${boardId}.png"]`)).toHaveCSS(
      "opacity",
      "1",
    )
    await expectLoadedArtwork(board)
    await board.screenshot({
      path: testInfo.outputPath("board-with-hints.png"),
    })
  })
}

for (const pieceSetId of ["skoll", "cosunosuke"] as const) {
  test(`retains prepared artwork while loading ${pieceSetId}, falls back on failure and retries the saved selection`, async ({
    page,
  }) => {
    const requestGate = Promise.withResolvers<void>()
    await page.route(`**/chess-assets/${pieceSetId}/**`, async (route) => {
      await requestGate.promise
      await route.abort()
    })
    await page.goto("/")
    await openSettings(page)
    await openGallery(page, "Pieces")
    const preview = appearanceSection(page).getByRole("img", {
      name: /board preview/,
    })
    await appearanceSection(page)
      .getByRole("radio", { name: "Chessnut", exact: true })
      .check()
    await expect(preview.locator('img[src*="chessnut"]')).toHaveCount(32)
    await expectLoadedArtwork(preview)
    const pieces = CHESS_PIECE_SETS.find(({ id }) => id === pieceSetId)
    if (!pieces) throw new Error("Expected catalog fixture")
    await appearanceSection(page)
      .getByRole("radio", { name: pieces.label, exact: true })
      .check()
    await expect(preview.locator('img[src*="chessnut"]')).toHaveCount(32)
    await expectLoadedArtwork(preview)
    requestGate.resolve()
    await expect(
      page.getByRole("button", { name: "Retry chess artwork" }),
    ).toBeVisible()
    expect((await savedProfile(page)).settings.chessAppearance.pieceSetId).toBe(
      pieceSetId,
    )
    await expect(preview.locator("img")).toHaveCount(0)
    await page.unroute(`**/chess-assets/${pieceSetId}/**`)
    await page.getByRole("button", { name: "Retry chess artwork" }).click()
    await expect(
      page.getByRole("button", { name: "Retry chess artwork" }),
    ).toHaveCount(0)
    await expect(
      appearanceSection(page)
        .getByRole("img", { name: /board preview/ })
        .locator(`img[src*="${pieceSetId}"]`)
        .first(),
    ).toHaveCSS("opacity", "1")
    await expectLoadedArtwork(appearanceSection(page))
  })
}

test("retains a pending promotion through appearance changes and uses the selected art", async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.goto("/")
  await openSettings(page)
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).check()
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  await expect(page.locator('[data-square="e2"]')).toHaveAttribute(
    "aria-disabled",
    "false",
    { timeout: 30000 },
  )
  const profile = await savedProfile(page)
  const match = profile.activeMatch
  if (match === null) throw new Error("Expected saved match")
  let timeline = createMatchTimeline(
    createInitialMatchPosition(match.startingPosition),
  )
  for (const uci of [
    "a2a4",
    "h7h5",
    "a4a5",
    "h5h4",
    "a5a6",
    "h4h3",
    "a6b7",
    "h3g2",
  ]) {
    const parsed = parseMatchMoveId(uci)
    if (!parsed.ok) throw new Error("Expected fixture move")
    const moved = applyMatchTimelineMove(timeline, parsed.moveId)
    if (!moved.ok) throw new Error("Expected legal fixture move")
    timeline = moved.timeline
  }
  await page.locator("summary").filter({ hasText: "Menu" }).click()
  await page
    .getByRole("button", { name: "Return to Menu", exact: true })
    .click()
  await importPlayerData(page, {
    ...profile,
    activeMatch: {
      ...match,
      cursor: timeline.cursor,
      currentFen: currentMatchPosition(timeline).fen,
      moveIds: timeline.transitions.map(({ move }) => move.id),
      moveFeedback: [],
    },
  })
  const resume = page.getByRole("button", { name: "Resume match", exact: true })
  if (await resume.isVisible()) await resume.click()
  await page.locator('[data-square="b7"]').click()
  await page.locator('[data-square="a8"]').click()
  await expect(
    page.getByRole("dialog", { name: "Promote on a8" }),
  ).toBeVisible()
  await openSettings(page)
  await openGallery(page, "Pieces")
  await appearanceSection(page)
    .getByRole("radio", { name: "Cosunosuke · gold / blue", exact: true })
    .check()
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  const promotion = page.getByRole("dialog", { name: "Promote on a8" })
  await expect(promotion).toBeVisible()
  await expect(promotion.locator('img[src*="cosunosuke"]')).toHaveCount(4)
  await expectLoadedArtwork(promotion)
  await page
    .getByRole("button", { name: "Promote to knight", exact: true })
    .click()
  await expect(page.getByRole("dialog", { name: "Promote on a8" })).toHaveCount(
    0,
  )
  await expect(page.locator('[data-square="a8"]')).toHaveAttribute(
    "aria-label",
    /White knight/,
  )
})

test("restores Cosunosuke choices from a portable backup and displays creator permission in Credits", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Customize profile card", exact: true }),
  ).toBeEnabled()
  const original = await savedProfile(page)
  await importPlayerData(page, {
    ...original,
    settings: {
      ...original.settings,
      chessAppearance: { pieceSetId: "cosunosuke", boardId: "cosunosuke" },
    },
  })
  await page.reload()
  await openSettings(page)
  await openGallery(page, "Pieces")
  await expect(
    appearanceSection(page).getByRole("radio", {
      name: "Cosunosuke · gold / blue",
      exact: true,
    }),
  ).toBeChecked()
  await openGallery(page, "Board")
  await expect(
    appearanceSection(page).getByRole("radio", {
      name: "Cosunosuke · slate",
      exact: true,
    }),
  ).toBeChecked()
  await expectLoadedArtwork(appearanceSection(page))
  await appearanceSection(page).screenshot({
    path: testInfo.outputPath("cosunosuke-settings.png"),
  })
  await page
    .locator("summary")
    .filter({ hasText: /^Credits$/ })
    .click()
  const credit = page.getByRole("listitem").filter({
    has: page.getByRole("heading", {
      name: "32-bit Chess Asset Pack · Cosunosuke",
      exact: true,
    }),
  })
  await expect(credit).toBeVisible()
  await expect(credit.getByRole("link")).toHaveAttribute(
    "href",
    "https://cosunosuke.itch.io/31-bir-chess-asset-pack",
  )
  await expect(credit).toContainText("no standalone asset redistribution")
  await page.setViewportSize({ width: 320, height: 915 })
  await appearanceSection(page).screenshot({
    path: testInfo.outputPath("cosunosuke-settings-narrow.png"),
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
