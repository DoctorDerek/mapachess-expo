import type { Page } from "@playwright/test"
import loadCatalog, {
  type MapachessCatalog,
} from "../packages/localization/src/catalog.js"
import type { ShippedLocale } from "../packages/localization/src/locale.js"

export default async function chooseDressingCategory(
  page: Page,
  category: keyof MapachessCatalog["profile"]["dressing"]["categories"],
  locale: ShippedLocale = "en",
): Promise<void> {
  const copy = loadCatalog(locale)
  const editor = page.getByRole("region", {
    name: copy.setup.customizeProfile,
    exact: true,
  })
  const back = editor.getByRole("button", {
    name: copy.interface.profileDressingRoom.backToCategories,
    exact: true,
  })
  if (await back.isVisible()) await back.click()
  await editor
    .getByRole("group", {
      name: copy.interface.profileDressingRoom.appearanceCategories,
      exact: true,
    })
    .getByRole("button", {
      name: copy.profile.dressing.categories[category],
      exact: true,
    })
    .click()
}
