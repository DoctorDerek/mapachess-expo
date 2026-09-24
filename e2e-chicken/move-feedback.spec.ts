import { expect, test } from "@playwright/test"

for (const width of [412, 1440]) {
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
    await expect(first).toHaveText(
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
    await expect(second).toHaveText(
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
}
