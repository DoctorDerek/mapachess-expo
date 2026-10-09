import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import resolveCoachPortrait, {
  COACH_COLLECTIONS,
  COACH_PORTRAIT_NAMES,
} from "../packages/match-presentation/src/coachPortrait.js"
import importPlayerData from "./importPlayerData.js"
import savedProfile from "./savedProfile.js"

const coachChoices = (page: Page) =>
  page.getByRole("group", { name: "Coach", exact: true })
const openSettings = async (page: Page): Promise<void> => {
  const settings = page.getByRole("button", { name: "Settings", exact: true })
  const menu = page.locator("summary").filter({ hasText: "Menu" })
  await expect(settings.or(menu)).toBeVisible({ timeout: 30000 })
  if (!(await settings.isVisible())) await menu.click()
  await settings.click()
}

for (const width of [320, 1280]) {
  test(`selects one complete coach collection by keyboard at ${width}px and keeps it through reload`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 915 })
    await page.goto("/")
    await openSettings(page)
    const original = await savedProfile(page)
    const group = coachChoices(page)
    await expect(group.getByRole("radio")).toHaveCount(2)
    await expect(group.locator("img")).toHaveCount(6)
    await expect
      .poll(() =>
        group
          .locator("img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true)
    const mapachito = group.getByRole("radio", {
      name: "Mapachito",
      exact: true,
    })
    await expect(mapachito).toBeChecked()
    await mapachito.focus()
    await page.keyboard.press("ArrowRight")
    await expect(
      group.getByRole("radio", { name: "Animal faces", exact: true }),
    ).toBeChecked()
    await expect
      .poll(async () => (await savedProfile(page)).settings.coachCollection)
      .toBe("greyfox")
    const after = await savedProfile(page)
    expect({
      ...after,
      revision: original.revision,
      settings: original.settings,
    }).toEqual(original)
    expect(after.settings.chessAppearance).toEqual(
      original.settings.chessAppearance,
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    const report = await new AxeBuilder({ page })
      .include("#profile-settings-panel fieldset:has(legend)")
      .analyze()
    expect(report.violations).toEqual([])
    await group.screenshot({ path: testInfo.outputPath(`coach-${width}.png`) })
    await page.reload()
    await expect(
      coachChoices(page).getByRole("radio", {
        name: "Animal faces",
        exact: true,
      }),
    ).toBeChecked()
  })
}

test("restores the collection from backup and changes it without replacing the match or its hints", async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible()
  const initial = await savedProfile(page)
  await importPlayerData(page, {
    ...initial,
    settings: { ...initial.settings, coachCollection: "greyfox" },
  })
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  const board = page.getByRole("grid", { name: /Chessboard/ })
  await expect(board.locator('[data-square="e2"]')).toHaveAttribute(
    "aria-disabled",
    "false",
    { timeout: 30000 },
  )
  await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6, {
    timeout: 30000,
  })
  const coach = page.locator("figure").filter({ hasText: "Animal faces coach" })
  await expect(coach.locator("img")).toHaveAttribute(
    "src",
    /coach\/greyfox\/neutral.png$/,
  )
  const original = await savedProfile(page)
  await openSettings(page)
  await coachChoices(page)
    .getByRole("radio", { name: "Mapachito", exact: true })
    .check()
  await expect
    .poll(async () => (await savedProfile(page)).settings.coachCollection)
    .toBe("mapachito")
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await expect(
    page
      .locator("figure")
      .filter({ hasText: "Mapachito coach" })
      .locator("img"),
  ).toHaveAttribute("src", /coach\/neutral.png$/)
  const after = await savedProfile(page)
  expect(after.activeMatch).toEqual(original.activeMatch)
  expect(after.totalXp).toBe(original.totalXp)
  expect(after.lastAcceptedResultReward).toEqual(
    original.lastAcceptedResultReward,
  )
  await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6)
})

test("retains the last decoded coach during a failed switch and explicitly retries the selected collection", async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.goto("/")
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  const coach = page.locator("figure").filter({ hasText: /coach/ })
  await expect(coach.locator("img")).toHaveAttribute(
    "src",
    /coach\/neutral.png$/,
    { timeout: 30000 },
  )
  await page.route("**/coach/greyfox/**", (route) => route.abort())
  await openSettings(page)
  await coachChoices(page)
    .getByRole("radio", { name: "Animal faces", exact: true })
    .check()
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await expect(
    coach.getByRole("button", { name: "Retry artwork" }),
  ).toBeVisible()
  await expect(coach.locator("img")).toHaveAttribute(
    "src",
    /coach\/neutral.png$/,
  )
  await expect
    .poll(async () => (await savedProfile(page)).settings.coachCollection)
    .toBe("greyfox")
  await page.unroute("**/coach/greyfox/**")
  await coach.getByRole("button", { name: "Retry artwork" }).click()
  await expect(coach.locator("img")).toHaveAttribute(
    "src",
    /coach\/greyfox\/neutral.png\?retry=1$/,
  )
  await expect(
    coach.getByRole("button", { name: "Retry artwork" }),
  ).toHaveCount(0)
})

test("follows accepted move grades and returns to neutral after Undo without replaying grades on Redo", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000)
  await page.clock.install()
  await page.goto("/")
  await openSettings(page)
  await coachChoices(page)
    .getByRole("radio", { name: "Animal faces", exact: true })
    .check()
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).check()
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  const board = page.getByRole("grid", { name: /Chessboard/ })
  await expect(board.locator('[data-square="e2"]')).toHaveAttribute(
    "aria-disabled",
    "false",
    { timeout: 30000 },
  )
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await board.locator('[data-square="e2"]').click()
  await board.locator('[data-square="e4"]').click()
  await expect(page.getByRole("button", { name: /^Dismiss / })).toHaveCount(2, {
    timeout: 30000,
  })
  const match = (await savedProfile(page)).activeMatch
  const feedback = match?.moveFeedback?.at(-1)
  if (match === null || feedback === undefined)
    throw new Error("Expected accepted classified move")
  const portrait = resolveCoachPortrait(
    {
      family: "move",
      grade: feedback.grade,
      role: feedback.mover === match.playerColor ? "player" : "opponent",
    },
    COACH_COLLECTIONS.greyfox.portraits,
  )
  const coach = page.locator("figure").filter({ hasText: "Animal faces coach" })
  await expect(coach.locator("img")).toHaveAttribute(
    "src",
    new RegExp(`/coach/greyfox/${portrait.label}.png$`),
  )
  await expect(coach).toContainText(COACH_PORTRAIT_NAMES[portrait.label])
  await coach.screenshot({ path: testInfo.outputPath("coach-in-game.png") })
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Dismiss / })).toHaveCount(0)
  await expect(coach.locator("img")).toHaveAttribute(
    "src",
    /coach\/greyfox\/neutral.png$/,
  )
  await page.getByRole("button", { name: "Redo", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Dismiss / })).toHaveCount(0)
  await expect(coach.locator("img")).toHaveAttribute(
    "src",
    /coach\/greyfox\/neutral.png$/,
  )
})

test("ignores a superseded collection decode after switching back", async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.goto("/")
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  const coach = page.locator("figure").filter({ hasText: /coach/ })
  await expect(coach.locator("img")).toHaveAttribute(
    "src",
    /coach\/neutral.png$/,
    { timeout: 30000 },
  )
  const requested = page.waitForRequest("**/coach/greyfox/neutral.png", {
    timeout: 10000,
  })
  const release = Promise.withResolvers<void>()
  await page.route("**/coach/greyfox/neutral.png", async (route) => {
    await release.promise
    await route.continue()
  })
  try {
    await openSettings(page)
    await requested
    await coachChoices(page)
      .getByRole("radio", { name: "Animal faces", exact: true })
      .check()
    await expect
      .poll(async () => (await savedProfile(page)).settings.coachCollection)
      .toBe("greyfox")
    await coachChoices(page)
      .getByRole("radio", { name: "Mapachito", exact: true })
      .check()
  } finally {
    release.resolve()
    await page.unrouteAll({ behavior: "wait" })
  }
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await expect(coach.locator("img")).toHaveAttribute(
    "src",
    /coach\/neutral.png$/,
  )
  await expect(coach).toContainText("Mapachito coach")
  await expect
    .poll(async () => (await savedProfile(page)).settings.coachCollection)
    .toBe("mapachito")
})
