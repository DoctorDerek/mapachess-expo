import { expect } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import { injectControllerInput, press } from "./controllerInput.js"
import { firstArrivalTest, test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

for (const locale of ["en", "es-419"] as const) {
  firstArrivalTest(
    `${locale} keeps direct colors, six categories and whole-editor actions reachable`,
    async ({ page }) => {
      const copy = loadCatalog(locale)
      const messages = copy.interface.profileDressingRoom
      await page.setViewportSize({ width: 320, height: 640 })
      await page.goto("/")
      if (locale !== "en")
        await page
          .getByRole("combobox", { name: "Language", exact: true })
          .selectOption(locale)
      await page
        .getByRole("button", { name: copy.introduction.start, exact: true })
        .click()
      await expect(
        page.getByRole("button", {
          name: copy.setup.customizeProfile,
          exact: true,
        }),
      ).toBeEnabled()
      const before = await savedProfile(page)
      await page
        .getByRole("button", { name: copy.setup.customizeProfile, exact: true })
        .click()
      const editor = page.getByRole("region", {
        name: copy.setup.customizeProfile,
        exact: true,
      })
      const categories = editor.getByRole("group", {
        name: messages.appearanceCategories,
        exact: true,
      })
      const footer = editor.locator("footer")
      const reachable = async () => {
        await page.mouse.move(0, 0)
        await expect
          .poll(() =>
            footer.evaluate(
              (element) =>
                document.documentElement.scrollWidth <= innerWidth &&
                [...element.querySelectorAll("button")].every((button) => {
                  const box = button.getBoundingClientRect()
                  return (
                    box.width >= 44 &&
                    box.height >= 44 &&
                    box.x >= 0 &&
                    box.y >= 0 &&
                    box.right <= innerWidth &&
                    box.bottom <= innerHeight &&
                    button.scrollWidth <= button.clientWidth + 1 &&
                    button.contains(
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
      for (const size of [
        { width: 320, height: 640, text: "100%" },
        { width: 390, height: 844, text: "100%" },
        { width: 844, height: 390, text: "100%" },
        { width: 1280, height: 800, text: "100%" },
        { width: 320, height: 640, text: "200%" },
      ]) {
        await page.setViewportSize(size)
        await page.evaluate((text) => {
          document.documentElement.style.fontSize = text
        }, size.text)
        for (const [category, colorCount] of [
          ["Clothes", 8],
          ["Hair", 10],
          ["Weapons", 4],
          ["Skin", 0],
          ["Face", 0],
          ["Animal", 0],
        ] as const) {
          await editor.getByRole("button", { expanded: false }).click()
          await expect(categories.getByRole("button")).toHaveCount(6)
          await reachable()
          await categories
            .getByRole("button", {
              name: copy.profile.dressing.categories[category],
              exact: true,
            })
            .click()
          if (category === "Weapons")
            await editor
              .getByRole("button", {
                name: copy.profile.dressing.weapons.weapon5,
                exact: true,
              })
              .click()
          const colors = footer.getByRole("group", {
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
          }
          if (colorCount > 0) {
            await colors.getByRole("button").last().click()
            await expect(colors.getByRole("button").last()).toHaveAttribute(
              "aria-pressed",
              "true",
            )
          }
          await reachable()
        }
      }
      expect(await savedProfile(page)).toEqual(before)
      await editor.getByRole("button", { expanded: false }).click()
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
  await editor.getByRole("button", { name: "Outfit 2", exact: true }).click()
  await editor
    .getByRole("button", { name: "Clothing color 8", exact: true })
    .click()
  for (const path of ["button", "escape", "controller", "browser"] as const) {
    const trigger = editor.getByRole("button", { expanded: false })
    await trigger.click()
    await expect(
      editor.getByRole("button", { name: "Back to Clothes", exact: true }),
    ).toBeVisible()
    if (path === "button")
      await editor
        .getByRole("button", { name: "Back to Clothes", exact: true })
        .click()
    else if (path === "escape") await page.keyboard.press("Escape")
    else if (path === "controller") await press(page, 1)
    else await page.goBack()
    await expect(trigger).toBeVisible()
    await expect(
      editor.getByRole("button", { name: "Clothing color 8", exact: true }),
    ).toHaveAttribute("aria-pressed", "true")
    await expect(trigger).toBeFocused()
  }
  await page.goForward()
  await expect(
    editor.getByRole("button", { name: "Back to Clothes", exact: true }),
  ).toBeVisible()
  await editor
    .getByRole("button", { name: "Share profile card", exact: true })
    .click()
  await page.getByRole("button", { name: "PNG · Still", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Save PNG", exact: true }),
  ).toBeEnabled()
  await page.getByRole("button", { name: "Back", exact: true }).click()
  await expect(
    editor.getByRole("button", { name: "Back to Clothes", exact: true }),
  ).toBeVisible()
  expect(await savedProfile(page)).toEqual(before)
  await editor
    .getByRole("button", { name: "Cancel changes", exact: true })
    .click()
  await expect(editor).toHaveCount(0)
  expect(await savedProfile(page)).toEqual(before)
})

test("saves a palette choice from the category picker without saving or replaying anything else", async ({
  page,
}) => {
  await page.goto("/")
  await page
    .getByRole("button", { name: "Customize profile card", exact: true })
    .click()
  const before = await savedProfile(page)
  const editor = page.getByRole("region", {
    name: "Customize profile card",
    exact: true,
  })
  await editor
    .getByRole("button", { name: "Clothing color 8", exact: true })
    .click()
  await editor.getByRole("button", { name: "Outfit 2", exact: true }).click()
  await expect(
    editor.getByRole("button", { name: "Clothing color 8", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await editor.getByRole("button", { expanded: false }).click()
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
