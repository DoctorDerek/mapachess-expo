import { expect } from "@playwright/test"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

for (const labels of [
  {
    locale: "en",
    start: "Start",
    settings: "Settings",
    language: "Language",
    noAutoHints: "No Auto Hints",
    closeSettings: "Close Settings",
    challenge: "Standard Chess Challenge",
    white: "White",
    startMatch: "Start match",
  },
  {
    locale: "es-419",
    start: "Comenzar",
    settings: "Configuración",
    language: "Idioma",
    noAutoHints: "Sin pistas automáticas",
    closeSettings: "Cerrar configuración",
    challenge: "Desafío de ajedrez estándar",
    white: "Blancas",
    startMatch: "Iniciar partida",
  },
] as const) {
  test(`a repeatable formatter failure cannot lock out ${labels.locale} or erase a match`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.addInitScript(() => {
      Object.defineProperty(Intl, "NumberFormat", {
        configurable: true,
        value: class BrokenNumberFormat {
          constructor() {
            throw new Error("Injected number formatter failure")
          }
        },
      })
    })
    await page.goto("/")
    await page
      .getByRole("combobox", { name: "Language" })
      .selectOption(labels.locale)
    await expect
      .poll(async () => (await savedProfile(page)).settings.locale)
      .toBe(labels.locale)
    await page.getByRole("button", { name: labels.start, exact: true }).click()
    await page
      .getByRole("button", { name: labels.settings, exact: true })
      .click()
    await expect(
      page.getByRole("combobox", { name: labels.language }),
    ).toHaveValue(labels.locale)
    await page
      .getByRole("radio", { name: labels.noAutoHints, exact: true })
      .check()
    await page
      .getByRole("button", { name: labels.closeSettings, exact: true })
      .click()
    await page
      .getByRole("button", { name: labels.challenge, exact: true })
      .click()
    await page.getByRole("radio", { name: labels.white, exact: true }).check()
    await page
      .getByRole("button", { name: labels.startMatch, exact: true })
      .click()
    const e2 = page.getByRole("gridcell", { name: /^e2,/ })
    await expect(e2).toHaveAttribute("aria-disabled", "false", {
      timeout: 30000,
    })
    await e2.click()
    await page.getByRole("gridcell", { name: /^e4,/ }).click()
    await expect
      .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
        timeout: 30000,
      })
      .toBe(2)
    expect(
      await page.getByText("Text unavailable", { exact: true }).count(),
    ).toBeGreaterThan(0)
    await expect
      .poll(
        async () =>
          (await savedProfile(page)).activeMatch?.moveFeedback?.length,
        { timeout: 30000 },
      )
      .toBe(2)
    const before = await savedProfile(page)
    await page.reload()
    await expect(e2).toHaveAttribute("aria-disabled", "false", {
      timeout: 30000,
    })
    expect(await savedProfile(page)).toEqual(before)
    expect(before.settings.locale).toBe(labels.locale)
    expect(errors).toEqual([])
  })
}
