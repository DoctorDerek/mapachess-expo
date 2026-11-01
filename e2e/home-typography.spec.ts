import { expect } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import { MATCH_MODE_CHOICES } from "../packages/match/src/matchSetup.js"
import { test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

for (const width of [320, 390, 430, 1279, 1280]) {
  for (const locale of ["en", "es-419"] as const) {
    test(`Card-first Home reflows in ${locale} at ${width}px`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.goto("/")
      if (locale !== "en") {
        await page
          .getByRole("button", { name: "Settings", exact: true })
          .click()
        await page
          .getByRole("combobox", { name: "Language" })
          .selectOption(locale)
        await page
          .getByRole("button", { name: "Cerrar configuración", exact: true })
          .click()
      }
      const copy = loadCatalog(locale)
      const home = page.getByRole("region", { name: "Mapachess", exact: true })
      await expect(
        home.getByRole("button", { name: copy.interface.webGame.resumeMatch }),
      ).toHaveCount(0)
      const wordmark = page
        .getByRole("heading", { name: "Mapachess", exact: true })
        .getByText("Mapachess", { exact: true })
      await expect(
        home.getByRole("button", {
          name: copy.setup.customizeProfile,
          exact: true,
        }),
      ).toBeEnabled()
      const before = await savedProfile(page)
      for (const percent of [100, 200]) {
        const scale = await page.addStyleTag({
          content: `:root { font-size: ${percent}%; }`,
        })
        await expect(home).toBeVisible()
        await page.evaluate(() => document.fonts.ready)
        const font = await home.evaluate((element) => {
          const family = getComputedStyle(document.documentElement)
            .getPropertyValue("--font-nunito-sans")
            .trim()
          return {
            family,
            applied: getComputedStyle(element).fontFamily,
            loaded: [...document.fonts].some(
              (face) =>
                face.status === "loaded" &&
                family.split(",")[0]?.replaceAll('"', "").trim() ===
                  face.family.replaceAll('"', ""),
            ),
          }
        })
        expect(font.family).not.toBe("")
        expect(font.applied.replaceAll('"', "")).toBe(
          font.family.replaceAll('"', ""),
        )
        expect(font.loaded).toBe(true)
        await expect(wordmark).toHaveCSS("font-family", font.applied)
        await expect(home.locator("dl")).toHaveCSS(
          "background-color",
          "rgb(255, 230, 82)",
        )
        if (percent === 100) {
          const lines = await wordmark.evaluate((element) => {
            const range = document.createRange()
            range.selectNodeContents(element)
            return new Set(
              [...range.getClientRects()]
                .filter(({ width }) => width > 0)
                .map(({ top }) => top),
            ).size
          })
          expect(lines).toBe(1)
        }
        await expect(home.getByRole("button")).toHaveCount(6)
        for (const { variant, mode } of MATCH_MODE_CHOICES) {
          await expect(
            home.getByRole("button", {
              name: copy.setup.presentations[variant][mode].title,
              exact: true,
            }),
          ).toBeEnabled()
          if (locale === "en" && variant === "chess960") {
            const label = home
              .getByRole("button", {
                name: copy.setup.presentations[variant][mode].title,
                exact: true,
              })
              .getByText("Chess960", { exact: true })
            expect(
              await label.evaluate((element) => {
                const range = document.createRange()
                range.selectNodeContents(element)
                return range.getClientRects().length
              }),
            ).toBe(1)
          }
        }
        const bounds = await home.evaluate((element) => {
          const overflowing = [...element.querySelectorAll("button, dt, dd")]
            .filter((node) => {
              const rect = node.getBoundingClientRect()
              return (
                rect.left < 0 ||
                rect.right > window.innerWidth + 1 ||
                node.scrollWidth > node.clientWidth + 1
              )
            })
            .map((node) => ({
              text: node.textContent,
              width: node.clientWidth,
              contentWidth: node.scrollWidth,
              font: getComputedStyle(node).fontSize,
              padding: getComputedStyle(node).paddingInline,
            }))
          const buttons = [...element.querySelectorAll("button")].map(
            (button) => button.getBoundingClientRect(),
          )
          const card = element.querySelector("section")!.getBoundingClientRect()
          const mode = element
            .querySelectorAll("button")[2]!
            .getBoundingClientRect()
          const secondMode = element
            .querySelectorAll("button")[3]!
            .getBoundingClientRect()
          return {
            overflowing,
            minHeight: Math.min(...buttons.map((button) => button.height)),
            cardBottom: card.bottom,
            cardLeft: card.left,
            modeTop: mode.top,
            modeLeft: mode.left,
            secondModeTop: secondMode.top,
          }
        })
        await page.screenshot({
          path: testInfo.outputPath(`home-${percent}.png`),
          fullPage: true,
        })
        expect(bounds.overflowing).toEqual([])
        expect(bounds.minHeight).toBeGreaterThanOrEqual(48)
        if (width < 1280) expect(bounds.cardBottom).toBeLessThan(bounds.modeTop)
        else expect(bounds.cardLeft).toBeLessThan(bounds.modeLeft)
        if (percent === 100) expect(bounds.secondModeTop).toBe(bounds.modeTop)
        await scale.evaluate((element) => element.remove())
      }
      expect(await savedProfile(page)).toEqual(before)
      expect(errors).toEqual([])
    })
  }
}

test("all four mode buttons retain their setup and return paths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto("/")
  const copy = loadCatalog("en")
  await expect(
    page.getByRole("button", { name: "Customize profile card", exact: true }),
  ).toBeEnabled()
  const before = await savedProfile(page)
  const wordmark = page.getByText("Mapachess", { exact: true })
  await page.evaluate(() => document.fonts.ready)
  const homeTitleStyle = await wordmark.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      family: style.fontFamily,
      size: style.fontSize,
      weight: style.fontWeight,
      color: style.color,
    }
  })
  await page.getByRole("heading", { name: "Mapachess", exact: true }).focus()
  for (const name of [
    "Settings",
    "Customize profile card",
    "Share profile card",
  ]) {
    await page.keyboard.press("Tab")
    await expect(page.getByRole("button", { name, exact: true })).toBeFocused()
  }
  for (const { variant, mode } of MATCH_MODE_CHOICES) {
    await page.keyboard.press("Tab")
    await expect(
      page.getByRole("button", {
        name: copy.setup.presentations[variant][mode].title,
        exact: true,
      }),
    ).toBeFocused()
  }
  for (const { variant, mode } of MATCH_MODE_CHOICES) {
    const title = copy.setup.presentations[variant][mode].title
    await page.getByRole("button", { name: title, exact: true }).click()
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible()
    await expect(wordmark).toHaveCount(1)
    await expect(wordmark).toHaveCSS("font-family", homeTitleStyle.family)
    await expect(wordmark).toHaveCSS("font-size", homeTitleStyle.size)
    await expect(wordmark).toHaveCSS("font-weight", homeTitleStyle.weight)
    await expect(wordmark).toHaveCSS("color", homeTitleStyle.color)
    await page
      .getByRole("button", { name: "All game modes", exact: true })
      .click()
    await expect(
      page.getByRole("button", { name: title, exact: true }),
    ).toBeEnabled()
  }
  expect(await savedProfile(page)).toEqual(before)
})

test("a missing font leaves Home and mode selection usable", async ({
  page,
}) => {
  await page.route("**/*.woff2", (route) => route.abort())
  await page.goto("/")
  await page
    .getByRole("button", { name: "Standard Chess Story", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Standard Chess Story", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "All game modes", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Share profile card", exact: true }),
  ).toBeEnabled()
  await page
    .getByRole("button", { name: "Share profile card", exact: true })
    .click()
  await page.getByRole("button", { name: "PNG · Still", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Save PNG", exact: true }),
  ).toBeEnabled()
})
