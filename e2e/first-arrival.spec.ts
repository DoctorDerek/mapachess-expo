import AxeBuilder from "@axe-core/playwright"
import { expect } from "@playwright/test"
import {
  activate,
  frames,
  injectControllerInput,
  press,
} from "./controllerInput.js"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"

test("choosing English persists only the locale before Start and retains the document language", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const language = page.getByRole("combobox", { name: "Language" })
  await expect(language).toBeVisible()
  await expect(language.getByRole("option")).toHaveText([
    "English (US)",
    "Español (México)",
  ])
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  const before = await savedProfile(page)
  expect(before.settings.locale).toBeNull()
  await language.selectOption("en")
  const expected = {
    ...before,
    revision: before.revision + 1,
    settings: { ...before.settings, locale: "en" },
  }
  await expect.poll(() => savedProfile(page)).toEqual(expected)
  await page.reload()
  await expect(language).toHaveValue("en")
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible()
  expect(await savedProfile(page)).toEqual(expected)
})

test("controller focus and activation reach Introduction controls through the existing input owner", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await injectControllerInput(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible()
  await frames(page)
  await page.getByRole("region", { name: "Introduction" }).focus()
  await press(page, 13)
  await expect(page.getByRole("combobox", { name: "Language" })).toBeFocused()
  await activate(page, page.getByRole("button", { name: "Start", exact: true }))
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toBeVisible()
})

test("failed primary and fallback Wasm keep the app usable without unhandled errors", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.route("**/generated/first-arrival/*.wasm", (route) =>
    route.abort(),
  )
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible()
  await expect(page.getByTestId("first-arrival-animation")).toHaveCount(0, {
    timeout: 20000,
  })
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("backgrounding cancels the independent crossing even after Rive completes", async ({
  page,
}) => {
  await page.goto("/")
  const runner = page.locator('[aria-hidden="true"] [data-ready="true"]')
  await expect(runner).toHaveCount(1, { timeout: 20000 })
  await expect(page.getByTestId("first-arrival-animation")).toHaveCount(0)
  await expect(runner).toHaveCount(1)
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(runner).toHaveCount(0)
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeEnabled()
  await expect(page.getByTestId("first-arrival-animation")).toHaveCount(0)
})

test("200% text at 320px keeps every control reachable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible()
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  const start = page.getByRole("button", { name: "Start", exact: true })
  await start.scrollIntoViewIfNeeded()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await start.click()
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toBeVisible()
})

test("saves Start once, skips Introduction on return and exposes the same language in Settings", async ({
  page,
}) => {
  const requested: string[] = []
  page.on("request", (request) => requested.push(request.url()))
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const start = page.getByRole("button", { name: "Start", exact: true })
  await expect(start).toBeVisible()
  const before = await savedProfile(page)
  expect(before.introductionCompleted).toBe(false)
  expect(requested.some((url) => url.includes("stockfish-runtime/"))).toBe(
    false,
  )
  expect(
    requested.some((url) => /first-arrival\/.*\.(riv|wasm)/u.test(url)),
  ).toBe(false)
  await expect(page.getByRole("combobox", { name: "Language" })).toHaveValue(
    "en",
  )
  await start.click()
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toBeVisible()
  const after = await savedProfile(page)
  expect(after).toEqual({
    ...before,
    introductionCompleted: true,
    revision: before.revision + 1,
    settings: { ...before.settings, locale: "en" },
  })
  await page.reload()
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible()
  await expect(start).toHaveCount(0)
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await expect(page.getByRole("combobox", { name: "Language" })).toHaveValue(
    "en",
  )
  expect(await savedProfile(page)).toEqual(after)
})

for (const width of [320, 390, 1280]) {
  test(`preserves the approved composition and independent scrolling at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 800 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    const start = page.getByRole("button", { name: "Start", exact: true })
    await expect(start).toBeVisible()
    const before = await start.boundingBox()
    const introduction = page.getByRole("region", { name: "Introduction" })
    await introduction.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    expect(await start.boundingBox()).toEqual(before)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await expect(
      page.getByRole("heading", { name: "Mapachess", exact: true }),
    ).toHaveCSS("color", "rgb(0, 139, 139)")
    await expect(
      page.getByRole("heading", { name: "Mapachess", exact: true }),
    ).toHaveCSS("text-shadow", "none")
    const credit = page.getByRole("link", { name: /DoctorDerek.com/ })
    await expect(credit).toHaveCSS("text-decoration-line", "none")
    await expect(credit).toHaveAttribute("target", "_blank")
    await expect(page.locator("footer img")).toHaveCSS("opacity", "1")
    await introduction.evaluate((element) => {
      element.scrollTop = 0
    })
    await page.screenshot({
      path: testInfo.outputPath(`introduction-${width}.png`),
      fullPage: true,
    })
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  })
}

test("plays the real self-hosted animation and completes the full raccoon crossing independently", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  const runner = page.locator('[aria-hidden="true"] [data-ready="true"]')
  await expect(runner).toHaveCount(1, { timeout: 20000 })
  const sprite = runner.locator("span")
  const frame = await sprite.evaluate(
    (element) => getComputedStyle(element).backgroundPosition,
  )
  await expect
    .poll(() =>
      sprite.evaluate(
        (element) => getComputedStyle(element).backgroundPosition,
      ),
    )
    .not.toBe(frame)
  const before = await runner.boundingBox()
  await expect
    .poll(async () => (await runner.boundingBox())?.x)
    .not.toBe(before?.x)
  await page.screenshot({
    path: testInfo.outputPath("introduction-motion.png"),
    fullPage: true,
  })
  await expect(page.getByTestId("first-arrival-animation")).toHaveCount(0, {
    timeout: 15000,
  })
  await expect(runner).toHaveCount(1)
  await expect(runner).toHaveCount(0, { timeout: 10000 })
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeEnabled()
  expect(errors).toEqual([])
})

test("Start cancels delayed media and never displays a late overlay over the game", async ({
  page,
}) => {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    "**/generated/first-arrival/ice-cream.riv",
    async (route) => {
      await released
      await route.continue()
    },
  )
  await page.goto("/")
  await page.getByRole("button", { name: "Start", exact: true }).click()
  release()
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toBeVisible()
  await expect(page.getByTestId("first-arrival-animation")).toHaveCount(0)
  await expect(page.locator('[aria-hidden="true"] [data-ready]')).toHaveCount(0)
})

test("optional media failure retains a usable static Start", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.route("**/generated/first-arrival/ice-cream.riv", (route) =>
    route.fulfill({
      contentType: "application/octet-stream",
      body: "invalid Rive file",
    }),
  )
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeEnabled()
  await expect(page.getByTestId("first-arrival-animation")).toHaveCount(0, {
    timeout: 20000,
  })
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("does not leave Introduction on a failed save and preserves the pending Start through Retry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible()
  const before = await savedProfile(page)
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function () {
      IDBObjectStore.prototype.put = original
      throw new DOMException(
        "Storage temporarily unavailable",
        "QuotaExceededError",
      )
    }
  })
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Retry save", exact: true }),
  ).toBeVisible()
  expect(await savedProfile(page)).toEqual(before)
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Retry save", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toBeVisible()
  expect((await savedProfile(page)).introductionCompleted).toBe(true)
})

test("keyboard navigation reaches language and Start without reading all introduction text", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("region", { name: "Introduction" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("combobox", { name: "Language" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toBeVisible()
})
