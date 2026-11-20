import type { Locator, Page } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"

export default async function settledMatchMenu(
  page: Page,
  name = loadCatalog("en").interface.matchCommands.matchMenu,
): Promise<Locator> {
  const sheet = page.getByRole("dialog", { name, exact: true })
  await sheet.evaluate(async (dialog) => {
    await Promise.all(
      dialog.getAnimations().map((animation) => animation.finished),
    )
  })
  return sheet
}
