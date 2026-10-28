import { expect } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

for (const locale of ["en", "es-419"] as const) {
  for (const shareAvailable of [false, true]) {
    test(`${locale} sharing keeps format and exit actions reachable with system Share ${shareAvailable}`, async ({
      page,
    }) => {
      const copy = loadCatalog(locale)
      await page.setViewportSize({ width: 320, height: 640 })
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.addInitScript((available) => {
        Object.defineProperty(navigator, "canShare", {
          configurable: true,
          value: () => available,
        })
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async () => undefined,
        })
      }, shareAvailable)
      await page.goto("/")
      if (locale !== "en") {
        await page
          .getByRole("combobox", { name: "Language", exact: true })
          .selectOption(locale)
      }
      await page
        .getByRole("button", { name: copy.introduction.start, exact: true })
        .click()
      await expect(
        page.getByRole("button", {
          name: copy.setup.shareProfile,
          exact: true,
        }),
      ).toBeEnabled()
      const before = await savedProfile(page)
      await page
        .getByRole("button", { name: copy.setup.shareProfile, exact: true })
        .click()
      const formats = page.getByRole("group", {
        name: copy.interface.profileCardPreview.imageFormat,
        exact: true,
      })
      for (const format of ["PNG", "GIF", "PNG"] as const) {
        const choice = formats.getByRole("button", {
          name: copy.profile.cardFormats[format],
          exact: true,
        })
        await choice.click()
        await expect(choice).toHaveAttribute("aria-pressed", "true")
      }
      const save = page.getByRole("button", {
        name: copy.profile.saveFormat("PNG"),
        exact: true,
      })
      await expect(save).toBeEnabled()
      await expect(
        page.getByRole("button", {
          name: copy.profile.shareFormat("PNG"),
          exact: true,
        }),
      ).toHaveCount(shareAvailable ? 1 : 0)
      await page.mouse.move(0, 0)
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
        await expect
          .poll(() =>
            formats.evaluate((group) => {
              const footer = group.closest("footer")
              if (footer === null) return false
              const buttons = [...footer.querySelectorAll("button")]
              const [gif, png] = [...group.querySelectorAll("button")].map(
                (button) => button.getBoundingClientRect(),
              )
              return (
                gif !== undefined &&
                png !== undefined &&
                Math.abs(gif.y - png.y) < 1 &&
                Math.abs(gif.width - png.width) < 1 &&
                gif.right <= png.left &&
                buttons.every((button) => {
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
                })
              )
            }),
          )
          .toBe(true)
      }
      expect(await savedProfile(page)).toEqual(before)
      await page
        .getByRole("button", {
          name: copy.interface.profileCardJourney.back,
          exact: true,
        })
        .click()
      await expect(formats).toHaveCount(0)
    })
  }
}
