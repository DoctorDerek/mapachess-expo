import AxeBuilder from "@axe-core/playwright"
import { expect } from "@playwright/test"
import { ART_CREDITS } from "../packages/match-presentation/src/artCredits.js"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

for (const width of [320, 1280]) {
  test(`Spanish Credits retains attribution, readable links and language switching at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000)
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    await page
      .getByRole("combobox", { name: "Language" })
      .selectOption("es-419")
    await page.getByRole("button", { name: "Comenzar", exact: true }).click()
    await page
      .getByRole("button", { name: "Configuración", exact: true })
      .click()
    const credits = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: /^Créditos$/ }) })
    await credits.locator("summary").press("Enter")
    await expect(credits).toHaveAttribute("open", "")
    await expect(credits.getByRole("heading", { level: 3 })).toHaveCount(14)
    const original = await savedProfile(page)
    for (const title of [
      "Helado de Mapachito · Dr. Derek Austin",
      "Sprites de animales · SeethingSwarm",
      "Caras de Chess-animals · GreyFox / Kashir0",
      "Iconos de ajedrez de Game-icons · Skoll",
    ])
      await expect(
        credits.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible()
    for (const [index, credit] of Object.values(ART_CREDITS).entries()) {
      const entry = credits.getByRole("listitem").nth(index)
      await expect(entry.getByRole("heading", { level: 3 })).toContainText(
        credit.creator,
      )
      for (const url of new Set([
        credit.licenseUrl,
        ...credit.sources.map((source) => source.url),
      ])) {
        const link = entry.locator(`a[href="${url}"]`)
        await expect(link).toHaveAttribute("target", "_blank")
        await expect(link).toHaveAttribute("rel", "noopener noreferrer")
        await expect(link).toHaveAccessibleName(/se abre en una pestaña nueva/)
      }
    }
    for (const [piece, slug] of [
      ["Rey", "king"],
      ["Dama", "queen"],
      ["Torre", "rook"],
      ["Alfil", "bishop"],
      ["Caballo", "knight"],
      ["Peón", "pawn"],
    ] as const) {
      await expect(
        credits.getByRole("link", { name: new RegExp(`^${piece} ·`) }),
      ).toHaveAttribute(
        "href",
        `https://game-icons.net/1x1/skoll/chess-${slug}.html`,
      )
    }
    await expect(
      credits.getByRole("link", {
        name: /^CC BY 4\.0; condiciones adicionales en la página de origen/,
      }),
    ).toBeVisible()
    await expect(
      credits.getByRole("link", { name: /atribución obligatoria/ }),
    ).toBeVisible()
    await expect(
      credits.getByText(
        "Piezas y tableros de ajedrez convencionales y de fantasía",
        { exact: true },
      ),
    ).toBeVisible()
    await expect(credits).not.toContainText("Licensed game artwork")
    const permission = credits.getByRole("link", {
      name: /^32-bit Chess Asset Pack · Uso en el juego autorizado por el creador;/,
    })
    await permission.scrollIntoViewIfNeeded()
    expect(
      await permission.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await expect(
      credits.getByRole("link", { name: /^Clásicas ·/ }),
    ).toBeVisible()
    await expect(credits.getByRole("link", { name: /^Madera ·/ })).toBeVisible()
    await expect(credits.getByRole("link", { name: /^Hielo ·/ })).toBeVisible()
    const report = await new AxeBuilder({ page })
      .include("dialog details[open]")
      .analyze()
    expect(report.violations).toEqual([])
    await page.screenshot({
      path: testInfo.outputPath(`spanish-credits-permission-${width}.png`),
    })
    await credits.locator("summary").scrollIntoViewIfNeeded()
    await page.screenshot({
      path: testInfo.outputPath(`spanish-credits-start-${width}.png`),
    })
    if (width === 320) {
      const textScale = await page.addStyleTag({
        content: ":root { font-size: 200%; }",
      })
      await permission.scrollIntoViewIfNeeded()
      expect(
        await permission.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true)
      expect(
        await credits.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true)
      await page.screenshot({
        path: testInfo.outputPath("spanish-credits-text-200-percent.png"),
      })
      await textScale.evaluate((element) => element.remove())
    }
    await page.getByRole("combobox", { name: "Idioma" }).selectOption("en")
    await expect(
      page.getByRole("heading", {
        name: "Mapachito ice cream · Dr. Derek Austin",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /^Queen · Game-icons chess icons/ }),
    ).toBeVisible()
    await page
      .getByRole("combobox", { name: "Language" })
      .selectOption("es-419")
    await expect
      .poll(() => savedProfile(page))
      .toEqual({ ...original, revision: original.revision + 2 })
    const close = credits.getByRole("button", {
      name: "Cerrar créditos",
      exact: true,
    })
    await permission.focus()
    for (
      let steps = 0;
      steps < 4 &&
      !(await close.evaluate((element) => element === document.activeElement));
      steps++
    )
      await page.keyboard.press("Tab")
    await expect(close).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(credits).not.toHaveAttribute("open")
    await page
      .getByRole("button", { name: "Cerrar configuración", exact: true })
      .click()
    await expect(
      page.getByRole("dialog", { name: "Personaliza tu juego", exact: true }),
    ).toHaveCount(0)
    await page.reload()
    await expect(page.locator("html")).toHaveAttribute("lang", "es-MX")
    await page
      .getByRole("button", { name: "Configuración", exact: true })
      .click()
    await credits.locator("summary").click()
    await expect(
      credits.getByRole("heading", {
        name: "Helado de Mapachito · Dr. Derek Austin",
        exact: true,
      }),
    ).toBeVisible()
    expect(await savedProfile(page)).toEqual({
      ...original,
      revision: original.revision + 2,
    })
    expect(errors).toEqual([])
  })
}

test("Spanish appearance corrections update choices and previews while preserving stored artwork IDs", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await page.getByRole("combobox", { name: "Language" }).selectOption("es-419")
  await page.getByRole("button", { name: "Comenzar", exact: true }).click()
  await page.getByRole("button", { name: "Configuración", exact: true }).click()
  const appearance = page.getByRole("region", {
    name: "Tablero y piezas",
    exact: true,
  })
  await appearance
    .getByRole("button", { name: "Cambiar piezas", exact: true })
    .click()
  for (const [id, label] of [
    ["toffee-wood", "Toffee · madera"],
    ["toffee-ice", "Toffee · hielo"],
    ["back-fantasy-i-mono", "Fantasía I · blancas / negras"],
    ["back-fantasy-i-color", "Fantasía I · azules / rojas"],
    ["back-fantasy-i-earth", "Fantasía I · amarillas / verdes"],
    ["back-fantasy-ii-plain", "Fantasía II · sencillas"],
    ["back-fantasy-ii-gold", "Fantasía II · oro"],
  ] as const) {
    const choice = appearance.getByRole("radio", { name: label, exact: true })
    await expect(choice).toHaveValue(id)
    await choice.check()
    await expect
      .poll(async () => (await savedProfile(page)).settings.chessAppearance)
      .toEqual({ pieceSetId: id, boardId: "current" })
    await expect(
      appearance.getByRole("img", {
        name: new RegExp(`^Vista previa de las piezas ${label} en el tablero `),
      }),
    ).toBeVisible()
  }
  await page.screenshot({
    path: testInfo.outputPath("spanish-piece-choices-320.png"),
  })
  await appearance
    .getByRole("button", { name: "Cambiar tablero", exact: true })
    .click()
  await appearance
    .getByRole("radio", { name: "Toffee · hielo", exact: true })
    .check()
  await expect
    .poll(async () => (await savedProfile(page)).settings.chessAppearance)
    .toEqual({ pieceSetId: "back-fantasy-ii-gold", boardId: "toffee-ice" })
  const original = await savedProfile(page)
  await page.getByRole("combobox", { name: "Idioma" }).selectOption("en")
  await expect(
    page.getByRole("img", {
      name: /^Fantasy II · gold pieces on Toffee · ice board preview$/,
    }),
  ).toBeVisible()
  await page.getByRole("combobox", { name: "Language" }).selectOption("es-419")
  await expect
    .poll(() => savedProfile(page))
    .toEqual({ ...original, revision: original.revision + 2 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
