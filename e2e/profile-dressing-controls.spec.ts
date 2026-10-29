import { expect, type Locator } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import { STOCKFISH_OPPONENTS } from "../packages/match/src/stockfishOpponent.js"
import createInitialMapachessPlayerData from "../packages/profile/src/playerData.js"
import { injectControllerInput, press } from "./controllerInput.js"
import { firstArrivalTest, test } from "./fixtures.js"
import importPlayerData from "./importPlayerData.js"
import chooseDressingCategory from "./profileDressingRoom.js"
import savedProfile from "./savedProfile.js"

for (const size of [
  { width: 390, height: 844, text: "100%" },
  { width: 320, height: 640, text: "200%" },
])
  test(`fits every animal's painted category artwork at ${size.width}px / ${size.text}`, async ({
    page,
  }) => {
    test.setTimeout(60000)
    const copy = loadCatalog("en")
    await page.setViewportSize(size)
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    await importPlayerData(page, {
      ...createInitialMapachessPlayerData(),
      storyProgress: {
        standard: STOCKFISH_OPPONENTS.map(({ id }) => ({
          opponentId: id,
          highestMedal: "gold",
        })),
        chess960: [],
      },
    })
    await page
      .getByRole("button", { name: "Customize profile card", exact: true })
      .click()
    await page.evaluate((text) => {
      document.documentElement.style.fontSize = text
    }, size.text)
    const categories = page.getByRole("group", {
      name: "Appearance categories",
      exact: true,
    })
    const animal = categories.getByRole("button", {
      name: "Animal",
      exact: true,
    })
    const sprite = animal.locator('span[style*="background-image"]')
    for (const { id } of STOCKFISH_OPPONENTS) {
      const previousSource = await sprite.evaluate(
        (element) => getComputedStyle(element).backgroundImage,
      )
      await animal.click()
      await page.getByRole("radio", { name: copy.animals.names[id] }).check()
      await page
        .getByRole("button", { name: "Back to categories", exact: true })
        .click()
      await animal.scrollIntoViewIfNeeded()
      await page.mouse.move(0, 0)
      await expect(sprite).not.toHaveCSS("background-image", previousSource)
      const clearance = await sprite.evaluate(async (element) => {
        const style = getComputedStyle(element)
        const image = new Image()
        image.src = style.backgroundImage.slice(5, -2)
        await image.decode()
        const frameCount = parseFloat(style.backgroundSize) / 100
        const frameWidth = image.naturalWidth / frameCount
        const canvas = document.createElement("canvas")
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext("2d")
        if (context === null) throw new Error("Expected sprite pixel access")
        context.drawImage(image, 0, 0)
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data
        let left = frameWidth
        let right = 0
        let top = canvas.height
        let bottom = 0
        for (let y = 0; y < canvas.height; y += 1)
          for (let x = 0; x < canvas.width; x += 1) {
            if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue
            const column = x % frameWidth
            left = Math.min(left, column)
            right = Math.max(right, column + 1)
            top = Math.min(top, y)
            bottom = Math.max(bottom, y + 1)
          }
        const artwork = element
          .closest("button")
          ?.querySelector(':scope > span[aria-hidden="true"]')
        if (artwork === null || artwork === undefined)
          throw new Error("Expected the category artwork slot")
        const frame = element.getBoundingClientRect()
        const slot = artwork.getBoundingClientRect()
        const scaleX = frame.width / frameWidth
        const scaleY = frame.height / image.naturalHeight
        return {
          width: (right - left) * scaleX,
          height: (bottom - top) * scaleY,
          scaleDifference: Math.abs(scaleX - scaleY),
          edges: [
            frame.left + left * scaleX - slot.left,
            slot.right - (frame.left + right * scaleX),
            frame.top + top * scaleY - slot.top,
            slot.bottom - (frame.top + bottom * scaleY),
          ],
        }
      })
      expect(clearance.width, id).toBeGreaterThan(0)
      expect(clearance.height, id).toBeGreaterThan(0)
      expect(clearance.scaleDifference, id).toBeLessThan(0.01)
      for (const edge of clearance.edges)
        expect(edge, id).toBeGreaterThanOrEqual(-0.05)
      await expectReachable(animal)
    }
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await expect
      .poll(() => sprite.evaluate((element) => element.getAnimations().length))
      .toBeGreaterThan(0)
  })

async function expectReachable(controls: Locator) {
  await expect
    .poll(() =>
      controls.evaluateAll(
        (elements) =>
          elements.length > 0 &&
          elements.every((element) => {
            const box = element.getBoundingClientRect()
            return (
              box.width >= 44 &&
              box.height >= 44 &&
              box.x >= 0 &&
              box.y >= 0 &&
              box.right <= innerWidth &&
              box.bottom <= innerHeight &&
              element.scrollWidth <= element.clientWidth + 1 &&
              element.contains(
                document.elementFromPoint(
                  box.x + box.width / 2,
                  box.y + box.height / 2,
                ),
              )
            )
          }),
      ),
    )
    .toBe(true)
}

for (const locale of ["en", "es-419"] as const)
  for (const size of [
    { width: 320, height: 640, text: "100%" },
    { width: 390, height: 844, text: "100%" },
    { width: 844, height: 390, text: "100%" },
    { width: 1280, height: 800, text: "100%" },
    { width: 1280, height: 800, text: "200%" },
    { width: 320, height: 640, text: "200%" },
  ]) {
    firstArrivalTest(
      `${locale} keeps studio controls reachable at ${size.width}x${size.height} / ${size.text}`,
      async ({ page }) => {
        const copy = loadCatalog(locale)
        const messages = copy.interface.profileDressingRoom
        await page.setViewportSize(size)
        await page.emulateMedia({ reducedMotion: "reduce" })
        await page.goto("/")
        if (locale !== "en")
          await page
            .getByRole("combobox", { name: "Language", exact: true })
            .selectOption(locale)
        await page
          .getByRole("button", { name: copy.introduction.start, exact: true })
          .click()
        await page
          .getByRole("button", {
            name: copy.setup.customizeProfile,
            exact: true,
          })
          .click()
        await page.evaluate((text) => {
          document.documentElement.style.fontSize = text
        }, size.text)
        await page.evaluate(() => document.fonts.ready)
        const before = await savedProfile(page)
        const editor = page.getByRole("region", {
          name: copy.setup.customizeProfile,
          exact: true,
        })
        const categories = editor.getByRole("group", {
          name: messages.appearanceCategories,
          exact: true,
        })
        await expect(categories.getByRole("button")).toHaveCount(6)
        await expect(
          editor.getByRole("combobox", {
            name: copy.profile.cardTimeCategory,
            exact: true,
          }),
        ).toBeVisible()
        await expect(
          editor.getByRole("combobox", {
            name: copy.profile.cardAssistance,
            exact: true,
          }),
        ).toBeVisible()
        for (const [category, colorCount] of [
          ["Clothes", 8],
          ["Hair", 10],
          ["Weapons", 4],
          ["Skin", 0],
          ["Face", 0],
          ["Animal", 0],
        ] as const) {
          await chooseDressingCategory(page, category, locale)
          if (category === "Weapons")
            await editor
              .getByRole("button", {
                name: copy.profile.dressing.weapons.weapon5,
                exact: true,
              })
              .click()
          const colors = editor.getByRole("group", {
            name: copy.profile.dressing.choices(
              copy.profile.dressing.categories[category],
            ),
            exact: true,
          })
          await expect(colors.getByRole("button")).toHaveCount(colorCount)
          if (category !== "Animal") {
            const styles = editor.getByRole("group", {
              name: copy.profile.dressing.selection(
                copy.profile.dressing.categories[category],
              ),
              exact: true,
            })
            await expect(styles).toBeVisible()
            expect(
              await styles
                .getByRole("button")
                .evaluateAll(
                  (buttons) =>
                    buttons.length > 0 &&
                    buttons.every(
                      (button) => button.scrollWidth <= button.clientWidth + 1,
                    ),
                ),
            ).toBe(true)
            const lastStyle = styles.getByRole("button").last()
            await lastStyle.click()
            await expectReachable(lastStyle)
          }
          if (colorCount > 0) {
            await colors.getByRole("button").last().click()
            await expect(colors.getByRole("button").last()).toHaveAttribute(
              "aria-pressed",
              "true",
            )
            await expectReachable(colors.getByRole("button"))
          }
          await page.mouse.move(0, 0)
          await expectReachable(editor.locator("footer").getByRole("button"))
          if (size.width < 1280) {
            await expect(categories).not.toBeVisible()
            await expectReachable(
              editor.getByRole("button", {
                name: messages.backToCategories,
                exact: true,
              }),
            )
          } else {
            await expect(categories).toBeVisible()
            await expectReachable(categories.getByRole("button"))
            await expect(
              editor.getByRole("button", {
                name: messages.backToCategories,
                exact: true,
              }),
            ).not.toBeVisible()
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true)
        }
        expect(await savedProfile(page)).toEqual(before)
        await editor
          .getByRole("button", { name: messages.cancelChanges, exact: true })
          .click()
        await expect(editor).toHaveCount(0)
        expect(await savedProfile(page)).toEqual(before)
      },
    )
  }

test("category Back, Escape, controller and browser navigation preserve the draft; Cancel discards it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await injectControllerInput(page)
  await page.goto("/")
  await page
    .getByRole("button", { name: "Customize profile card", exact: true })
    .click()
  const before = await savedProfile(page)
  const editor = page.getByRole("region", {
    name: "Customize profile card",
    exact: true,
  })
  await chooseDressingCategory(page, "Clothes")
  await editor.getByRole("button", { name: "Outfit 2", exact: true }).click()
  await editor
    .getByRole("button", { name: "Clothing color 8", exact: true })
    .click()
  for (const path of ["button", "escape", "controller", "browser"] as const) {
    await expect(
      editor.getByRole("button", { name: "Clothing color 8", exact: true }),
    ).toHaveAttribute("aria-pressed", "true")
    if (path === "button")
      await editor
        .getByRole("button", { name: "Back to categories", exact: true })
        .click()
    else if (path === "escape") await page.keyboard.press("Escape")
    else if (path === "controller") await press(page, 1)
    else await page.goBack()
    const category = editor
      .getByRole("group", { name: "Appearance categories", exact: true })
      .getByRole("button", { name: "Clothes", exact: true })
    await expect(category).toBeFocused()
    await expect(
      editor.getByRole("combobox", { name: "Time category", exact: true }),
    ).toBeVisible()
    if (path !== "browser") await category.click()
  }
  await page.goForward()
  await expect(
    editor.getByRole("button", { name: "Clothing color 8", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await editor
    .getByRole("button", { name: "Share profile card", exact: true })
    .click()
  await page.getByRole("button", { name: "PNG · Still", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Save PNG", exact: true }),
  ).toBeEnabled()
  await page.getByRole("button", { name: "Back", exact: true }).click()
  await expect(
    editor.getByRole("button", { name: "Back to categories", exact: true }),
  ).toBeVisible()
  await expect(
    editor.getByRole("button", { name: "Clothing color 8", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  expect(await savedProfile(page)).toEqual(before)
  await editor
    .getByRole("button", { name: "Cancel changes", exact: true })
    .click()
  await expect(editor).toHaveCount(0)
  expect(await savedProfile(page)).toEqual(before)
})

test("saves a palette choice from the overview without saving or replaying anything else", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page
    .getByRole("button", { name: "Customize profile card", exact: true })
    .click()
  const before = await savedProfile(page)
  const editor = page.getByRole("region", {
    name: "Customize profile card",
    exact: true,
  })
  await chooseDressingCategory(page, "Clothes")
  await editor
    .getByRole("button", { name: "Clothing color 8", exact: true })
    .click()
  await editor.getByRole("button", { name: "Outfit 2", exact: true }).click()
  await expect(
    editor.getByRole("button", { name: "Clothing color 8", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await editor
    .getByRole("button", { name: "Back to categories", exact: true })
    .click()
  await editor
    .getByRole("button", { name: "Save changes", exact: true })
    .click()
  await expect(
    editor.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled()
  const after = await savedProfile(page)
  expect(after.appearance).toEqual({
    ...before.appearance,
    cloth: "cloth2",
    clothColor: 8,
  })
  expect({
    ...after,
    appearance: before.appearance,
    revision: before.revision,
  }).toEqual(before)
  await editor
    .getByRole("button", { name: "Cancel changes", exact: true })
    .click()
  await expect(editor).toHaveCount(0)
  await page.reload()
  expect((await savedProfile(page)).appearance).toEqual(after.appearance)
})
