import { expect } from "@playwright/test"
import { firstArrivalTest as test } from "./fixtures.js"
import chooseDressingCategory from "./profileDressingRoom.js"
import savedProfile from "./savedProfile.js"

test("Mexican Spanish preserves Chess960 through language changes, hints and rewards without replacing player data", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await page.getByRole("combobox", { name: "Language" }).selectOption("es-419")
  await expect(page.locator("html")).toHaveAttribute("lang", "es-MX")
  await page.getByRole("button", { name: "Comenzar", exact: true }).click()
  await page.getByRole("button", { name: "Configuración", exact: true }).click()
  await page
    .getByRole("radio", { name: "Sin pistas automáticas", exact: true })
    .check()
  await page
    .getByRole("button", { name: "Cerrar configuración", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Desafío de ajedrez 960", exact: true })
    .click()
  await expect(
    page.getByRole("group", {
      name: "Posición inicial de ajedrez 960",
      exact: true,
    }),
  ).toBeVisible()
  await page
    .getByRole("spinbutton", {
      name: "Número de posición (0–959)",
      exact: true,
    })
    .fill("959")
  await page.screenshot({
    path: testInfo.outputPath("spanish-chess960-setup.png"),
    fullPage: true,
  })
  await page.getByRole("radio", { name: "Blancas", exact: true }).check()
  await page
    .getByRole("button", { name: "Iniciar partida", exact: true })
    .click()
  const board = page.getByRole("grid", {
    name: "Tablero de ajedrez, blancas abajo",
    exact: true,
  })
  const e2 = page.getByRole("gridcell", { name: /^e2, peón de las blancas/ })
  await expect(e2).toHaveAttribute("aria-disabled", "false", { timeout: 30000 })
  await e2.click()
  await page.getByRole("gridcell", { name: /^e4,/ }).click()
  await expect
    .poll(
      async () => (await savedProfile(page)).activeMatch?.moveFeedback?.length,
      {
        timeout: 30000,
      },
    )
    .toBe(2)
  await page
    .getByRole("button", { name: "Mostrar Pistas de piezas", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Mostrar Pistas de movimientos", exact: true })
    .click()
  await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6)
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.moveHintsUsed)
    .toBe(true)
  await expect(board).toBeVisible()
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const name of [
      "Enfocar el tablero",
      "Deshacer",
      "Rehacer",
      "Pistas de movimientos visibles",
    ]) {
      const action = page.getByRole("button", { name: new RegExp(`${name}$`) })
      await expect(action).toBeVisible()
      expect(
        await action.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true)
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`spanish-match-hints-${width}.png`),
      fullPage: true,
    })
  }
  const before = await savedProfile(page)
  expect(before.activeMatch?.startingPosition).toEqual({
    variant: "chess960",
    chess960PositionId: 959,
  })
  await page.locator("summary").filter({ hasText: "Menú" }).click()
  await page.getByRole("button", { name: "Configuración", exact: true }).click()
  await page.getByRole("combobox", { name: "Idioma" }).selectOption("en")
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  await expect(
    page.getByRole("dialog", { name: "Your game customization", exact: true }),
  ).toBeVisible()
  await page.getByRole("combobox", { name: "Language" }).selectOption("es-419")
  await expect(page.locator("html")).toHaveAttribute("lang", "es-MX")
  await expect
    .poll(() => savedProfile(page))
    .toEqual({
      ...before,
      revision: before.revision + 2,
    })
  await page
    .getByRole("button", { name: "Cerrar configuración", exact: true })
    .click()
  await expect(
    page.getByRole("dialog", { name: "Personaliza tu juego", exact: true }),
  ).toHaveCount(0)
  await page.reload()
  await expect(board).toBeVisible({ timeout: 30000 })
  expect((await savedProfile(page)).activeMatch).toEqual(before.activeMatch)
  expect((await savedProfile(page)).settings.locale).toBe("es-419")
  await page.getByRole("button", { name: "Rendirse", exact: true }).click()
  await expect(
    page.getByRole("dialog", {
      name: "Te rendiste. Pollo Stockfish ganó.",
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByText("Te rendiste. Pollo Stockfish ganó.", { exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath("spanish-rewards.png"),
    fullPage: true,
  })
  await page
    .getByRole("button", { name: "Revisar tablero", exact: true })
    .click()
  const completed = await savedProfile(page)
  await page
    .getByRole("button", { name: "Ver recompensas", exact: true })
    .click()
  await expect(
    page.getByRole("dialog", {
      name: "Te rendiste. Pollo Stockfish ganó.",
      exact: true,
    }),
  ).toBeVisible()
  expect(await savedProfile(page)).toEqual(completed)
  expect(errors).toEqual([])
})

for (const width of [390, 1280]) {
  test(`Mexican Spanish introduction, settings and profile card remain usable at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    await page
      .getByRole("combobox", { name: "Language" })
      .selectOption("es-419")
    await expect(
      page.getByRole("region", { name: "Introducción", exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath(`spanish-introduction-${width}.png`),
      fullPage: true,
    })
    await page.getByRole("button", { name: "Comenzar", exact: true }).click()
    await expect(
      page.getByRole("button", {
        name: "Historia de ajedrez estándar",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Desafío de ajedrez 960", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", {
        name: "Historia de ajedrez 960",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("term").filter({ hasText: /^Elo de ajedrez 960/ }),
    ).toHaveText(/^Elo de ajedrez 960\s*Sin reloj · Bronce$/)
    await page.screenshot({
      path: testInfo.outputPath(`spanish-menu-${width}.png`),
      fullPage: true,
    })
    const before = await savedProfile(page)
    await page
      .getByRole("button", {
        name: "Personalizar tarjeta de perfil",
        exact: true,
      })
      .click()
    await chooseDressingCategory(page, "Weapons", "es-419")
    await expect(
      page.getByRole("button", { name: "Espada", exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath(`spanish-dressing-${width}.png`),
      fullPage: true,
    })
    await page
      .getByRole("button", { name: "Cancelar cambios", exact: true })
      .click()
    await expect(
      page.getByRole("region", {
        name: "Personalizar tarjeta de perfil",
        exact: true,
      }),
    ).toHaveCount(0)
    await page
      .getByRole("button", { name: "Compartir tarjeta de perfil", exact: true })
      .click()
    await page
      .getByRole("button", { name: "PNG · Imagen fija", exact: true })
      .click()
    await expect(
      page.getByRole("button", { name: "Guardar PNG", exact: true }),
    ).toBeEnabled()
    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "Guardar PNG", exact: true }).click()
    await (
      await download
    ).saveAs(testInfo.outputPath(`spanish-profile-${width}.png`))
    await page.getByRole("button", { name: "Atrás", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Guardar PNG", exact: true }),
    ).toHaveCount(0)
    await page
      .getByRole("button", { name: "Configuración", exact: true })
      .click()
    await expect(page.getByRole("combobox", { name: "Idioma" })).toHaveValue(
      "es-419",
    )
    await page
      .getByText("¿Cómo se clasifican las jugadas?", { exact: true })
      .click()
    await expect(
      page.getByRole("columnheader", { name: "Significado", exact: true }),
    ).toBeVisible()
    const lostMateRows = page.getByRole("row").filter({
      has: page.getByRole("rowheader", {
        name: /^Quien mueve pierde un mate forzado verificado/u,
      }),
    })
    await expect(lostMateRows).toHaveCount(3)
    await expect(lostMateRows.getByRole("cell")).toHaveText([
      "Imprecisión ?!",
      "Error ?",
      "Error grave ??",
    ])
    const fasterMate = page.getByRole("rowheader", {
      name: "El mate forzado de quien mueve requiere dos o más jugadas completas menos de lo previsto por la cuenta regresiva normalizada",
      exact: true,
    })
    await fasterMate.scrollIntoViewIfNeeded()
    await expect(fasterMate).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath(`spanish-mate-guide-${width}.png`),
      fullPage: true,
    })
    await lostMateRows.last().scrollIntoViewIfNeeded()
    await page.screenshot({
      path: testInfo.outputPath(`spanish-lost-mate-guide-${width}.png`),
      fullPage: true,
    })
    await page
      .getByRole("button", {
        name: "Cerrar clasificaciones de jugadas",
        exact: true,
      })
      .click()
    await page.screenshot({
      path: testInfo.outputPath(`spanish-settings-${width}.png`),
      fullPage: true,
    })
    await page
      .getByRole("button", { name: "Cerrar configuración", exact: true })
      .click()
    expect(await savedProfile(page)).toEqual(before)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}

test.describe("Mexican Spanish device preferences", () => {
  test.use({ locale: "es-MX", reducedMotion: "reduce" })
  test("resolves after boot without changing the static English baseline", async ({
    page,
  }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const response = await page.goto("/")
    if (response === null) throw new Error("Expected the document response")
    expect(await response.text()).toContain('lang="en"')
    await expect(
      page.getByRole("button", { name: "Comenzar", exact: true }),
    ).toBeVisible()
    await expect(page.locator("html")).toHaveAttribute("lang", "es-MX")
    await page.getByRole("button", { name: "Comenzar", exact: true }).click()
    await expect
      .poll(async () => (await savedProfile(page)).settings.locale)
      .toBe("es-419")
    expect(errors).toEqual([])
  })
})
