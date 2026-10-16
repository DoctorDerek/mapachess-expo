import { expect } from "@playwright/test"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

test("a repeatable formatter failure cannot lock out the saved language or erase a match", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => {
    Object.defineProperty(Intl, "NumberFormat", {
      configurable: true,
      value: class BrokenNumberFormat {
        constructor() {
          throw new Error("Injected number formatter failure")
        }
      },
    })
  })
  await page.goto("/")
  await page.getByRole("combobox", { name: "Language" }).selectOption("en")
  await expect
    .poll(async () => (await savedProfile(page)).settings.locale)
    .toBe("en")
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await expect(page.getByRole("combobox", { name: "Language" })).toHaveValue(
    "en",
  )
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).check()
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()
  await page.getByRole("radio", { name: "White", exact: true }).check()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  const e2 = page.getByRole("gridcell", { name: /^e2,/ })
  await expect(e2).toHaveAttribute("aria-disabled", "false", { timeout: 30000 })
  await e2.click()
  await page.getByRole("gridcell", { name: /^e4,/ }).click()
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
      timeout: 30000,
    })
    .toBe(2)
  expect(
    await page.getByText("Text unavailable", { exact: true }).count(),
  ).toBeGreaterThan(0)
  await expect
    .poll(
      async () => (await savedProfile(page)).activeMatch?.moveFeedback?.length,
      { timeout: 30000 },
    )
    .toBe(2)
  const before = await savedProfile(page)
  await page.reload()
  await expect(e2).toHaveAttribute("aria-disabled", "false", { timeout: 30000 })
  expect(await savedProfile(page)).toEqual(before)
  expect(before.settings.locale).toBe("en")
  expect(errors).toEqual([])
})
