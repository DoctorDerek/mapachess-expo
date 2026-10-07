import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import createInitialMapachessPlayerData from "../packages/profile/src/playerData.js"
import importPlayerData from "./importPlayerData.js"
import savedProfile from "./savedProfile.js"

const earnedChickenProfile = {
  ...createInitialMapachessPlayerData(),
  storyProgress: {
    standard: [{ opponentId: "chicken-stockfish", highestMedal: "bronze" }],
    chess960: [],
  },
} as const

for (const mode of [
  "Standard Chess Story",
  "Chess960 Story",
  "Standard Chess Challenge",
  "Chess960 Challenge",
] as const) {
  test(`${mode} preserves its actual match through customization, export and Resume`, async ({
    page,
  }) => {
    test.setTimeout(90000)
    await page.goto("/")
    await importPlayerData(page, earnedChickenProfile)
    await page
      .getByRole("button", { name: "Customize profile card", exact: true })
      .click()
    await page.getByRole("button", { name: "Animal", exact: true }).click()
    await page.getByRole("radio", { name: "Chicken", exact: true }).check()
    await page
      .getByRole("button", { name: "Save appearance", exact: true })
      .click()
    await expect(
      page.getByText("Saved appearance", { exact: true }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Back", exact: true }).click()
    await page.getByRole("button", { name: mode, exact: true }).click()
    await page.getByRole("button", { name: "Start match", exact: true }).click()
    await expect(page.getByRole("grid", { name: /Chessboard/ })).toBeVisible({
      timeout: 30000,
    })
    await expect(
      page
        .getByRole("img", { name: /^Mapachito:/ })
        .locator('span[style*="background-image"]')
        .last(),
    ).toHaveCSS(
      "background-image",
      mode.endsWith("Story") ? /chicken_/ : /raccoon_/,
    )
    await expect(
      page.getByRole("button", { name: "Move Hints Shown", exact: true }),
    ).toBeVisible({ timeout: 30000 })
    const record = (await savedProfile(page)).activeMatch
    if (record === null) throw new Error("Expected a saved, started match")
    const from = record.playerColor === "white" ? "e2" : "e7"
    const to = record.playerColor === "white" ? "e4" : "e5"
    const piece = page.getByRole("gridcell", { name: new RegExp(`^${from},`) })
    await expect(piece).toHaveAttribute("aria-disabled", "false", {
      timeout: 30000,
    })
    await piece.click()
    await expect(piece).toHaveAttribute("aria-selected", "true")
    await page.getByRole("gridcell", { name: new RegExp(`^${to},`) }).click()
    await expect
      .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
        timeout: 30000,
      })
      .toBeGreaterThan(0)
    await expect
      .poll(
        async () =>
          (await savedProfile(page)).activeMatch?.currentFen.split(" ")[1],
        { timeout: 30000 },
      )
      .toBe(record.playerColor === "white" ? "w" : "b")
    await expect
      .poll(async () => (await savedProfile(page)).activeMatch?.moveHintsUsed, {
        timeout: 30000,
      })
      .toBe(true)
    await page.goBack()
    await expect(
      page.getByRole("heading", { level: 1, name: mode, exact: true }),
    ).toBeVisible()
    await page
      .getByRole("button", { name: "All game modes", exact: true })
      .click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Mapachess", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Resume match", exact: true }),
    ).toBeEnabled()
    const before = await savedProfile(page)
    await page
      .getByRole("button", { name: "Customize profile card", exact: true })
      .click()
    await page.getByRole("button", { name: "Face", exact: true }).click()
    await page.getByRole("button", { name: "Face 6", exact: true }).click()
    await page
      .getByRole("button", { name: "Save appearance", exact: true })
      .click()
    await expect(
      page.getByText("Saved appearance", { exact: true }),
    ).toBeVisible()
    await page
      .getByRole("region", { name: "Customize profile card", exact: true })
      .getByRole("button", { name: "Share profile card", exact: true })
      .click()
    await page.getByRole("button", { name: "PNG · Still", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Save PNG", exact: true }),
    ).toBeEnabled()
    await page.goBack()
    await expect(
      page.getByRole("button", { name: "Face 6", exact: true }),
    ).toHaveAttribute("aria-pressed", "true")
    await page.goForward()
    await expect(
      page.getByRole("button", { name: "GIF · Animated", exact: true }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Back", exact: true }).click()
    await page.getByRole("button", { name: "Back", exact: true }).click()
    const after = await savedProfile(page)
    expect(after.activeMatch).toEqual(before.activeMatch)
    expect({
      ...after,
      appearance: before.appearance,
      revision: before.revision,
    }).toEqual(before)
    await page
      .getByRole("button", { name: "Resume match", exact: true })
      .click()
    await expect(page.getByRole("grid", { name: /Chessboard/ })).toBeVisible()
    expect((await savedProfile(page)).activeMatch).toEqual(before.activeMatch)
    await page.reload()
    await expect(page.getByRole("grid", { name: /Chessboard/ })).toBeVisible({
      timeout: 30000,
    })
    expect((await savedProfile(page)).activeMatch).toEqual(before.activeMatch)
  })
}

test("saves appearance explicitly, keeps preview drafts and returns through Back", async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.goto("/")
  await importPlayerData(page, earnedChickenProfile)
  await expect(
    page.getByRole("button", { name: "Customize profile card" }),
  ).toBeEnabled()
  const before = await savedProfile(page)
  await page.getByRole("button", { name: "Customize profile card" }).click()
  await page.getByRole("button", { name: "Face", exact: true }).click()
  await page.getByRole("button", { name: "Face 5", exact: true }).click()
  await expect(
    page.getByText("Unsaved appearance", { exact: true }),
  ).toBeVisible()
  expect((await savedProfile(page)).appearance).toEqual(before.appearance)
  await page
    .getByRole("region", { name: "Customize profile card", exact: true })
    .getByRole("button", { name: "Share profile card" })
    .click()
  await expect(
    page.getByRole("button", { name: "GIF · Animated" }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByText(/Previewing unsaved appearance/)).toBeVisible()
  await page.getByRole("button", { name: "Back", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Face 5", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Save appearance" }).click()
  await expect(
    page.getByText("Saved appearance", { exact: true }),
  ).toBeVisible()
  const after = await savedProfile(page)
  expect(after.appearance.face).toBe(5)
  expect({
    ...after,
    appearance: before.appearance,
    revision: before.revision,
  }).toEqual(before)
  await page.getByRole("button", { name: "Back", exact: true }).click()
  await page.reload()
  await page.getByRole("button", { name: "Customize profile card" }).click()
  await page.getByRole("button", { name: "Animal", exact: true }).click()
  await expect(
    page.getByRole("radio", { name: "Raccoon Selected", exact: true }),
  ).toBeChecked()
  await page.getByRole("radio", { name: "Chicken", exact: true }).check()
  await page.getByRole("button", { name: "Back", exact: true }).click()
  await expect(
    page.getByRole("alertdialog", { name: "Keep your appearance changes?" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Discard changes" }).click()
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toBeVisible()
  expect((await savedProfile(page)).appearance.animal).toBe("raccoon-stockfish")
})

test("produces actual PNG and animated GIF files without changing the profile", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  await page.getByRole("button", { name: "Share profile card" }).click()
  const before = await savedProfile(page)
  await expect(page.getByRole("button", { name: "Save GIF" })).toBeEnabled({
    timeout: 60000,
  })
  const gifDownload = page.waitForEvent("download")
  await page.getByRole("button", { name: "Save GIF" }).click()
  const gifPath = testInfo.outputPath("profile.gif")
  await (await gifDownload).saveAs(gifPath)
  const gif = await readFile(gifPath)
  expect(gif.subarray(0, 6).toString()).toBe("GIF89a")
  expect(gif.readUInt16LE(6)).toBe(960)
  expect(gif.readUInt16LE(8)).toBe(540)
  expect(gif.length).toBeLessThan(5_000_000)
  expect(gif.includes(Buffer.from("NETSCAPE2.0"))).toBe(true)
  await page.getByRole("button", { name: "PNG · Still" }).click()
  await expect(page.getByRole("button", { name: "Save PNG" })).toBeEnabled()
  const pngDownload = page.waitForEvent("download")
  await page.getByRole("button", { name: "Save PNG" }).click()
  const pngPath = testInfo.outputPath("profile.png")
  await (await pngDownload).saveAs(pngPath)
  const png = await readFile(pngPath)
  expect(png.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  )
  expect(png.readUInt32BE(16)).toBe(960)
  expect(png.readUInt32BE(20)).toBe(540)
  await page.getByRole("checkbox", { name: "Animal companion" }).uncheck()
  await page.getByRole("button", { name: "GIF · Animated" }).click()
  await expect(
    page.getByRole("checkbox", { name: "Animal companion" }),
  ).not.toBeChecked()
  await expect(page.getByRole("button", { name: "Save GIF" })).toBeEnabled({
    timeout: 60000,
  })
  expect(await savedProfile(page)).toEqual(before)
  expect(errors).toEqual([])
})

test("recovers a failed appearance save without losing the draft", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Customize profile card" }).click()
  await page.getByRole("button", { name: "Skin", exact: true }).click()
  await page.getByRole("button", { name: "Skin 4", exact: true }).click()
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function () {
      IDBObjectStore.prototype.put = put
      throw new DOMException("Test storage failure", "QuotaExceededError")
    }
  })
  await page.getByRole("button", { name: "Save appearance" }).click()
  await page.getByRole("button", { name: "Retry save", exact: true }).click()
  await expect(
    page.getByText("Saved appearance", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Skin 4", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  expect((await savedProfile(page)).appearance.skin).toBe(4)
})

test("retries failed artwork through the visible recovery control", async ({
  page,
}) => {
  let failedAsset: string | undefined
  await page.route(
    "**/generated/presentation-assets/profile/hero/**",
    async (route) => {
      if (failedAsset === undefined) {
        failedAsset = route.request().url()
        await route.fulfill({
          status: 503,
          headers: { "cache-control": "no-store" },
          contentType: "text/plain",
          body: "Artwork is temporarily unavailable.",
        })
      } else await route.continue()
    },
  )
  await page.goto("/")
  const failure = page.getByText("Profile artwork could not load.", {
    exact: true,
  })
  await expect(failure).toBeVisible()
  expect(failedAsset).toBeDefined()
  await page.getByRole("button", { name: "Retry artwork", exact: true }).click()
  await expect(failure).toBeHidden()
  await expect
    .poll(() =>
      page
        .getByRole("region", { name: /^Your profile card:/ })
        .locator("canvas")
        .evaluate((element) => {
          if (!(element instanceof HTMLCanvasElement))
            throw new Error("Expected the profile artwork canvas")
          const context = element.getContext("2d")
          if (context === null)
            throw new Error("Expected the profile artwork context")
          return context
            .getImageData(0, 0, element.width, element.height)
            .data.some((value) => value !== 0)
        }),
    )
    .toBe(true)
})

test("keeps Reduced Motion actions stationary and switches preview animation live", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const customize = page.getByRole("button", {
    name: "Customize profile card",
    exact: true,
  })
  await customize.scrollIntoViewIfNeeded()
  await page.mouse.move(0, 0)
  const restingBounds = await customize.boundingBox()
  await customize.hover()
  await expect(customize).toHaveCSS("translate", "none")
  expect(await customize.boundingBox()).toEqual(restingBounds)
  await page.mouse.down()
  await expect(customize).toHaveCSS("translate", "none")
  expect(await customize.boundingBox()).toEqual(restingBounds)
  await page.mouse.move(0, 0)
  await page.mouse.up()

  await page.getByRole("button", { name: "Share profile card" }).click()
  await expect(page.getByRole("button", { name: "Save GIF" })).toBeEnabled({
    timeout: 60000,
  })
  const fingerprint = async (): Promise<string> =>
    page
      .getByRole("img", { name: /Profile card (GIF|PNG) preview/ })
      .locator("canvas")
      .evaluate(async (element) => {
        if (!(element instanceof HTMLCanvasElement))
          throw new Error("Expected the profile preview canvas")
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(element.toDataURL()),
        )
        return Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("")
      })
  const still = await fingerprint()
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await expect.poll(fingerprint).not.toBe(still)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect.poll(fingerprint).toBe(still)
  await page.getByRole("button", { name: "PNG · Still" }).click()
  await expect(page.getByRole("button", { name: "Save PNG" })).toBeEnabled()
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await expect.poll(fingerprint).toBe(still)
  await page.getByRole("button", { name: "GIF · Animated" }).click()
  await expect.poll(fingerprint).not.toBe(still)
})
