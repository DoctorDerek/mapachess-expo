import { expect, type Page } from "@playwright/test"
import { test } from "../e2e/fixtures.js"
import savedProfile from "../e2e/savedProfile.js"

async function playPair(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.clock.install()
  await page.goto("/")
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()
  await page.getByRole("radio", { name: "White", exact: true }).check()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  const origin = page.getByRole("gridcell", { name: /^e2,/ })
  await expect(origin).toHaveAttribute("aria-disabled", "false")
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await origin.focus()
  await expect(origin).toHaveAttribute("tabindex", "0")
  await origin.press("Enter")
  await expect(origin).toHaveAttribute("aria-selected", "true")
  const destination = page.getByRole("gridcell", { name: /^e4,/ })
  await destination.focus()
  await expect(destination).toHaveAttribute("tabindex", "0")
  await destination.press("Enter")
  await expect(page.getByRole("button", { name: /^Dismiss / })).toHaveCount(2)
}

test("timeline navigation clears cards without replaying retained grades", async ({
  page,
}) => {
  await playPair(page)
  const cards = page.getByRole("button", { name: /^Dismiss / })
  const played = (await savedProfile(page)).activeMatch
  await page.getByRole("button", { name: /Undo$/ }).click()
  await expect(cards).toHaveCount(0)
  await page.getByRole("button", { name: "Redo", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Redo", exact: true }),
  ).toBeDisabled()
  await page.clock.runFor(100)
  await expect(cards).toHaveCount(0)
  expect((await savedProfile(page)).activeMatch?.moveFeedback).toEqual(
    played?.moveFeedback,
  )
  await page.getByLabel("Match menu", { exact: true }).click()
  await page.getByText("Match details & Move History", { exact: true }).click()
  const history = page.getByRole("region", { name: "Move History" })
  await expect(history).toContainText("1. e4")
  await expect(history).toContainText("1...")
  await expect(history).not.toContainText("Lost forced mate")
})

test("independent five-second cards retain their full grade without replay after reload", async ({
  page,
}) => {
  await playPair(page)
  const white = page.getByRole("button", { name: /^Dismiss White 1\. e4 / })
  const black = page.getByRole("button", { name: /^Dismiss Black 1\.\.\. / })
  await expect(white).toHaveCSS("background-color", "rgb(255, 255, 255)")
  await expect(black).toHaveCSS("background-color", "rgb(30, 30, 30)")
  await expect(white).toHaveText(
    /^1\. e4 (Brilliant !!|Genius !|Best ★|Good ✓|Inaccuracy \?!|Mistake \?|Blunder \?\?)$/,
  )
  await page.clock.runFor(4400)
  await expect(white).toBeVisible()
  await expect(black).toBeVisible()
  await page.clock.runFor(700)
  await expect(page.getByRole("button", { name: /^Dismiss / })).toHaveCount(0)
  const before = (await savedProfile(page)).activeMatch
  await page.reload()
  await expect(page.getByRole("grid")).toBeVisible()
  await expect(page.getByRole("button", { name: /^Dismiss / })).toHaveCount(0)
  expect((await savedProfile(page)).activeMatch).toEqual(before)
})
