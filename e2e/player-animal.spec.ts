import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { STOCKFISH_OPPONENTS } from "../packages/match/src/stockfishOpponent.js"
import createInitialMapachessPlayerData from "../packages/profile/src/playerData.js"
import importPlayerData from "./importPlayerData.js"
import savedProfile from "./savedProfile.js"

test("shows the entire locked roster and keeps it keyboard-scrollable on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 915 })
  await page.goto("/")
  await page
    .getByRole("button", { name: "Standard Story", exact: true })
    .click()
  const gallery = page.getByRole("region", {
    name: "Player animals",
    exact: true,
  })
  await expect(gallery.getByRole("radio")).toHaveCount(23)
  await expect(gallery.locator('span[style*="background-image"]')).toHaveCount(
    23,
  )
  await expect(gallery.getByRole("radio", { name: /Raccoon/ })).toBeChecked()
  await expect(gallery.getByRole("radio", { name: /Chicken/ })).toBeDisabled()
  await expect(gallery.getByRole("radio", { disabled: true })).toHaveCount(22)
  await gallery.focus()
  await page.keyboard.press("End")
  await expect
    .poll(() => gallery.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0)
  await gallery
    .getByRole("radio", { name: /Dragonfly/ })
    .scrollIntoViewIfNeeded()
  await expect(gallery.getByText("Dragonfly", { exact: false })).toBeVisible()
  await expect(gallery).toHaveCSS("overflow-x", "hidden")
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  expect(
    (
      await new AxeBuilder({ page })
        .include('[aria-label="Player animals"]')
        .analyze()
    ).violations,
  ).toEqual([])
})

test("a Chess960 Story victory unlocks the shared choice and Story persists it without changing progress", async ({
  page,
}) => {
  await page.goto("/")
  const initial = createInitialMapachessPlayerData()
  await importPlayerData(page, {
    ...initial,
    storyProgress: {
      standard: [],
      chess960: [{ opponentId: "chicken-stockfish", highestMedal: "bronze" }],
    },
  })
  const before = await savedProfile(page)
  await page
    .getByRole("button", { name: "Standard Story", exact: true })
    .click()
  const gallery = page.getByRole("region", {
    name: "Player animals",
    exact: true,
  })
  const raccoon = gallery.getByRole("radio", { name: /Raccoon/ })
  await raccoon.focus()
  await page.keyboard.press("ArrowRight")
  await expect(gallery.getByRole("radio", { name: /Chicken/ })).toBeChecked()
  await expect
    .poll(async () => (await savedProfile(page)).appearance.animal)
    .toBe("chicken-stockfish")
  const after = await savedProfile(page)
  expect({
    ...after,
    appearance: before.appearance,
    revision: before.revision,
  }).toEqual(before)
  await page
    .getByRole("button", { name: "All game modes", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Customize profile card", exact: true })
    .click()
  await page.getByRole("button", { name: "Animal", exact: true }).click()
  await expect(page.getByRole("radio", { name: /Chicken/ })).toBeChecked()
  expect(
    (
      await new AxeBuilder({ page })
        .include('[aria-label="Player animals"]')
        .analyze()
    ).violations,
  ).toEqual([])
})

test("all earned animals remain selectable after reload and editing is still a draft", async ({
  page,
}) => {
  await page.goto("/")
  await importPlayerData(page, {
    ...createInitialMapachessPlayerData(),
    storyProgress: {
      standard: STOCKFISH_OPPONENTS.map(({ id }) => ({
        opponentId: id,
        highestMedal: "bronze",
      })),
      chess960: [],
    },
  })
  await page
    .getByRole("button", { name: "Customize profile card", exact: true })
    .click()
  await page.getByRole("button", { name: "Animal", exact: true }).click()
  const gallery = page.getByRole("region", {
    name: "Player animals",
    exact: true,
  })
  await expect(gallery.getByRole("radio", { disabled: false })).toHaveCount(23)
  await gallery.getByRole("radio", { name: /Dragonfly/ }).check()
  expect((await savedProfile(page)).appearance.animal).toBe("raccoon-stockfish")
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click()
  await expect(
    page.getByText("Saved appearance", { exact: true }),
  ).toBeVisible()
  await page.reload()
  await page.getByRole("button", { name: "Animal", exact: true }).click()
  await expect(gallery.getByRole("radio", { name: /Dragonfly/ })).toBeChecked()
})

test("a legacy Chicken remains readable, but cannot be reselected after switching away", async ({
  page,
}) => {
  await page.goto("/")
  const initial = createInitialMapachessPlayerData()
  await importPlayerData(page, {
    ...initial,
    appearance: { ...initial.appearance, animal: "chicken-stockfish" },
  })
  await page
    .getByRole("button", { name: "Standard Story", exact: true })
    .click()
  const gallery = page.getByRole("region", {
    name: "Player animals",
    exact: true,
  })
  await expect(gallery.getByRole("radio", { name: /Chicken/ })).toBeChecked()
  await gallery.getByRole("radio", { name: /Raccoon/ }).check()
  await expect
    .poll(async () => (await savedProfile(page)).appearance.animal)
    .toBe("raccoon-stockfish")
  await page.reload()
  await expect(gallery.getByRole("radio", { name: /Chicken/ })).toBeDisabled()
})
