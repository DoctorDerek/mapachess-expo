import { expect, type Locator, type Page } from "@playwright/test"
import { activate, injectControllerInput, press } from "./controllerInput.js"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

async function documentBox(control: Locator) {
  return control.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      x: bounds.x + scrollX,
      y: bounds.y + scrollY,
      width: bounds.width,
      height: bounds.height,
    }
  })
}

function expectSameBox(
  actual: Awaited<ReturnType<typeof documentBox>>,
  expected: Awaited<ReturnType<typeof documentBox>>,
) {
  expect(actual.x).toBeCloseTo(expected.x, 2)
  expect(actual.y).toBeCloseTo(expected.y, 2)
  expect(actual.width).toBeCloseTo(expected.width, 2)
  expect(actual.height).toBeCloseTo(expected.height, 2)
}

async function startManualGame(page: Page, spanish = false, timed = false) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  if (spanish)
    await page
      .getByRole("combobox", { name: "Language" })
      .selectOption("es-419")
  await page
    .getByRole("button", { name: spanish ? "Comenzar" : "Start", exact: true })
    .click()
  await page
    .getByRole("button", {
      name: spanish ? "Configuración" : "Settings",
      exact: true,
    })
    .click()
  await page
    .getByRole("radio", {
      name: spanish ? "Sin pistas automáticas" : "No Auto Hints",
      exact: true,
    })
    .check()
  await page
    .getByRole("button", {
      name: spanish ? "Cerrar configuración" : "Close Settings",
      exact: true,
    })
    .click()
  await page
    .getByRole("button", {
      name: spanish
        ? "Desafío de ajedrez estándar"
        : "Standard Chess Challenge",
      exact: true,
    })
    .click()
  await page
    .getByRole("radio", { name: spanish ? "Blancas" : "White", exact: true })
    .check()
  if (timed) {
    await page
      .getByRole("button", { name: "Change time control", exact: true })
      .click()
    await page.getByRole("radio", { name: "Blitz · 3+2", exact: true }).check()
    await page.getByRole("button", { name: "Done", exact: true }).click()
  }
  await page
    .getByRole("button", {
      name: spanish ? "Iniciar partida" : "Start match",
      exact: true,
    })
    .click()
  await expect(
    page.getByRole("button", {
      name: spanish
        ? "Pedir pista Mostrar Pistas de piezas"
        : "Get Hint Show Piece Hints",
      exact: true,
    }),
  ).toBeEnabled({ timeout: 30000 })
}

for (const configuration of [
  { width: 320, spanish: false, fontSize: 16 },
  { width: 390, spanish: true, fontSize: 16 },
  { width: 320, spanish: true, fontSize: 32 },
  { width: 1280, spanish: false, fontSize: 16 },
]) {
  test(`compact hints and eligibility help remain legible at ${configuration.width}px / ${configuration.fontSize}px text / ${configuration.spanish ? "es-MX" : "en"}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60000)
    const { spanish, width, fontSize } = configuration
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await startManualGame(page, spanish)
    await page.addStyleTag({ content: `html { font-size: ${fontSize}px; }` })
    await expect
      .poll(() =>
        page
          .locator("html")
          .evaluate((element) => getComputedStyle(element).fontSize),
      )
      .toBe(`${fontSize}px`)
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
    })
    await expect(page.getByRole("grid")).toHaveCSS("font-size", `${fontSize}px`)
    await expect(page.locator("#opponent-band-title strong").first()).toHaveCSS(
      "font-size",
      `${fontSize}px`,
    )
    const hint = page.locator('[data-player-action="hints"]')
    const help = page.getByRole("button", {
      name: spanish ? "Explicar las pistas automáticas" : "Explain Auto-Hints",
      exact: true,
    })
    const checkEligibility = async (
      tier: "gold" | "silver" | "bronze",
      description: string,
    ) => {
      await help.click()
      const eligibility = page.getByRole("dialog").getByRole("status")
      await expect(eligibility).toHaveText(description)
      const medal = eligibility.locator('img[aria-hidden="true"]')
      await expect(medal).toHaveAttribute(
        "src",
        new RegExp(`/${tier}\\.[^/]+\\.png$`),
      )
      await expect
        .poll(() =>
          medal.evaluate(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0,
          ),
        )
        .toBe(true)
      const close = page.getByRole("dialog").getByRole("button", {
        name: spanish ? "Cerrar" : "Close",
        exact: true,
      })
      await expect(close).toBeInViewport()
      await close.click()
      await expect(help).toBeFocused()
      await expect(eligibility).toHaveCount(0)
    }
    await checkEligibility(
      "gold",
      spanish
        ? "Oro si ganas · No usaste pistas"
        : "Gold if you win · No hints used",
    )
    const initialHintBox = await documentBox(hint)
    const board = page.getByRole("grid")
    const initialBoardBox = await documentBox(board)
    await hint.click()
    await expect(hint).toHaveAccessibleName(
      spanish
        ? "Pedir pista Mostrar Pistas de movimientos"
        : "Get Hint Show Move Hints",
    )
    await expect(page.locator('[data-hint-kind="source"]')).toHaveCount(6)
    await checkEligibility(
      "silver",
      spanish
        ? "Plata si ganas · Usaste Pistas de piezas · sin Pistas de movimientos"
        : "Silver if you win · Piece Hints used · no Move Hints",
    )
    expectSameBox(await documentBox(hint), initialHintBox)
    await hint.click()
    await expect(hint).toHaveAccessibleName(
      spanish
        ? "Pedir pista Pistas de movimientos visibles"
        : "Get Hint Move Hints Shown",
    )
    await expect(hint).toBeDisabled()
    await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6)
    await checkEligibility(
      "bronze",
      spanish
        ? "Bronce si ganas · Usaste Pistas de movimientos"
        : "Bronze if you win · Move Hints used",
    )
    expectSameBox(await documentBox(hint), initialHintBox)
    expectSameBox(await documentBox(board), initialBoardBox)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    const auto = page.getByRole("button", {
      name: spanish ? "Pistas auto: No" : "Auto Hints: Off",
      exact: true,
    })
    for (const control of [hint, auto, help]) {
      expect(
        await control.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true)
      const bounds = await documentBox(control)
      expect(bounds.height).toBeGreaterThanOrEqual(64)
      expect(bounds.width).toBeGreaterThanOrEqual(44)
    }
    expect((await documentBox(help)).width).toBeGreaterThanOrEqual(64)
    expect((await documentBox(help)).height).toBe(
      (await documentBox(auto)).height,
    )
    await expect(page.locator('[data-player-action="controls"]')).toHaveCount(0)
    await auto.click()
    const picker = page.getByRole("dialog", {
      name: spanish ? "Pistas automáticas" : "Auto-Hints",
      exact: true,
    })
    await expect(picker.getByRole("radio")).toHaveCount(3)
    await picker
      .getByRole("radio", {
        name: spanish ? "Pistas de piezas automáticas" : "Auto Piece Hints",
        exact: true,
      })
      .check()
    await picker
      .getByRole("radio", {
        name: spanish ? "Sin pistas automáticas" : "No Auto Hints",
        exact: true,
      })
      .check()
    await page.keyboard.press("Escape")
    await expect(picker).toHaveCount(0)
    await expect(auto).toBeFocused()
    await checkEligibility(
      "bronze",
      spanish
        ? "Bronce si ganas · Usaste Pistas de movimientos"
        : "Bronze if you win · Move Hints used",
    )
    expect((await savedProfile(page)).activeMatch).toMatchObject({
      pieceHintsUsed: true,
      moveHintsUsed: true,
      autoHintMode: "no-auto-hints",
    })
    expectSameBox(await documentBox(hint), initialHintBox)
    expect(errors).toEqual([])
    await page.screenshot({
      path: testInfo.outputPath("hint-controls.png"),
      fullPage: true,
    })
  })
}

test("hint dialogs reuse Back/Forward, controller cancel and explicit clock resume while keeping clocks above Top feedback", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000)
  await injectControllerInput(page)
  await page.setViewportSize({ width: 390, height: 900 })
  await startManualGame(page, false, true)
  const auto = page.getByRole("button", {
    name: "Auto Hints: Off",
    exact: true,
  })
  const help = page.getByRole("button", {
    name: "Explain Auto-Hints",
    exact: true,
  })
  const picker = page.getByRole("dialog", { name: "Auto-Hints", exact: true })
  const before = (await savedProfile(page)).activeMatch
  await activate(page, auto)
  await expect(picker).toBeVisible()
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.clock?.paused)
    .toBe(true)
  await picker
    .getByRole("button", { name: "Explain Auto-Hints", exact: true })
    .click()
  await expect(
    picker.getByText("Hints never reduce XP.", { exact: true }),
  ).toBeVisible()
  await press(page, 1)
  await expect(picker.getByRole("radio")).toHaveCount(3)
  await page.goBack()
  await expect(picker).toHaveCount(0)
  await expect(auto).toBeFocused()
  await page.goForward()
  await expect(picker.getByRole("radio")).toHaveCount(3)
  await page.keyboard.press("Escape")
  await expect(picker).toHaveCount(0)
  await help.click()
  await expect(
    picker.getByRole("button", { name: "Close", exact: true }),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(picker).toHaveCount(0)
  await expect(help).toBeFocused()
  expect((await savedProfile(page)).activeMatch).toMatchObject({
    currentFen: before?.currentFen,
    pieceHintsUsed: false,
    moveHintsUsed: false,
  })
  await page.getByRole("button", { name: "Resume clocks", exact: true }).click()
  await page
    .getByRole("button", { name: "Get Hint Show Piece Hints", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Get Hint Show Move Hints", exact: true }),
  ).toBeEnabled()
  expect((await savedProfile(page)).activeMatch?.clock?.paused).toBe(false)
  await page.getByRole("gridcell", { name: /^e2,/ }).click()
  await page.getByRole("gridcell", { name: /^e4,/ }).click()
  const feedback = page.getByRole("button", { name: /^Dismiss / })
  await expect(feedback).toHaveCount(2)
  const feedbackTop = Math.min(
    ...(await Promise.all(
      (await feedback.all()).map(async (card) => (await documentBox(card)).y),
    )),
  )
  for (const timer of await page.getByRole("timer").all()) {
    const bounds = await documentBox(timer)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(feedbackTop)
  }
  await page.screenshot({
    path: testInfo.outputPath("protected-clocks.png"),
    fullPage: true,
  })
})
