import { expect } from "@playwright/test"
import { parseMatchMoveId } from "../packages/match/src/matchMove.js"
import { createInitialMatchPosition } from "../packages/match/src/matchPosition.js"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  currentMatchPosition,
} from "../packages/match/src/matchTimeline.js"
import prepareControllerInput, { activate, press } from "./controllerInput.js"
import { test } from "./fixtures.js"
import importPlayerData from "./importPlayerData.js"
import savedProfile from "./savedProfile.js"

test.beforeEach(prepareControllerInput)

for (const mode of [
  "Standard Chess Story",
  "Chess960 Story",
  "Standard Chess Challenge",
  "Chess960 Challenge",
]) {
  test(`operates ${mode} setup and preserves Back/Forward without changing saves`, async ({
    page,
  }) => {
    await activate(page, page.getByRole("button", { name: mode, exact: true }))
    await expect(
      page.getByRole("button", { name: "Start match", exact: true }),
    ).toBeVisible()
    if (mode === "Chess960 Challenge") {
      const position = page.getByRole("spinbutton")
      const before = await position.inputValue()
      await activate(page, position)
      await press(page, 15)
      expect(await position.inputValue()).toBe(
        String(Math.min(959, Number(before) + 10)),
      )
      await press(page, 1)
      expect(await position.inputValue()).toBe(before)
      await activate(page, position)
      await press(page, 12)
      await press(page, 0)
      expect(await position.inputValue()).toBe(
        String(Math.min(959, Number(before) + 1)),
      )
    }
    const before = await savedProfile(page)
    await press(page, 1)
    await expect(
      page.getByRole("button", { name: mode, exact: true }),
    ).toBeVisible()
    expect(await savedProfile(page)).toEqual(before)
    await page.goForward()
    await expect(
      page.getByRole("button", { name: "Start match", exact: true }),
    ).toBeVisible()
  })
}

test("routes board focus, own-piece cycling, hints, menu and nested Back without click-through", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000)
  await activate(
    page,
    page.getByRole("button", { name: "Settings", exact: true }),
  )
  await activate(
    page,
    page.getByRole("radio", { name: "No Auto Hints", exact: true }),
  )
  await press(page, 1)
  await activate(
    page,
    page.getByRole("button", { name: "Standard Chess Challenge", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Start match", exact: true }),
  )
  const e2 = page.getByRole("gridcell", { name: /^e2, White pawn/ })
  await expect(e2).toHaveAttribute("aria-disabled", "false", { timeout: 30000 })
  await press(page, 3)
  await expect(
    page.getByRole("gridcell", { name: /^e1, White king/ }),
  ).toBeFocused()
  await press(page, 12)
  await expect(e2).toBeFocused()
  const before = await savedProfile(page)
  await press(page, 5)
  await expect(
    page.getByRole("gridcell", { name: /^f2, White pawn/ }),
  ).toBeFocused()
  await press(page, 4)
  await expect(e2).toBeFocused()
  expect(await savedProfile(page)).toEqual(before)
  await press(page, 0)
  await expect(e2).toHaveAttribute("aria-selected", "true")
  await press(page, 1)
  await expect(e2).toHaveAttribute("aria-selected", "false")
  await expect(page.getByRole("grid")).toBeVisible()
  await press(page, 2)
  await expect(
    page.getByRole("button", { name: /Show Move Hints/ }),
  ).toBeEnabled({ timeout: 30000 })
  await press(page, 2)
  await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6)
  await expect(
    page.locator('img[src="/input-prompts/steamdeck_button_x.png"]'),
  ).toBeVisible()
  const board = page.getByRole("grid")
  const geometry = await board.boundingBox()
  await page.screenshot({
    path: testInfo.outputPath("controller-board-1280.png"),
  })
  await press(page, 9)
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible()
  expect(await board.boundingBox()).toEqual(geometry)
  await activate(
    page,
    page.getByRole("button", { name: "Settings", exact: true }),
  )
  await expect(
    page.getByRole("dialog", { name: "Your game customization" }),
  ).toBeVisible()
  await press(page, 1)
  await expect(
    page.getByRole("dialog", { name: "Your game customization" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible()
  await press(page, 1)
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeHidden()
  await expect(page.getByRole("grid")).toBeVisible()
})

test("starts a match by directional navigation without programmatic focus or pointer input", async ({
  page,
}) => {
  await press(page, 13)
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeFocused()
  await press(page, 13)
  await expect(
    page.getByRole("button", { name: "Standard Chess Challenge", exact: true }),
  ).toBeFocused()
  await press(page, 14)
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toBeFocused()
  await press(page, 0)
  const start = page.getByRole("button", { name: "Start match", exact: true })
  for (
    let step = 0;
    step < 8 &&
    !(await start.evaluate((element) => element === document.activeElement));
    step++
  )
    await press(page, 13)
  await expect(
    page.getByRole("button", { name: "Start match", exact: true }),
  ).toBeFocused()
  await press(page, 0)
  await expect(page.getByRole("grid")).toBeVisible()
})

test("executes a move, Undo, Redo and result review through canonical controller actions", async ({
  page,
}) => {
  test.setTimeout(90000)
  await activate(
    page,
    page.getByRole("button", { name: "Standard Chess Challenge", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Start match", exact: true }),
  )
  const e2 = page.getByRole("gridcell", { name: /^e2, White pawn/ })
  await expect(e2).toHaveAttribute("aria-disabled", "false", { timeout: 30000 })
  await press(page, 3)
  await press(page, 12)
  await expect(e2).toBeFocused()
  await press(page, 0)
  await press(page, 12)
  await press(page, 12)
  await press(page, 0)
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
      timeout: 30000,
    })
    .toBe(2)
  const moved = (await savedProfile(page)).activeMatch
  await press(page, 3)
  await expect(page.getByRole("button", { name: "Focus board" })).toBeFocused()
  await press(page, 15)
  await expect(page.getByRole("button", { name: /Undo/ })).toBeFocused()
  await press(page, 0)
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.cursor)
    .toBe(0)
  await press(page, 15)
  await expect(page.getByRole("button", { name: /Redo/ })).toBeFocused()
  await press(page, 0)
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.currentFen)
    .toBe(moved?.currentFen)
  await press(page, 9)
  await activate(page, page.getByRole("button", { name: /Resign/ }))
  const review = page.getByRole("button", { name: "Review board", exact: true })
  await expect(review).toBeVisible()
  const completed = await savedProfile(page)
  await press(page, 1)
  await expect(review).toHaveCount(0)
  await activate(
    page,
    page.getByRole("button", { name: "View rewards", exact: true }),
  )
  await expect(review).toBeVisible()
  await press(page, 1)
  expect(await savedProfile(page)).toEqual(completed)
})

test("retains black orientation and skips locked animal choices", async ({
  page,
}) => {
  test.setTimeout(60000)
  await activate(
    page,
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  )
  await activate(page, page.getByRole("button", { name: /^Play as Raccoon/ }))
  const chooser = page.getByRole("dialog", { name: "Play as", exact: true })
  await expect(chooser.getByRole("radio", { name: /Chicken/ })).toBeDisabled()
  for (const button of [12, 15, 13, 14]) {
    await press(page, button)
    expect(await page.locator(":focus").getAttribute("disabled")).toBeNull()
    expect(
      await chooser.evaluate((root) => root.contains(document.activeElement)),
    ).toBe(true)
  }
  await press(page, 1)
  await press(page, 1)
  await activate(
    page,
    page.getByRole("button", { name: "Standard Chess Challenge", exact: true }),
  )
  await activate(page, page.getByRole("radio", { name: "Black", exact: true }))
  await activate(
    page,
    page.getByRole("button", { name: "Start match", exact: true }),
  )
  const e7 = page.getByRole("gridcell", { name: /^e7, Black pawn/ })
  await expect(e7).toHaveAttribute("aria-disabled", "false", { timeout: 30000 })
  await press(page, 3)
  await expect(
    page.getByRole("gridcell", { name: /^e8, Black king/ }),
  ).toBeFocused()
  await press(page, 12)
  await expect(e7).toBeFocused()
  await press(page, 5)
  await expect(
    page.getByRole("gridcell", { name: /^d7, Black pawn/ }),
  ).toBeFocused()
})

test("keeps promotion modal input isolated and accepts the chosen piece", async ({
  page,
}) => {
  test.setTimeout(60000)
  await activate(
    page,
    page.getByRole("button", { name: "Standard Chess Challenge", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Start match", exact: true }),
  )
  await expect(page.getByRole("gridcell", { name: /^e2,/ })).toHaveAttribute(
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
  await press(page, 9)
  await activate(
    page,
    page.getByRole("button", { name: "Return to Menu", exact: true }),
  )
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
  const b7 = page.getByRole("gridcell", { name: /^b7, White pawn/ })
  await expect(b7).toHaveAttribute("aria-disabled", "false", { timeout: 30000 })
  await activate(page, b7)
  await press(page, 12)
  await press(page, 14)
  await press(page, 0)
  const promotion = page.getByRole("dialog", { name: "Promote on a8" })
  await expect(promotion).toBeVisible()
  await press(page, 9)
  await expect(promotion).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(promotion).toHaveCount(0)
  await expect(page.getByRole("grid")).toBeVisible()
  await activate(page, b7)
  await press(page, 12)
  await press(page, 14)
  await press(page, 0)
  await expect(promotion).toBeVisible()
  await activate(
    page,
    page.getByRole("button", { name: "Promote to knight", exact: true }),
  )
  await expect(promotion).toHaveCount(0)
  await expect(
    page.getByRole("gridcell", { name: /^a8, White knight/ }),
  ).toBeVisible()
})

test("castles a Chess960 king through the ordinary controller move path", async ({
  page,
}) => {
  test.setTimeout(60000)
  await activate(
    page,
    page.getByRole("button", { name: "Chess960 Challenge", exact: true }),
  )
  await page.getByRole("spinbutton").fill("518")
  await page.getByRole("spinbutton").press("Tab")
  await activate(
    page,
    page.getByRole("button", { name: "Start match", exact: true }),
  )
  await expect(page.getByRole("gridcell", { name: /^e2,/ })).toHaveAttribute(
    "aria-disabled",
    "false",
    { timeout: 30000 },
  )
  const profile = await savedProfile(page)
  const match = profile.activeMatch
  if (match === null) throw new Error("Expected saved Chess960 match")
  let timeline = createMatchTimeline(
    createInitialMatchPosition(match.startingPosition),
  )
  for (const uci of ["e2e4", "e7e5", "g1f3", "b8c6", "f1e2", "g8f6"]) {
    const parsed = parseMatchMoveId(uci)
    if (!parsed.ok) throw new Error("Expected fixture move")
    const moved = applyMatchTimelineMove(timeline, parsed.moveId)
    if (!moved.ok) throw new Error("Expected legal fixture move")
    timeline = moved.timeline
  }
  await press(page, 9)
  await activate(
    page,
    page.getByRole("button", { name: "Return to Menu", exact: true }),
  )
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
  const king = page.getByRole("gridcell", { name: /^e1, White king/ })
  await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6, {
    timeout: 30000,
  })
  await expect(king).toHaveAttribute("aria-disabled", "false", {
    timeout: 30000,
  })
  await activate(page, king)
  await expect(king).toHaveAttribute("aria-selected", "true")
  await press(page, 15)
  await press(page, 15)
  await expect(page.getByRole("gridcell", { name: /^g1, empty/ })).toBeFocused()
  await press(page, 0)
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.moveIds[6])
    .toBe("e1h1")
  await expect(
    page.getByRole("gridcell", { name: /^g1, White king/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("gridcell", { name: /^f1, White rook/ }),
  ).toBeVisible()
})
