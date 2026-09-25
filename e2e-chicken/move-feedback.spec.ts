import { expect, test, type Page } from "@playwright/test"

const startMatch = async (page: Page, color: "White" | "Black") => {
  await page.goto("/")
  await page.getByRole("button", { name: /Standard Challenge/ }).click()
  await page.getByRole("radio", { name: color, exact: true }).check()
  await page.getByRole("button", { name: /Start match/ }).click()
  await expect(page.getByRole("meter")).toHaveAttribute(
    "aria-valuetext",
    /White|Black|Even/,
  )
}

const playMove = async (page: Page, from: string, to: string) => {
  const origin = page.getByRole("gridcell", { name: new RegExp(`^${from},`) })
  await expect(origin).toHaveAttribute("aria-disabled", "false")
  await origin.click()
  await expect(origin).toHaveAttribute("aria-selected", "true")
  await page.getByRole("gridcell", { name: new RegExp(`^${to},`) }).click()
}

test("timeline navigation clears cards without replaying retained grades", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.clock.install()
  await startMatch(page, "White")
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await playMove(page, "e2", "e4")
  const cards = page.getByRole("button", { name: /^Dismiss / })
  await expect(cards).toHaveCount(2)
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(cards).toHaveCount(0)
  await page.getByRole("button", { name: "Redo", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Redo", exact: true }),
  ).toBeDisabled()
  await page.clock.runFor(100)
  await expect(cards).toHaveCount(0)
  await page.getByLabel("Match menu", { exact: true }).click()
  await page.getByText("Match details & Move History", { exact: true }).click()
  await expect(
    page.getByRole("region", { name: "Move History" }).locator("strong"),
  ).toHaveCount(2)
})

for (const width of [320, 412, 1280, 1440]) {
  test(`both real moves are readable concurrently without layout shift at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 915 })
    await startMatch(page, "White")
    const board = page.getByRole("grid", { name: /Chessboard/ })
    const before = await board.boundingBox()
    if (before === null) throw new Error("Board must be rendered")
    if (width < 1280) expect(before.width).toBe(width)

    await playMove(page, "e2", "e4")
    const white = page.getByRole("button", { name: /^Dismiss White 1\. e4 / })
    const black = page.getByRole("button", { name: /^Dismiss Black 1\.\.\. / })
    await expect(white).toBeVisible()
    const whiteSeen = Date.now()
    await expect(black).toBeVisible()
    const blackSeen = Date.now()
    await expect(white).toBeVisible()
    expect(blackSeen - whiteSeen).toBeLessThan(4500)
    expect(await board.boundingBox()).toEqual(before)

    const whiteBox = await white.boundingBox()
    const blackBox = await black.boundingBox()
    if (whiteBox === null || blackBox === null)
      throw new Error("Both participant cards must be rendered")
    expect(whiteBox.x + whiteBox.width).toBeLessThan(blackBox.x)
    expect(whiteBox.y).toBeCloseTo(blackBox.y, 0)
    expect(whiteBox.y).toBeLessThan(before.y)
    await expect(white).toHaveCSS("background-color", "rgb(255, 255, 255)")
    await expect(black).toHaveCSS("background-color", "rgb(30, 30, 30)")
    await expect(white).toHaveText(
      /^1\. e4 (Brilliant !!|Genius !|Best ★|Good ✓|Inaccuracy \?!|Mistake \?|Blunder \?\?)$/,
    )
    const countdown = white.locator('[aria-hidden="true"]')
    await expect(countdown).toHaveCSS("background-image", /linear-gradient/)
    await expect
      .poll(() =>
        countdown.evaluate(
          (element) => new DOMMatrix(getComputedStyle(element).transform).a,
        ),
      )
      .toBeLessThan(0.9)
    await page.screenshot({
      path: testInfo.outputPath(`real-pair-${width}.png`),
    })

    await expect(white).toHaveCount(0, { timeout: 7000 })
    expect(Date.now() - whiteSeen).toBeGreaterThan(4400)
    await expect(black).toHaveCount(0, { timeout: 7000 })
    expect(Date.now() - blackSeen).toBeGreaterThan(4400)
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
    await expect(history).toContainText("1. e4")
    await expect(history).toContainText("1...")
    await expect(history.locator("strong")).toHaveCount(2)
    await expect(history).not.toContainText("Lost forced mate")
  })
}

for (const configuration of [
  { width: 320, fontSize: 16, color: "White" },
  { width: 412, fontSize: 24, color: "White" },
  { width: 1440, fontSize: 16, color: "White" },
  { width: 412, fontSize: 16, color: "Black" },
  { width: 320, fontSize: 24, color: "Black" },
] as const) {
  test(`rapid real moves stack down independently at ${configuration.width}px ${configuration.fontSize}px ${configuration.color}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: configuration.width, height: 915 })
    const reducedMotion = configuration.width !== 1440
    await page.emulateMedia({
      reducedMotion: reducedMotion ? "reduce" : "no-preference",
    })
    await page.clock.install()
    await startMatch(page, configuration.color)
    if (configuration.color === "Black")
      await expect(
        page.getByRole("button", { name: /^Dismiss White 1\. / }),
      ).toBeVisible()
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}px`
    }, configuration.fontSize)
    await page.clock.pauseAt(new Date(Date.now() + 1000))
    const board = page.getByRole("grid", { name: /Chessboard/ })
    const before = await board.boundingBox()
    const opponent = configuration.color === "White" ? "Black" : "White"
    const heroCards = page.getByRole("button", {
      name: new RegExp(`^Dismiss ${configuration.color} `),
    })
    const opponentCards = page.getByRole("button", {
      name: new RegExp(`^Dismiss ${opponent} `),
    })
    const moves =
      configuration.color === "White"
        ? ([
            ["e2", "e4"],
            ["g1", "f3"],
            ["f1", "c4"],
          ] as const)
        : ([
            ["e7", "e5"],
            ["g8", "f6"],
            ["f8", "c5"],
          ] as const)
    for (const [index, [from, to]] of moves.entries()) {
      await playMove(page, from, to)
      await expect(heroCards).toHaveCount(index + 1)
      await expect(opponentCards).toHaveCount(
        index + (configuration.color === "White" ? 1 : 2),
      )
      await page.clock.runFor(200)
    }
    expect(await board.boundingBox()).toEqual(before)
    await expect(heroCards.nth(0)).toHaveAccessibleName(
      new RegExp(`^Dismiss ${configuration.color} 3\\.`),
    )
    await expect(heroCards.nth(2)).toHaveAccessibleName(
      new RegExp(`^Dismiss ${configuration.color} 1\\.`),
    )
    const heroBox = await heroCards.first().boundingBox()
    const opponentBox = await opponentCards.first().boundingBox()
    const lastBox = await heroCards.last().boundingBox()
    if (!before || !heroBox || !opponentBox || !lastBox)
      throw new Error("Stack geometry must be rendered")
    expect(heroBox.x + heroBox.width).toBeLessThan(opponentBox.x)
    expect(lastBox.y).toBeGreaterThan(heroBox.y)
    expect(lastBox.y + lastBox.height).toBeGreaterThan(before.y)
    for (const card of await page
      .getByRole("button", { name: /^Dismiss / })
      .all()) {
      expect(
        await card.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true)
      if (reducedMotion)
        await expect(card.locator('[aria-hidden="true"]')).toBeHidden()
      else await expect(card.locator('[aria-hidden="true"]')).toBeVisible()
    }
    await page.screenshot({ path: testInfo.outputPath("real-rapid-stack.png") })
    const underlyingSquare = await page.evaluate(
      ({ x, y }) =>
        document
          .elementFromPoint(x, y)
          ?.closest('[role="gridcell"]')
          ?.getAttribute("aria-label"),
      { x: heroBox.x + heroBox.width + 2, y: before.y + 10 },
    )
    expect(underlyingSquare).toBeDefined()
    await heroCards.nth(1).click()
    await expect(heroCards).toHaveCount(2)
    expect(await opponentCards.first().boundingBox()).toEqual(opponentBox)
    await page.keyboard.press("Tab")
    await opponentCards.first().focus()
    await expect(opponentCards.first()).toBeFocused()
    await expect(opponentCards.first()).toHaveCSS("outline-width", "2px")
    await expect(opponentCards.first()).toHaveCSS("outline-offset", "-2px")
    await opponentCards.first().press("Enter")
    await expect(opponentCards).toHaveCount(
      configuration.color === "White" ? 2 : 3,
    )
    expect(await board.boundingBox()).toEqual(before)
    await heroCards.first().press("Space")
    await expect(heroCards).toHaveCount(1)
    await page.getByLabel("Match menu", { exact: true }).click()
    await expect(page.getByRole("button", { name: /^Dismiss / })).toHaveCount(0)
    await page
      .getByText("Match details & Move History", { exact: true })
      .click()
    await expect(
      page.getByRole("region", { name: "Move History" }).locator("strong"),
    ).toHaveCount(configuration.color === "White" ? 6 : 7)
  })
}
