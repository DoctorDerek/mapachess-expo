import { expect } from "@playwright/test"
import createInitialMapachessPlayerData from "../packages/profile/src/playerData.js"
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
    kind: "difficulty",
    mode: "Standard Chess Challenge",
    trigger: /^Change difficulty$/,
    initial: /^100 Elo$/,
    next: /^300 Elo$/,
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
