import { expect, test } from "@playwright/test"

for (const width of [320, 412, 1440]) {
  test(`fresh move feedback stays centered and sequential at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto("/")
    await page.getByRole("button", { name: /Standard Challenge/ }).click()
    await page.getByRole("radio", { name: "White", exact: true }).check()
    await page.getByRole("button", { name: /Start match/ }).click()
    const board = page.getByRole("grid", { name: /Chessboard/ })
    const meter = page.getByRole("meter", { name: "Stockfish evaluation" })
    await expect(meter).toHaveAttribute("aria-valuetext", /White|Black|Even/)
    const before = await board.boundingBox()
    if (before === null) throw new Error("Board must be rendered")
    if (width < 1280) expect(before.width).toBe(width)

    await page.getByRole("gridcell", { name: /^e2,/ }).click()
    await page.getByRole("gridcell", { name: /^e4,/ }).click()
    const first = page.getByRole("button", { name: /^Dismiss White • / })
    await expect(first).toBeVisible()
    await expect(first.locator("span").nth(1)).toHaveText(
      /^White • (Brilliant !!|Genius !|Best ★|Good ✓|Inaccuracy \?!|Mistake \?|Blunder \?\?)$/,
    )
    const firstSeen = Date.now()
    const gradeBox = await first.boundingBox()
    if (gradeBox === null) throw new Error("Reaction must be rendered")
    expect(gradeBox.x + gradeBox.width / 2).toBeCloseTo(
      before.x + before.width / 2,
      0,
    )
    expect(await board.boundingBox()).toEqual(before)
    await expect(first).toBeVisible()

    const second = page.getByRole("button", { name: /^Dismiss Black • / })
    await expect(second).toBeVisible({ timeout: 7000 })
    const secondSeen = Date.now()
    expect(secondSeen - firstSeen).toBeGreaterThan(4500)
    expect(await board.boundingBox()).toEqual(before)
    await expect(second.locator("span").nth(1)).toHaveText(
      /^Black • (Brilliant !!|Genius !|Best ★|Good ✓|Inaccuracy \?!|Mistake \?|Blunder \?\?)$/,
    )
    await expect(second).toHaveCount(0, { timeout: 7000 })
    expect(Date.now() - secondSeen).toBeGreaterThan(4500)
    expect(await board.boundingBox()).toEqual(before)
    await expect(page.getByText("Your move.", { exact: true })).toHaveCount(0)

    await page.reload()
    await expect(board).toBeVisible()
    await expect(page.getByRole("button", { name: /^Dismiss / })).toHaveCount(0)
    await page.getByLabel("Match menu", { exact: true }).click()
    await page
      .getByText("Match details & Move History", { exact: true })
      .click()
    const history = page.getByRole("region", { name: "Move History" })
    await expect(history).toContainText("White •")
    await expect(history).toContainText("Black •")
    await expect(history).not.toContainText("Lost forced mate")
  })

  test(`fast pairs retain both colors and tapping advances one move at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto("/")
    await page.getByRole("button", { name: /Standard Challenge/ }).click()
    await page.getByRole("radio", { name: "White", exact: true }).check()
    await page.getByRole("button", { name: /Start match/ }).click()
    const board = page.getByRole("grid", { name: /Chessboard/ })
    await expect(page.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      /White|Black|Even/,
    )
    const before = await board.boundingBox()
    await page.getByRole("gridcell", { name: /^e2,/ }).click()
    await page.getByRole("gridcell", { name: /^e4,/ }).click()
    const feedback = page.getByRole("button", { name: /^Dismiss / })
    await expect(feedback).toHaveAccessibleName(/^Dismiss Black • /, {
      timeout: 12000,
    })
    await page.getByRole("gridcell", { name: /^g1,/ }).click()
    await page.getByRole("gridcell", { name: /^f3,/ }).click()
    await expect(feedback).toHaveAccessibleName(
      /^Dismiss Black • .+ Waiting: White 1, Black 1\.$/,
    )
    await expect(feedback.locator("span").first()).toBeVisible()
    await expect(feedback.locator("span").nth(2)).toBeVisible()
    expect(await board.boundingBox()).toEqual(before)
    const layers = await feedback.evaluate((button) => {
      const reactionLayer = button.parentElement!
      const strip = reactionLayer.parentElement!
      const score = strip.querySelector(":scope > span")!
      const buttonBox = button.getBoundingClientRect()
      const scoreBox = score.getBoundingClientRect()
      const stripBox = strip.getBoundingClientRect()
      return {
        scoreCenterY: scoreBox.y + scoreBox.height / 2,
        reactionCenterY: buttonBox.y + buttonBox.height / 2,
        stripHeight: stripBox.height,
        reactionHeight: buttonBox.height,
        scoreLayer: Number(getComputedStyle(score).zIndex),
        reactionLayer: Number(getComputedStyle(reactionLayer).zIndex),
      }
    })
    expect(layers.scoreCenterY).toBe(layers.reactionCenterY)
    expect(layers.stripHeight).toBe(layers.reactionHeight)
    expect(layers.reactionLayer).toBeGreaterThan(layers.scoreLayer)
    const countdown = feedback.locator("span").last()
    await expect(countdown).toHaveCSS("background-image", /linear-gradient/)
    await expect
      .poll(() =>
        countdown.evaluate(
          (element) => new DOMMatrix(getComputedStyle(element).transform).a,
        ),
      )
      .toBeLessThan(0.85)
    await page.screenshot({
      path: testInfo.outputPath(`reaction-backlog-${String(width)}.png`),
    })
    // Clicking Black's count must still advance to the waiting White move.
    await feedback.locator("span").nth(2).click()
    await expect(feedback).toHaveAccessibleName(
      /^Dismiss White • .+ Waiting: White 0, Black 1\.$/,
    )
    await expect(feedback.locator("span").first()).toBeHidden()
    expect(await board.boundingBox()).toEqual(before)
    await feedback.press("Enter")
    await expect(feedback).toHaveAccessibleName(
      /^Dismiss Black • .+ Waiting: White 0, Black 0\.$/,
    )
    await page.emulateMedia({ reducedMotion: "reduce" })
    await expect(countdown).toBeHidden()
    await feedback.press("Space")
    await expect(feedback).toHaveCount(0)
    expect(await board.boundingBox()).toEqual(before)
    await page.getByLabel("Match menu", { exact: true }).click()
    await page
      .getByText("Match details & Move History", { exact: true })
      .click()
    const history = page.getByRole("region", { name: "Move History" })
    await expect(history.getByText(/White •/)).toHaveCount(2)
    await expect(history.getByText(/Black •/)).toHaveCount(2)
  })
}
