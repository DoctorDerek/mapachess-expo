import { readFile } from "node:fs/promises"
import { expect, type Page } from "@playwright/test"
import {
  PROFILE_CARD_HEIGHT,
  PROFILE_CARD_LAYOUT,
} from "../apps/web/lib/presentation/profileCardFormat.js"
import createInitialMapachessPlayerData from "../packages/profile/src/playerData.js"
import { test } from "./fixtures.js"
import importPlayerData from "./importPlayerData.js"
import chooseDressingCategory from "./profileDressingRoom.js"
import savedProfile from "./savedProfile.js"

const earnedChickenProfile = {
  ...createInitialMapachessPlayerData(),
  storyProgress: {
    standard: [{ opponentId: "chicken-stockfish", highestMedal: "bronze" }],
    chess960: [],
  },
} as const

const liveCharacterArtwork = (page: Page): Promise<string> =>
  page
    .getByRole("region", { name: "Customize profile card", exact: true })
    .locator("canvas")
    .first()
    .evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement))
        throw new Error("Expected the live character preview")
      return canvas.toDataURL()
    })

for (const width of [390, 1440]) {
  test(`card rating context saves, cancels and exports at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width, height: 900 })
    const initial = createInitialMapachessPlayerData()
    await page.goto("/")
    await importPlayerData(page, {
      ...initial,
      ratings: {
        ...initial.ratings,
        "standard-blitz-silver": 432.49,
        "chess960-blitz-silver": 678.76,
      },
    })
    const original = await savedProfile(page)
    await page
      .getByRole("button", { name: "Customize profile card", exact: true })
      .click()
    await page
      .getByRole("combobox", { name: "Time category", exact: true })
      .selectOption("blitz")
    await page
      .getByRole("combobox", { name: "Medal tier", exact: true })
      .selectOption("silver")
    const card = page.getByRole("region", {
      name: /^Your profile card:.*Blitz/,
    })
    await expect(card).toHaveAccessibleName(/Blitz.*Silver.*432.*679/)
    const medals = card.locator('img[aria-hidden="true"]')
    await expect(medals).toHaveCount(2)
    await expect
      .poll(() =>
        medals.evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0,
          ),
        ),
      )
      .toBe(true)
    const medalSource = await medals.first().getAttribute("src")
    if (medalSource === null)
      throw new Error("Expected the selected medal image")
    expect(medalSource).toContain("silver")
    const medalBounds = await medals.first().boundingBox()
    expect(medalBounds?.width).toBeCloseTo(24, 2)
    expect(medalBounds?.height).toBeCloseTo(24, 2)
    await expect(page.getByText("Unsaved changes", { exact: true })).toHaveText(
      "Unsaved changes",
    )
    await expect(
      page.getByRole("button", { name: "Save changes", exact: true }),
    ).toBeEnabled()
    expect((await savedProfile(page)).settings.cardRatingContext).toEqual(
      original.settings.cardRatingContext,
    )
    await page
      .getByRole("button", { name: "Cancel changes", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Customize profile card", exact: true })
      .click()
    await expect(
      page.getByRole("combobox", { name: "Time category", exact: true }),
    ).toHaveValue("untimed")
    await expect(
      page.getByRole("combobox", { name: "Medal tier", exact: true }),
    ).toHaveValue("bronze")
    await page
      .getByRole("combobox", { name: "Time category", exact: true })
      .selectOption("blitz")
    await page
      .getByRole("combobox", { name: "Medal tier", exact: true })
      .selectOption("silver")
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click()
    await expect(page.getByText("Changes saved", { exact: true })).toBeVisible()
    const saved = await savedProfile(page)
    expect(saved.settings.cardRatingContext).toEqual({
      category: "blitz",
      assistance: "silver",
    })
    expect({
      ...saved,
      settings: original.settings,
      revision: original.revision,
    }).toEqual(original)
    await page.screenshot({
      path: testInfo.outputPath(`card-context-${width}.png`),
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page
      .getByRole("region", { name: "Customize profile card", exact: true })
      .getByRole("button", { name: "Share profile card", exact: true })
      .click()
    await page.getByRole("button", { name: "PNG · Still", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Save PNG", exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole("checkbox", {
        name: "Standard Chess Elo · Blitz · Silver",
        exact: true,
      }),
    ).toBeChecked()
    await page
      .getByRole("img", { name: "Profile card PNG preview", exact: true })
      .screenshot({ path: testInfo.outputPath("contextual-card.png") })
    expect(
      await page
        .getByRole("img", { name: "Profile card PNG preview", exact: true })
        .locator("canvas")
        .evaluate(
          async (canvas, { source, layout, height }) => {
            if (!(canvas instanceof HTMLCanvasElement))
              throw new Error("Expected the exported card canvas")
            const actual = canvas.getContext("2d")
            if (actual === null)
              throw new Error("Expected the card rendering context")
            const medal = new Image()
            medal.src = source
            await medal.decode()
            const reference = document.createElement("canvas")
            reference.width = layout.medalSize
            reference.height = layout.medalSize
            const expected = reference.getContext("2d")
            if (expected === null)
              throw new Error("Expected the reference image context")
            const [red, green, blue] = actual.getImageData(0, 0, 1, 1).data
            expected.fillStyle = `rgb(${red}, ${green}, ${blue})`
            expected.fillRect(0, 0, layout.medalSize, layout.medalSize)
            expected.drawImage(medal, 0, 0, layout.medalSize, layout.medalSize)
            const actualPixels = actual.getImageData(
              layout.factsInset,
              (height - layout.invitationHeight) / 2 +
                layout.categoryOffset -
                layout.medalSize / 2,
              layout.medalSize,
              layout.medalSize,
            ).data
            const expectedPixels = expected.getImageData(
              0,
              0,
              layout.medalSize,
              layout.medalSize,
            ).data
            return (
              actualPixels.reduce(
                (difference, value, index) =>
                  difference + Math.abs(value - expectedPixels[index]),
                0,
              ) / actualPixels.length
            )
          },
          {
            source: medalSource,
            layout: PROFILE_CARD_LAYOUT,
            height: PROFILE_CARD_HEIGHT,
          },
        ),
    ).toBeLessThan(1)
    await page.getByRole("button", { name: "Back", exact: true }).click()
    await expect(
      page.getByRole("heading", {
        name: "Customize profile card",
        exact: true,
      }),
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Cancel changes", exact: true })
      .click()
    await expect(
      page.getByRole("heading", {
        name: "Customize profile card",
        exact: true,
      }),
    ).toHaveCount(0)
    await page.reload()
    await expect(
      page.getByRole("region", { name: /^Your profile card:/ }),
    ).toHaveAccessibleName(/Blitz.*Silver.*432.*679/)
  })
}

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
    await chooseDressingCategory(page, "Animal")
    await page.getByRole("radio", { name: "Chicken", exact: true }).check()
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click()
    await expect(page.getByText("Changes saved", { exact: true })).toBeVisible()
    await page
      .getByRole("button", { name: "Cancel changes", exact: true })
      .click()
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
      page.getByRole("button", { name: "Resume match Untimed", exact: true }),
    ).toBeEnabled()
    const before = await savedProfile(page)
    await page
      .getByRole("button", { name: "Customize profile card", exact: true })
      .click()
    await chooseDressingCategory(page, "Face")
    await page.getByRole("button", { name: "Face 6", exact: true }).click()
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click()
    await expect(page.getByText("Changes saved", { exact: true })).toBeVisible()
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
    await page
      .getByRole("button", { name: "Cancel changes", exact: true })
      .click()
    const after = await savedProfile(page)
    expect(after.activeMatch).toEqual(before.activeMatch)
    expect({
      ...after,
      appearance: before.appearance,
      revision: before.revision,
    }).toEqual(before)
    await page
      .getByRole("button", { name: "Resume match Untimed", exact: true })
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
  await chooseDressingCategory(page, "Face")
  await page.getByRole("button", { name: "Face 5", exact: true }).click()
  await expect(
    page.getByRole("status").filter({ hasText: "Unsaved changes" }),
  ).toHaveText("Unsaved changes")
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeEnabled()
  expect((await savedProfile(page)).appearance).toEqual(before.appearance)
  await page
    .getByRole("region", { name: "Customize profile card", exact: true })
    .getByRole("button", { name: "Share profile card" })
    .click()
  await expect(
    page.getByRole("button", { name: "GIF · Animated" }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByText(/Previewing unsaved changes/)).toBeVisible()
  await page.getByRole("button", { name: "Back", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Face 5", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Changes saved", { exact: true })).toBeVisible()
  const after = await savedProfile(page)
  expect(after.appearance.face).toBe(5)
  expect({
    ...after,
    appearance: before.appearance,
    revision: before.revision,
  }).toEqual(before)
  await page
    .getByRole("button", { name: "Cancel changes", exact: true })
    .click()
  await expect(
    page.getByRole("region", { name: "Customize profile card", exact: true }),
  ).toHaveCount(0)
  await page.reload()
  await page.getByRole("button", { name: "Customize profile card" }).click()
  await chooseDressingCategory(page, "Animal")
  await expect(
    page.getByRole("radio", { name: "Raccoon Selected", exact: true }),
  ).toBeChecked()
  await page.getByRole("radio", { name: "Chicken", exact: true }).check()
  await page.goBack()
  await expect(
    page.getByRole("group", { name: "Appearance categories", exact: true }),
  ).toBeVisible()
  expect((await savedProfile(page)).appearance.animal).toBe("raccoon-stockfish")
  await page.goBack()
  await expect(
    page.getByRole("alertdialog", { name: "Keep your profile-card changes?" }),
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
  await page
    .getByRole("button", { name: "Customize profile card", exact: true })
    .click()
  const before = await savedProfile(page)
  await chooseDressingCategory(page, "Weapons")
  await page.getByRole("button", { name: "Axe", exact: true }).click()
  await page
    .getByRole("region", { name: "Customize profile card", exact: true })
    .getByRole("button", { name: "Share profile card", exact: true })
    .click()
  await expect(page.getByText(/Previewing unsaved changes/)).toBeVisible()
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
  const card = page
    .getByRole("img", { name: "Profile card PNG preview", exact: true })
    .locator("canvas")
  expect(
    await card.evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement))
        throw new Error("Expected the profile card canvas")
      const context = canvas.getContext("2d")
      if (context === null) throw new Error("Expected a card rendering context")
      return {
        facts: [...context.getImageData(0, 0, 1, 1).data],
        artwork: [...context.getImageData(canvas.width - 1, 0, 1, 1).data],
        invitation: [...context.getImageData(0, canvas.height - 1, 1, 1).data],
      }
    }),
  ).toEqual({
    facts: [255, 230, 82, 255],
    artwork: [113, 223, 231, 255],
    invitation: [30, 30, 30, 255],
  })
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

test("keeps medal labels and recovers an unavailable medal image without changing progress", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  const card = page.getByRole("region", { name: /^Your profile card:/ })
  await expect(card).toBeVisible()
  const medalRequest = await card
    .locator('img[aria-hidden="true"]')
    .first()
    .evaluate((image) => {
      if (!(image instanceof HTMLImageElement))
        throw new Error("Expected the card medal image")
      return image.src
    })
  let blockedMedals = 0
  await page.route(medalRequest, (route) => {
    blockedMedals += 1
    return route.abort("failed")
  })
  await page.reload()
  await expect.poll(() => blockedMedals).toBeGreaterThan(0)
  await expect(card).toHaveAccessibleName(/Untimed.*Bronze/)
  await expect(
    page.getByRole("button", { name: "Standard Chess Story", exact: true }),
  ).toBeEnabled()
  const before = await savedProfile(page)
  await page
    .getByRole("button", { name: "Share profile card", exact: true })
    .click()
  await page.getByRole("button", { name: "PNG · Still", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Retry PNG", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Save PNG", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Retry PNG", exact: true }),
  ).toBeInViewport({ ratio: 1 })
  await page.unroute(medalRequest)
  await page.getByRole("button", { name: "Retry artwork", exact: true }).click()
  await page.getByRole("button", { name: "Retry PNG", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Save PNG", exact: true }),
  ).toBeEnabled()
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0)
  expect(await savedProfile(page)).toEqual(before)
  expect(errors).toEqual([])
})

test("recovers a failed appearance save without losing the draft", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Customize profile card" }).click()
  await chooseDressingCategory(page, "Skin")
  await page.getByRole("button", { name: "Skin 4", exact: true }).click()
  await chooseDressingCategory(page, "Weapons")
  await page.getByRole("button", { name: "Sword", exact: true }).click()
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function () {
      IDBObjectStore.prototype.put = put
      throw new DOMException("Test storage failure", "QuotaExceededError")
    }
  })
  await page.getByRole("button", { name: "Save changes" }).click()
  await page.getByRole("button", { name: "Retry save", exact: true }).click()
  await expect(page.getByText("Changes saved", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Sword", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  expect((await savedProfile(page)).appearance.skin).toBe(4)
  expect((await savedProfile(page)).appearance.weapon).toBe("weapon1")
})

test("previews every weapon without changing saved equipment", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await page
    .getByRole("button", { name: "Customize profile card", exact: true })
    .click()
  const before = await savedProfile(page)
  await chooseDressingCategory(page, "Weapons")
  const fingerprint = () => liveCharacterArtwork(page)
  let previous = await fingerprint()
  for (const name of ["Sword", "Spear", "Wand", "Axe", "Dagger", "None"]) {
    await page.getByRole("button", { name, exact: true }).click()
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true")
    await expect.poll(fingerprint).not.toBe(previous)
    previous = await fingerprint()
  }
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled()
  expect(await savedProfile(page)).toEqual(before)
})

test("previews every dagger palette and preserves only explicitly saved equipment", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await page
    .getByRole("button", { name: "Customize profile card", exact: true })
    .click()
  const before = await savedProfile(page)
  await chooseDressingCategory(page, "Weapons")
  await page.getByRole("button", { name: "Dagger", exact: true }).click()
  const fingerprint = () => liveCharacterArtwork(page)
  let previous = await fingerprint()
  for (const color of [2, 3, 4, 1, 4]) {
    const choice = page.getByRole("button", {
      name: `Dagger color ${color}`,
      exact: true,
    })
    await choice.click()
    await expect(choice).toHaveAttribute("aria-pressed", "true")
    await expect.poll(fingerprint).not.toBe(previous)
    previous = await fingerprint()
  }
  expect(await savedProfile(page)).toEqual(before)
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page.getByText("Changes saved", { exact: true })).toBeVisible()
  await page
    .getByRole("button", { name: "Cancel changes", exact: true })
    .click()
  await expect(
    page.getByRole("region", { name: "Customize profile card", exact: true }),
  ).toBeHidden()
  await page.reload()
  expect((await savedProfile(page)).appearance.weapon).toBe("weapon5_c4")
  await page
    .getByRole("button", { name: "Customize profile card", exact: true })
    .click()
  await chooseDressingCategory(page, "Weapons")
  await expect(
    page.getByRole("button", { name: "Dagger", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Axe", exact: true }).click()
  await page
    .getByRole("button", { name: "Cancel changes", exact: true })
    .click()
  await expect(
    page.getByRole("region", { name: "Customize profile card", exact: true }),
  ).toBeHidden()
  await expect(
    page.getByRole("button", { name: "Customize profile card", exact: true }),
  ).toBeVisible()
  expect((await savedProfile(page)).appearance.weapon).toBe("weapon5_c4")
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
