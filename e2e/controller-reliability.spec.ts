import { expect } from "@playwright/test"
import {
  CONTROLLER_REPEAT_DELAY_MS,
  CONTROLLER_REPEAT_INTERVAL_MS,
} from "../packages/match/src/playerInputFrame.js"
import prepareControllerInput, { press } from "./controllerInput.js"
import { test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

test("a slow controller poll keeps taps singular and deliberate holds repeating", async ({
  page,
}) => {
  await page.clock.install()
  await prepareControllerInput({ page })
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  const slowFrameMs = CONTROLLER_REPEAT_DELAY_MS + CONTROLLER_REPEAT_INTERVAL_MS
  let completed = false
  const tap = press(page, 13).then(() => {
    completed = true
  })
  for (let sample = 0; sample < 12 && !completed; sample++)
    await page.clock.fastForward(slowFrameMs)
  expect(completed).toBe(true)
  await tap
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeFocused()

  await page.evaluate(() => {
    window.mapachessTestPads[0]!.buttons = [13]
  })
  await page.clock.fastForward(slowFrameMs)
  const firstHeldFocus = await page.locator(":focus").textContent()
  await page.clock.fastForward(slowFrameMs)
  expect(await page.locator(":focus").textContent()).not.toBe(firstHeldFocus)
  await page.evaluate(() => {
    window.mapachessTestPads[0]!.buttons = []
  })
  await page.clock.fastForward(slowFrameMs)
  const releasedFocus = await page.locator(":focus").textContent()
  await page.clock.fastForward(slowFrameMs)
  expect(await page.locator(":focus").textContent()).toBe(releasedFocus)
})

test("controller setup waits for a slow durable Start before asserting Home", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    let delayed = false
    let startClicked = false
    document.addEventListener(
      "click",
      () => {
        startClicked = true
      },
      { capture: true, once: true },
    )
    crypto.subtle.digest = async (algorithm, data) => {
      if (!delayed && startClicked) {
        delayed = true
        const startedAt = performance.now()
        await new Promise<void>((resolve) => setTimeout(resolve, 6000))
        performance.measure("delayed-introduction-save", {
          start: startedAt,
          end: performance.now(),
        })
      }
      return digest(algorithm, data)
    }
  })
  await prepareControllerInput({ page })
  expect(
    await page.evaluate(
      () =>
        performance.getEntriesByName("delayed-introduction-save")[0]?.duration,
    ),
  ).toBeGreaterThan(5000)
  expect((await savedProfile(page)).introductionCompleted).toBe(true)
  await expect(
    page.getByRole("button", { name: "Starting…", exact: true }),
  ).toHaveCount(0)
  await press(page, 13)
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeFocused()
})
