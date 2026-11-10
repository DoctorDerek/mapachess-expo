import { expect } from "@playwright/test"
import createInitialMapachessPlayerData from "../packages/profile/src/playerData.js"
import { ratingValues } from "../packages/profile/src/ratingContext.js"
import { injectControllerInput, press } from "./controllerInput.js"
import { test } from "./fixtures.js"
import importPlayerData from "./importPlayerData.js"
import savedProfile from "./savedProfile.js"

const choices = [
  {
    kind: "player",
    mode: "Standard Chess Story",
    trigger: /^Play as /,
    initial: /Raccoon/,
    next: /Chicken/,
  },
  {
    kind: "opponent",
    mode: "Standard Chess Story",
    trigger: /^Change Story opponent$/,
    initial: /Bunny Stockfish/,
    next: /Chicken Stockfish/,
  },
  {
    kind: "hints",
    mode: "Standard Chess Story",
    trigger: /^Change hints$/,
    initial: /^Auto Move Hints$/,
    next: /^No Auto Hints$/,
  },
  {
    kind: "time",
    mode: "Standard Chess Story",
    trigger: /^Change time control$/,
    initial: /^Untimed$/,
    next: /^Bullet · 1\+0$/,
  },
] as const

for (const choice of choices) {
  test(`${choice.kind} choices commit only on Done and all Back paths cancel`, async ({
    page,
  }) => {
    await injectControllerInput(page)
    await page.setViewportSize({ width: 320, height: 640 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    const initial = createInitialMapachessPlayerData()
    await importPlayerData(page, {
      ...initial,
      storyProgress: {
        ...initial.storyProgress,
        standard: [{ opponentId: "chicken-stockfish", highestMedal: "bronze" }],
      },
    })
    await page.getByRole("button", { name: choice.mode, exact: true }).click()
    const before = await savedProfile(page)
    const trigger = page.getByRole("button", { name: choice.trigger })
    for (const exit of ["Cancel", "Escape", "Back", "Controller"] as const) {
      await trigger.click()
      const picker = page.getByRole("dialog")
      await expect(
        picker.getByRole("radio", { name: choice.initial }),
      ).toBeChecked()
      await picker.getByRole("radio", { name: choice.next }).focus()
      await picker.getByRole("radio", { name: choice.next }).press("Space")
      await expect(
        picker.getByRole("radio", { name: choice.next }),
      ).toBeChecked()
      expect(await savedProfile(page)).toEqual(before)
      const cancel = picker.getByRole("button", { name: "Cancel", exact: true })
      const done = picker.getByRole("button", { name: "Done", exact: true })
      await expect(cancel).toBeInViewport({ ratio: 1 })
      await expect(done).toBeInViewport({ ratio: 1 })
      switch (exit) {
        case "Cancel":
          await cancel.click()
          break
        case "Escape":
          await page.keyboard.press("Escape")
          break
        case "Back":
          await page.goBack()
          break
        case "Controller":
          await press(page, 1)
          break
      }
      await expect(picker).toHaveCount(0)
      await expect(trigger).toBeFocused()
      expect(await savedProfile(page)).toEqual(before)
      if (exit === "Back") {
        await page.goForward()
        await expect(
          picker.getByRole("radio", { name: choice.initial }),
        ).toBeChecked()
        await cancel.click()
      }
    }
    await trigger.click()
    await page
      .getByRole("dialog")
      .getByRole("radio", { name: choice.next })
      .focus()
    await page
      .getByRole("dialog")
      .getByRole("radio", { name: choice.next })
      .press("Space")
    await page.getByRole("button", { name: "Done", exact: true }).click()
    if (choice.kind === "player") {
      await expect
        .poll(async () => (await savedProfile(page)).appearance.animal)
        .toBe("chicken-stockfish")
    } else if (choice.kind === "hints") {
      await expect
        .poll(async () => (await savedProfile(page)).settings.autoHintMode)
        .toBe("no-auto-hints")
    } else {
      expect(await savedProfile(page)).toEqual(before)
    }
    await trigger.click()
    await expect(
      page.getByRole("dialog").getByRole("radio", { name: choice.next }),
    ).toBeChecked()
    await page.getByRole("button", { name: "Cancel", exact: true }).click()
    const after = await savedProfile(page)
    expect({
      ...after,
      appearance: before.appearance,
      settings: before.settings,
      revision: before.revision,
    }).toEqual(before)
  })
}

for (const input of ["mouse", "touch"] as const) {
  test.describe(`same-tick Elo via ${input}`, () => {
    test.use({ hasTouch: input === "touch" })

    test("clears invalid exact text only after deliberate selection", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.goto("/")
      await importPlayerData(page, createInitialMapachessPlayerData())
      await page
        .getByRole("button", { name: "Standard Chess Challenge", exact: true })
        .click()

      const range = page.getByRole("slider", { name: "Adjust opponent Elo" })
      const exact = page.getByRole("textbox", {
        name: "Opponent Elo",
        exact: true,
      })
      await expect(range).toHaveValue("100")
      await exact.fill("1012")
      await range.focus()
      await expect(exact).toHaveValue("1012")
      await expect(exact).toHaveAttribute("aria-invalid", "true")

      const position = await range.evaluate((slider) => ({
        x: 1,
        y: slider.clientHeight / 2,
      }))
      if (input === "touch") await range.tap({ position })
      else await range.click({ position })

      await expect(range).toHaveValue("100")
      await expect(exact).toHaveValue("100")
      await expect(exact).not.toHaveAttribute("aria-invalid", "true")
      expect((await savedProfile(page)).activeMatch).toBeNull()
    })
  })
}

for (const variant of ["standard", "chess960"] as const) {
  test(`keeps the animal and 2325 Elo independent through a rated ${variant} Challenge`, async ({
    page,
  }, testInfo) => {
    await injectControllerInput(page)
    await page.setViewportSize(
      variant === "standard"
        ? { width: 390, height: 844 }
        : { width: 1280, height: 800 },
    )
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    const initial = createInitialMapachessPlayerData()
    await importPlayerData(page, {
      ...initial,
      ratings: ratingValues(() => 2325),
      storyProgress: {
        ...initial.storyProgress,
        standard: [
          { opponentId: "chicken-stockfish", highestMedal: "bronze" },
          { opponentId: "bunny-stockfish", highestMedal: "bronze" },
        ],
      },
    })
    await page
      .getByRole("button", {
        name:
          variant === "standard"
            ? "Standard Chess Challenge"
            : "Chess960 Challenge",
        exact: true,
      })
      .click()
    await page.getByRole("button", { name: /Change animal/ }).click()
    const bunny = page.getByRole("radio", {
      name: "Bunny Stockfish",
      exact: true,
    })
    await page
      .getByRole("dialog")
      .locator("label")
      .filter({ has: bunny })
      .click()
    await expect(bunny).toBeChecked()
    await page.getByRole("button", { name: "Done", exact: true }).click()
    const range = page.getByRole("slider", { name: "Adjust opponent Elo" })
    const exact = page.getByRole("textbox", {
      name: "Opponent Elo",
      exact: true,
    })
    await range.focus()
    await press(page, 15)
    await expect(range).toHaveValue("125")
    await expect(exact).toHaveValue("125")
    await range.press("Home")
    await expect(range).toHaveValue("100")
    await exact.fill("2325")
    await exact.press("Enter")
    await expect(range).toHaveValue("2325")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect((await savedProfile(page)).activeMatch).toBeNull()
    await expect(
      page.getByRole("button", { name: "Start match", exact: true }),
    ).toBeInViewport({ ratio: 1 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({ path: testInfo.outputPath("challenge-setup.png") })
    await page.getByRole("button", { name: "Start match", exact: true }).click()
    const board = page.getByRole("grid", { name: /Chessboard/ })
    await expect(board).toBeVisible({ timeout: 30000 })
    const started = (await savedProfile(page)).activeMatch
    expect(started).toMatchObject({
      mode: "challenge",
      opponentId: "bunny-stockfish",
      opponentTargetElo: 2325,
      ratedOpponentElo: 2325,
    })
    await page.reload()
    await expect(board).toBeVisible({ timeout: 30000 })
    expect((await savedProfile(page)).activeMatch).toMatchObject({
      matchId: started?.matchId,
      opponentPolicyFingerprint: started?.opponentPolicyFingerprint,
      ratedOpponentElo: 2325,
    })
    await page.getByLabel("Match menu", { exact: true }).click()
    await page.getByRole("button", { name: "Resign", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Review board", exact: true }),
    ).toBeVisible()
    const finished = await savedProfile(page)
    expect(
      Object.values(finished.ratedMatchCounts).reduce(
        (sum, count) => sum + count,
        0,
      ),
    ).toBe(1)
    expect(finished.lastAcceptedResultReward?.ratedElo).toMatchObject({
      variant,
      before: 2325,
      after: 2197,
    })
    expect(
      Object.values(finished.ratings).filter((value) => value !== 2325),
    ).toEqual([2197])
    expect(finished.challengeHistory[variant].difficulties).toContainEqual({
      targetElo: 2325,
      lastPlayedAnimal: "bunny-stockfish",
      highestMedal: null,
    })
  })
}
