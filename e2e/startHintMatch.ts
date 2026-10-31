import { expect, type Page } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import type { ShippedLocale } from "../packages/localization/src/locale.js"
import type { AutoHintMode } from "../packages/match/src/autoHintMode.js"
import {
  TIME_CONTROL_PRESETS,
  timeControlLabel,
} from "../packages/match/src/timeControl.js"

export default async function startHintMatch(
  page: Page,
  {
    locale = "en",
    hints = "no-auto-hints",
    preset = "untimed",
  }: Readonly<{
    locale?: ShippedLocale
    hints?: Extract<AutoHintMode, "no-auto-hints" | "auto-move-hints">
    preset?: (typeof TIME_CONTROL_PRESETS)[number]["id"]
  }> = {},
): Promise<void> {
  const copy = loadCatalog(locale)
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  if (locale !== "en")
    await page.getByRole("combobox", { name: "Language" }).selectOption(locale)
  await button(copy.introduction.start).click()
  await button(copy.interface.webGame.settings).click()
  await page
    .getByRole("radio", {
      name: copy.setup.autoHints[hints].label,
      exact: true,
    })
    .check()
  await button(copy.interface.profileSettingsPanel.closeSettings).click()
  await button(copy.setup.presentations.standard.challenge.title).click()
  await page.getByRole("radio", { name: copy.setup.white, exact: true }).check()
  if (preset !== "untimed") {
    const selected = TIME_CONTROL_PRESETS.find(({ id }) => id === preset)
    if (!selected) throw new Error(`Missing test time control: ${preset}`)
    await button(copy.gameplay.clock.change).click()
    await page
      .getByRole("radio", {
        name: timeControlLabel(selected.control, copy.gameplay.clock),
        exact: true,
      })
      .check()
    await button(copy.setup.done).click()
  }
  await button(copy.setup.startMatch).click()
  if (hints === "auto-move-hints") {
    await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6, {
      timeout: 30000,
    })
  } else {
    await expect(
      page.getByRole("button", {
        name: `${copy.gameplay.hints.getHint} ${copy.gameplay.hints.controls.ready}`,
        exact: true,
      }),
    ).toBeEnabled({ timeout: 30000 })
  }
}
