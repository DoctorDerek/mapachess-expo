import AxeBuilder from "@axe-core/playwright"
import { expect } from "@playwright/test"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

for (const spanish of [false, true]) {
  test(`${spanish ? "Mexican Spanish" : "American English"} explains presets in setup and preserves the accepted control across navigation and rewards`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width: 320, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    if (spanish)
      await page
        .getByRole("combobox", { name: "Language" })
        .selectOption("es-419")
    await page
      .getByRole("button", {
        name: spanish ? "Comenzar" : "Start",
        exact: true,
      })
      .click()
    await page
      .getByRole("button", {
        name: spanish ? "Historia de ajedrez estándar" : "Standard Chess Story",
        exact: true,
      })
      .click()
    const change = page.getByRole("button", {
      name: spanish ? "Cambiar control de tiempo" : "Change time control",
      exact: true,
    })
    const done = page.getByRole("button", {
      name: spanish ? "Listo" : "Done",
      exact: true,
    })
    await change.click()
    const picker = page.getByRole("dialog", {
      name: spanish ? "Control de tiempo" : "Time control",
      exact: true,
    })
    const presets: readonly (readonly [string, string])[] = spanish
      ? [
          ["Sin reloj", "Sin reloj. Tómate tu tiempo para explorar."],
          [
            "Bala · 1+0",
            "1 minuto por jugador. No se añade tiempo después de las jugadas. Las pistas no pausan el reloj.",
          ],
          [
            "Bala · 2+1",
            "2 minutos por jugador. Cada jugada añade 1 segundo al reloj de quien mueve. Las pistas no pausan el reloj.",
          ],
          [
            "Relámpago · 3+2",
            "3 minutos por jugador. Cada jugada añade 2 segundos al reloj de quien mueve. Las pistas no pausan el reloj.",
          ],
          [
            "Relámpago · 5+0",
            "5 minutos por jugador. No se añade tiempo después de las jugadas. Las pistas no pausan el reloj.",
          ],
          [
            "Rápido · 10+0",
            "10 minutos por jugador. No se añade tiempo después de las jugadas. Las pistas no pausan el reloj.",
          ],
        ]
      : [
          ["Untimed", "No clock. Take your time and explore."],
          [
            "Bullet · 1+0",
            "1 minute per player. No time is added after moves. Hints do not pause the clock.",
          ],
          [
            "Bullet · 2+1",
            "2 minutes per player. Each move adds 1 second to that player’s clock. Hints do not pause the clock.",
          ],
          [
            "Blitz · 3+2",
            "3 minutes per player. Each move adds 2 seconds to that player’s clock. Hints do not pause the clock.",
          ],
          [
            "Blitz · 5+0",
            "5 minutes per player. No time is added after moves. Hints do not pause the clock.",
          ],
          [
            "Rapid · 10+0",
            "10 minutes per player. No time is added after moves. Hints do not pause the clock.",
          ],
        ]
    for (const [label, explanation] of presets) {
      await picker.getByRole("radio", { name: label, exact: true }).check()
      await expect(picker.getByRole("status")).toHaveText(explanation)
    }
    await picker
      .getByRole("radio", {
        name: spanish ? "Sin reloj" : "Untimed",
        exact: true,
      })
      .check()
    await expect(picker.getByRole("status")).toHaveText(
      spanish
        ? "Sin reloj. Tómate tu tiempo para explorar."
        : "No clock. Take your time and explore.",
    )
    const acceptedLabel = spanish ? "Bala · 2+1" : "Bullet · 2+1"
    await picker
      .getByRole("radio", { name: acceptedLabel, exact: true })
      .check()
    expect(
      (await new AxeBuilder({ page }).include("dialog[open]").analyze())
        .violations,
    ).toEqual([])
    await page.screenshot({
      path: testInfo.outputPath("setup-explanation.png"),
    })
    await done.click()
    await page
      .getByRole("button", {
        name: spanish ? "Iniciar partida" : "Start match",
        exact: true,
      })
      .click()
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      acceptedLabel,
    )
    await expect(
      page.getByText(
        /Hints do not pause the clock|Las pistas no pausan el reloj/,
      ),
    ).toHaveCount(0)
    await page.goBack()
    await change.click()
    await picker
      .getByRole("radio", {
        name: spanish ? "Relámpago · 3+2" : "Blitz · 3+2",
        exact: true,
      })
      .check()
    await done.click()
    await page
      .getByRole("button", {
        name: spanish ? "Todos los modos de juego" : "All game modes",
        exact: true,
      })
      .click()
    const resume = page.getByRole("button", {
      name: `${spanish ? "Reanudar partida" : "Resume match"} ${acceptedLabel}`,
      exact: true,
    })
    await expect(resume).toBeVisible()
    await resume.click()
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      acceptedLabel,
    )
    expect((await savedProfile(page)).activeMatch?.timeControl).toEqual({
      type: "fischer",
      baseSeconds: 120,
      incrementSeconds: 1,
    })
    await page
      .getByLabel(spanish ? "Menú de partida" : "Match menu", { exact: true })
      .click()
    await page
      .getByText(
        spanish
          ? "Detalles de la partida e historial de jugadas"
          : "Match details & Move History",
        { exact: true },
      )
      .click()
    await expect(
      page.getByRole("definition").filter({ hasText: acceptedLabel }),
    ).toBeVisible()
    await page
      .getByRole("button", {
        name: spanish ? "Rendirse" : "Resign",
        exact: true,
      })
      .click()
    const rewards = page.getByRole("dialog")
    await expect(
      rewards.getByText(acceptedLabel, { exact: true }),
    ).toBeVisible()
    await expect(
      rewards.getByText(
        /Hints do not pause the clock|Las pistas no pausan el reloj/,
      ),
    ).toHaveCount(0)
    await page.screenshot({
      path: testInfo.outputPath("accepted-control-rewards.png"),
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}
