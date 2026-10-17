import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"
import { test } from "../e2e/fixtures.js"
import savedProfile from "../e2e/savedProfile.js"

async function startChallenge(page: Page, color: "White" | "Black") {
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page
    .getByRole("radio", { name: "Auto Piece Hints", exact: true })
    .check()
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()
  await page.getByRole("radio", { name: color, exact: true }).check()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Show Move Hints", exact: true }),
  ).toBeVisible()
}

async function expectBothSidesHints(page: Page) {
  const sources = page.locator('[data-hint-kind="source"]')
  await expect(sources).toHaveCount(6)
  for (const owner of ["player", "opponent"]) {
    await expect(
      page.locator(`[data-hint-kind="source"][data-hint-owner="${owner}"]`),
    ).toHaveCount(3)
  }
  const sourceIdentity = await sources.evaluateAll((elements) =>
    elements
      .map((element) =>
        [
          element.getAttribute("data-hint-owner"),
          element.getAttribute("data-source-x"),
          element.getAttribute("data-source-y"),
        ].join(":"),
      )
      .sort(),
  )
  await page
    .getByRole("button", { name: "Show Move Hints", exact: true })
    .click()
  const moves = page.locator('[data-hint-kind="move"]')
  await expect(moves).toHaveCount(6)
  expect(
    await moves.evaluateAll((elements) =>
      elements
        .map((element) =>
          [
            element.getAttribute("data-hint-owner"),
            element.getAttribute("data-source-x"),
            element.getAttribute("data-source-y"),
          ].join(":"),
        )
        .sort(),
    ),
  ).toEqual(sourceIdentity)
}

for (const color of ["White", "Black"] as const) {
  test(`real Chicken play as ${color} preserves hints and exact Undo/Redo through reload`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: color === "White" ? 1280 : 1279,
      height: 900,
    })
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await startChallenge(page, color)
    await expectBothSidesHints(page)
    const initial = await savedProfile(page)
    const original = initial.activeMatch
    if (original === null) throw new Error("Expected accepted match")
    expect(original.pieceHintsUsed).toBe(true)
    expect(original.moveHintsUsed).toBe(true)
    const origin = page.getByRole("gridcell", {
      name: new RegExp(`^${color === "White" ? "e2" : "e7"},`),
    })
    const destination = page.getByRole("gridcell", {
      name: new RegExp(`^${color === "White" ? "e4" : "e5"},`),
    })
    await origin.focus()
    await expect(origin).toHaveAttribute("tabindex", "0")
    await origin.press("Enter")
    await expect(origin).toHaveAttribute("aria-selected", "true")
    await destination.focus()
    await expect(destination).toHaveAttribute("tabindex", "0")
    await destination.press("Enter")
    await expect
      .poll(async () => (await savedProfile(page)).activeMatch?.cursor)
      .toBe(original.cursor + 2)
    await expect(
      page.getByRole("button", { name: /Show Move Hints$/ }),
    ).toBeVisible()
    const played = (await savedProfile(page)).activeMatch
    await page.getByRole("button", { name: /Undo$/ }).click()
    await expect
      .poll(async () => (await savedProfile(page)).activeMatch?.cursor)
      .toBe(original.cursor)
    await expect(page.getByRole("button", { name: /Redo$/ })).toBeEnabled()
    const undone = await savedProfile(page)
    await page.reload()
    await expect(
      page.getByRole("button", { name: "Redo", exact: true }),
    ).toBeEnabled()
    expect((await savedProfile(page)).activeMatch).toEqual(undone.activeMatch)
    await page.getByRole("button", { name: "Redo", exact: true }).click()
    await expect
      .poll(async () => (await savedProfile(page)).activeMatch?.currentFen)
      .toBe(played?.currentFen)
    expect((await savedProfile(page)).activeMatch?.moveIds).toEqual(
      played?.moveIds,
    )
    await expect(page.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      /White|Black|Even/,
    )
    const board = await page.getByRole("grid").boundingBox()
    const meter = await page.getByRole("meter").boundingBox()
    if (board === null || meter === null)
      throw new Error("Expected visible board and evaluation")
    expect(meter.width).toBeCloseTo(board.width, 1)
    expect(meter.y + meter.height).toBeCloseTo(board.y, 1)
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([])
    expect(errors).toEqual([])
  })
}

test("restart creates a fresh match, Back preserves it, and explicit exit clears the slot", async ({
  page,
}) => {
  await startChallenge(page, "White")
  const before = (await savedProfile(page)).activeMatch
  await page.getByLabel("Match menu", { exact: true }).click()
  await page.getByRole("button", { name: "Restart Match", exact: true }).click()
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.matchId)
    .not.toBe(before?.matchId)
  await expect(page.getByRole("grid")).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Show Move Hints$/ }),
  ).toBeVisible()
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.pieceHintsUsed)
    .toBe(true)
  const restarted = (await savedProfile(page)).activeMatch
  expect(restarted?.moveIds).toEqual([])
  await page.goBack()
  await expect(
    page.getByRole("button", { name: "Resume match Untimed", exact: true }),
  ).toBeVisible()
  expect((await savedProfile(page)).activeMatch).toEqual(restarted)
  await page
    .getByRole("button", { name: "Resume match Untimed", exact: true })
    .click()
  await expect(page.getByRole("grid")).toBeVisible()
  expect((await savedProfile(page)).activeMatch).toEqual(restarted)
  await page.getByLabel("Match menu", { exact: true }).click()
  await page
    .getByRole("button", { name: "Return to Menu", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Start match", exact: true }),
  ).toBeEnabled()
  expect((await savedProfile(page)).activeMatch).toBeNull()
})

test("Story replay opens setup without starting another match or changing earned progress", async ({
  page,
}) => {
  await page.goto("/")
  await page
    .getByRole("button", { name: "Standard Chess Story", exact: true })
    .click()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  await expect(page.getByRole("grid")).toBeVisible()
  await page.getByLabel("Match menu", { exact: true }).click()
  await page.getByRole("button", { name: "Resign", exact: true }).click()
  const rewards = page.getByRole("dialog")
  await expect(rewards).toBeVisible()
  const completed = await savedProfile(page)
  await rewards
    .getByRole("button", { name: /^Replay opponent Chicken Stockfish/ })
    .click()
  await expect(
    page.getByRole("heading", { name: "Standard Chess Story", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Start match", exact: true }),
  ).toBeEnabled()
  expect(await savedProfile(page)).toEqual({
    ...completed,
    activeMatch: null,
    revision: completed.revision + 1,
  })
})

test("an accepted Chicken draw remains durable after rewards dismissal and reload", async ({
  page,
}) => {
  await startChallenge(page, "White")
  await expect(page.getByRole("meter")).toHaveAttribute(
    "aria-valuetext",
    /White|Black|Even/,
  )
  await page.getByLabel("Match menu", { exact: true }).click()
  const offer = page.getByRole("button", { name: "Offer Draw", exact: true })
  await expect(offer).toBeEnabled()
  await offer.click()
  await expect(
    page.getByRole("dialog", { name: "Draw by agreement.", exact: true }),
  ).toBeVisible()
  const completed = await savedProfile(page)
  expect(completed.activeMatch?.conclusion).toEqual({ type: "draw-agreement" })
  await page.getByRole("button", { name: "Review board", exact: true }).click()
  await page.reload()
  await expect(
    page.getByRole("region", { name: "Match result", exact: true }),
  ).toContainText("Draw by agreement.")
  expect(await savedProfile(page)).toEqual(completed)
})
