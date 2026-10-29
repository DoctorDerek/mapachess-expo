import AxeBuilder from "@axe-core/playwright"
import { expect } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import localizeArtCredits from "../packages/match-presentation/src/artCredits.js"
import { activate, injectControllerInput, press } from "./controllerInput.js"
import { test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

for (const locale of ["en", "es-419"] as const) {
  test(`focused customization keeps Done reachable and returns one level in ${locale}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    await page.getByRole("button", { name: "Settings", exact: true }).click()
    await page
      .getByRole("combobox", { name: "Language", exact: true })
      .selectOption(locale)
    const copy = loadCatalog(locale)
    await expect
      .poll(async () => (await savedProfile(page)).settings.locale)
      .toBe(locale)
    for (const kind of ["coach", "pieces", "board"] as const) {
      await expect
        .poll(() =>
          page
            .getByRole("heading", {
              level: 3,
              name: copy.profile.customization[kind].label,
              exact: true,
            })
            .evaluate(
              (heading) =>
                heading.getBoundingClientRect().height <=
                Number.parseFloat(getComputedStyle(heading).lineHeight) + 1,
            ),
        )
        .toBe(true)
      const trigger = page.getByRole("button", {
        name: copy.profile.customization[kind].change,
        exact: true,
      })
      await trigger.click()
      const dialog = page.getByRole("dialog", {
        name: copy.profile.customization[kind].label,
        exact: true,
      })
      const done = dialog.getByRole("button", {
        name: copy.profile.customization[kind].done,
        exact: true,
      })
      await dialog.getByRole("radio").nth(1).check()
      const selected = await savedProfile(page)
      for (const size of [
        { width: 320, height: 640, scale: 100 },
        { width: 844, height: 390, scale: 100 },
        { width: 320, height: 640, scale: 200 },
      ]) {
        await page.setViewportSize(size)
        const textScale = await page.addStyleTag({
          content: `:root{font-size:${size.scale}%}`,
        })
        await page.mouse.move(0, 0)
        for (const end of [false, true]) {
          await dialog
            .getByRole("heading", {
              name: copy.profile.customization[kind].label,
              exact: true,
            })
            .locator("..")
            .evaluate((element, end) => {
              element.scrollTop = end ? element.scrollHeight : 0
            }, end)
          await expect(done).toBeInViewport({ ratio: 1 })
          await done.focus()
          expect(
            await done.evaluate((element) => {
              const r = element.getBoundingClientRect()
              return element.contains(
                document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + r.height / 2,
                ),
              )
            }),
          ).toBe(true)
        }
        await textScale.evaluate((element) => element.remove())
      }
      await page.goBack()
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await page.goForward()
      await expect(dialog).toBeVisible()
      await done.click()
      await expect(trigger).toBeFocused()
      expect(await savedProfile(page)).toEqual(selected)
    }
    await page
      .getByRole("button", {
        name: copy.interface.moveClassificationFaq.howAreMovesClassified,
        exact: true,
      })
      .click()
    await page.addStyleTag({ content: ":root{font-size:200%}" })
    const back = page.getByRole("button", {
      name: copy.interface.moveClassificationFaq.closeMoveClassifications,
      exact: true,
    })
    await expect(back).toBeInViewport({ ratio: 1 })
    expect(
      await back.evaluate((button) => {
        const text = button.firstChild
        if (!(text instanceof Text)) throw new Error("Expected the Back label")
        return [...text.data.matchAll(/\S+/g)]
          .filter((word) => {
            const range = document.createRange()
            range.setStart(text, word.index)
            range.setEnd(text, word.index + word[0].length)
            const bounds = range.getBoundingClientRect()
            const buttonBounds = button.getBoundingClientRect()
            return (
              bounds.height >
                Number.parseFloat(getComputedStyle(button).lineHeight) + 1 ||
              bounds.left < buttonBounds.left ||
              bounds.right > buttonBounds.right
            )
          })
          .map((word) => word[0])
      }),
    ).toEqual([])
    await back.click()
  })
}

test("binding chooser Back preserves the Controls draft and Cancel leaves saved bindings unchanged", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.getByRole("button", { name: "Controls", exact: true }).click()
  await page.getByRole("button", { name: "Keyboard", exact: true }).click()
  const before = await savedProfile(page)
  await page
    .getByRole("button", { name: "Better Hints H", exact: true })
    .click()
  await page.keyboard.press("k")
  await expect(
    page.getByRole("button", { name: "Better Hints K", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Better Hints K", exact: true })
    .click()
  await page.goBack()
  const editor = page.getByRole("dialog", { name: "Controls", exact: true })
  await expect(
    editor.getByRole("button", { name: "Better Hints K", exact: true }),
  ).toBeVisible()
  await page.goForward()
  await page.keyboard.press("Escape")
  await expect(
    editor.getByRole("button", { name: "Better Hints K", exact: true }),
  ).toBeVisible()
  await editor.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Close Settings", exact: true }),
  ).toBeVisible()
  expect(await savedProfile(page)).toEqual(before)
})

for (const width of [320, 1280]) {
  for (const spanish of [false, true]) {
    test(`${spanish ? "Spanish" : "English"} Settings keeps its footer and returns from help and Credits at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 800 })
      await page.emulateMedia({ reducedMotion: "reduce" })
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      await page.goto("/")
      await page.getByRole("button", { name: "Settings", exact: true }).click()
      if (spanish) {
        await page
          .getByRole("combobox", { name: "Language" })
          .selectOption("es-419")
        await expect
          .poll(async () => (await savedProfile(page)).settings.locale)
          .toBe("es-419")
      }
      const title = spanish ? "Personaliza tu juego" : "Your game customization"
      const settings = page.getByRole("region", { name: title, exact: true })
      const scroller = settings
        .getByRole("heading", { name: title, exact: true })
        .locator("..")
      const close = settings.getByRole("button", {
        name: spanish ? "Cerrar configuración" : "Close Settings",
        exact: true,
      })
      const help = settings.getByRole("button", {
        name: spanish
          ? "Explicar las pistas automáticas"
          : "Explain Auto-Hints",
        exact: true,
      })
      const helpView = page.getByRole("dialog", {
        name: spanish ? "Pistas automáticas" : "Auto-Hints",
        exact: true,
      })
      const creditsButton = settings.getByRole("button", {
        name: spanish ? "Créditos" : "Credits",
        exact: true,
      })
      const credits = page.getByRole("dialog", {
        name: spanish ? "Créditos" : "Credits",
        exact: true,
      })
      const backName = spanish ? "Volver a Configuración" : "Back to Settings"
      await settings
        .getByRole("radio", {
          name: spanish ? "Relámpago" : "Blitz",
          exact: true,
        })
        .check()
      const original = await savedProfile(page)

      for (const percent of [100, 200]) {
        const scale = await page.addStyleTag({
          content: `:root { font-size: ${percent}%; }`,
        })
        await expect(page.locator("html")).toHaveCSS(
          "font-size",
          `${(16 * percent) / 100}px`,
        )
        await expect(close).toHaveCSS("font-size", `${(16 * percent) / 100}px`)
        await close.click({ trial: true })
        await page.mouse.move(0, 0)
        const footerBounds = await close.boundingBox()
        expect(footerBounds).not.toBeNull()
        for (const fraction of [0, 0.5, 1]) {
          await scroller.evaluate(
            (element, position) =>
              element.scrollTo(0, element.scrollHeight * position),
            fraction,
          )
          await expect(close).toBeInViewport({ ratio: 1 })
          expect(await close.boundingBox()).toEqual(footerBounds)
          expect(
            await scroller.evaluate(
              (element) => element.scrollWidth <= element.clientWidth,
            ),
          ).toBe(true)
          const contentBounds = await scroller.boundingBox()
          if (contentBounds === null || footerBounds === null)
            throw new Error("Expected visible Settings content and footer")
          expect(contentBounds.y + contentBounds.height).toBeLessThanOrEqual(
            footerBounds.y,
          )
        }
        await scroller.evaluate((element) => element.scrollTo(0, 0))
        await page.screenshot({
          path: testInfo.outputPath(`settings-${percent}.png`),
        })
        await scale.evaluate((element) => element.remove())
      }

      await expect(page.locator("html")).toHaveCSS("font-size", "16px")
      await help.scrollIntoViewIfNeeded()
      await help.focus()
      const hintScroll = await scroller.evaluate((element) => element.scrollTop)
      await help.press("Enter")
      await expect(helpView).toBeVisible()
      await expect(page.getByRole("dialog")).toHaveCount(1)
      await expect(page.getByRole("radio")).toHaveCount(0)
      await expect(helpView.getByRole("heading", { level: 2 })).toBeFocused()
      await expect(
        helpView.getByRole("term").filter({
          hasText: spanish
            ? /^Pistas de movimientos automáticas$/
            : /^Auto Move Hints$/,
        }),
      ).toBeVisible()
      expect(
        (await new AxeBuilder({ page }).include("dialog").analyze()).violations,
      ).toEqual([])
      await page.screenshot({
        path: testInfo.outputPath("auto-hints-help.png"),
      })
      await page.keyboard.press("Escape")
      await expect(help).toBeFocused()
      expect(await scroller.evaluate((element) => element.scrollTop)).toBe(
        hintScroll,
      )
      await page.goForward()
      await expect(helpView).toBeVisible()
      const helpHeading = helpView.getByRole("heading", { level: 2 })
      const helpTextScale = await page.addStyleTag({
        content: ":root { font-size: 200%; }",
      })
      await expect(helpHeading).toHaveCSS("font-size", "48px")
      await helpHeading.press("Tab")
      await expect(
        helpView.getByRole("button", { name: backName, exact: true }),
      ).toBeFocused()
      await page.keyboard.press("Shift+Tab")
      await expect(helpHeading).toBeFocused()
      await page.keyboard.press("PageDown")
      await expect
        .poll(() =>
          helpHeading.locator("..").evaluate((element) => element.scrollTop),
        )
        .toBeGreaterThan(0)
      await helpTextScale.evaluate((element) => element.remove())
      await expect(helpHeading).toHaveCSS("font-size", "24px")
      await helpView
        .getByRole("button", { name: backName, exact: true })
        .click()
      await expect(help).toBeFocused()

      await creditsButton.scrollIntoViewIfNeeded()
      await creditsButton.focus()
      const creditScroll = await scroller.evaluate(
        (element) => element.scrollTop,
      )
      await creditsButton.press("Enter")
      await expect(credits).toBeVisible()
      await expect(page.getByRole("dialog")).toHaveCount(1)
      await expect(credits.getByRole("heading", { level: 3 })).toHaveText(
        localizeArtCredits(loadCatalog(spanish ? "es-419" : "en")).map(
          ({ title, creator }) => `${title} · ${creator}`,
        ),
      )
      await expect(credits.getByRole("combobox")).toHaveCount(0)
      await expect(
        credits
          .getByRole("region", {
            name: spanish ? "Créditos" : "Credits",
            exact: true,
          })
          .locator("summary"),
      ).toHaveCount(0)
      await expect(credits.getByRole("heading", { level: 2 })).toBeFocused()
      await expect(
        credits.getByRole("button", { name: backName, exact: true }),
      ).toBeInViewport({ ratio: 1 })
      await page.screenshot({ path: testInfo.outputPath("credits-view.png") })
      await page.goBack()
      await expect(creditsButton).toBeFocused()
      expect(await scroller.evaluate((element) => element.scrollTop)).toBe(
        creditScroll,
      )
      await expect(
        settings.getByRole("radio", {
          name: spanish ? "Relámpago" : "Blitz",
          exact: true,
        }),
      ).toBeChecked()
      expect(await savedProfile(page)).toEqual(original)
      await close.click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(
        page.getByRole("button", {
          name: spanish ? "Configuración" : "Settings",
          exact: true,
        }),
      ).toBeFocused()
      expect(errors).toEqual([])
    })
  }
}

test("controller confirms Settings help and Credits and cancels only the foreground view", async ({
  page,
}) => {
  await injectControllerInput(page)
  await page.goto("/")
  const settingsButton = page.getByRole("button", {
    name: "Settings",
    exact: true,
  })
  await activate(page, settingsButton)
  const original = await savedProfile(page)
  for (const [triggerName, title] of [
    ["Explain Auto-Hints", "Auto-Hints"],
    ["Credits", "Credits"],
  ]) {
    const trigger = page.getByRole("button", { name: triggerName, exact: true })
    await activate(page, trigger)
    await expect(
      page.getByRole("dialog", { name: title, exact: true }),
    ).toBeVisible()
    await press(page, 1)
    await expect(
      page.getByRole("dialog", {
        name: "Your game customization",
        exact: true,
      }),
    ).toBeVisible()
    await expect(trigger).toBeFocused()
  }
  expect(await savedProfile(page)).toEqual(original)
  await activate(
    page,
    page.getByRole("button", { name: "Close Settings", exact: true }),
  )
  await expect(settingsButton).toBeFocused()
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("reading Settings help and Credits preserves a paused timed match and requires explicit Resume", async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).check()
  await expect
    .poll(async () => (await savedProfile(page)).settings.autoHintMode)
    .toBe("no-auto-hints")
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()
  await page.getByRole("radio", { name: "White", exact: true }).check()
  await page
    .getByRole("button", { name: "Change time control", exact: true })
    .click()
  await page.getByRole("radio", { name: "Bullet · 1+0", exact: true }).check()
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  await expect(
    page.getByRole("grid", {
      name: "Chessboard, White at bottom",
      exact: true,
    }),
  ).toBeVisible()
  await page.locator("summary").filter({ hasText: "Menu" }).click()
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.clock?.paused)
    .toBe(true)
  const original = await savedProfile(page)
  for (const name of ["Explain Auto-Hints", "Credits"]) {
    await page
      .getByRole("dialog", { name: "Your game customization", exact: true })
      .getByRole("button", { name, exact: true })
      .click()
    await page
      .getByRole("button", { name: "Back to Settings", exact: true })
      .click()
  }
  expect(await savedProfile(page)).toEqual(original)
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await page.keyboard.press("Escape")
  const resume = page.getByRole("button", {
    name: "Resume clocks",
    exact: true,
  })
  await expect(resume).toBeVisible()
  expect((await savedProfile(page)).activeMatch).toEqual(original.activeMatch)
  await resume.click()
  await expect(resume).toHaveCount(0)
  await expect(page.getByRole("timer", { name: "White clock" })).toContainText(
    "Clock running",
  )
})
