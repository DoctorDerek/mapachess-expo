import { readFile } from "node:fs/promises"
import { expect, type Page } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import type { MatchVariant } from "../packages/match/src/matchVariant.js"
import { firstArrivalTest as test } from "./fixtures.js"
import startOrigin from "./offlineOrigin.js"
import savedProfile from "./savedProfile.js"

const setup = loadCatalog("en").setup

test.use({ serviceWorkers: "allow" })

test.skip(
  !process.env.PLAYWRIGHT_TEST_BASE_URL &&
    process.env.PLAYWRIGHT_VERCEL_TRUSTED_OIDC !== "true",
  "The service worker is shipped in production builds.",
)

async function startWhiteChallenge(page: Page, variant: MatchVariant) {
  await page.getByRole("radio", { name: setup.white, exact: true }).check()
  if (variant === "chess960") await page.getByRole("spinbutton").fill("0")
  await page
    .getByRole("button", { name: setup.startMatch, exact: true })
    .click()
  await expect(page.getByRole("grid", { name: /Chessboard/ })).toBeVisible()
}

async function reopenSavedBoard(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  const board = page.getByRole("grid", { name: /Chessboard/ })
  const resume = page.getByRole("button", {
    name: "Resume match Untimed",
    exact: true,
    disabled: false,
  })
  await expect(board.or(resume).first()).toBeVisible()
  if (await resume.isVisible()) await resume.click()
  await expect(board).toBeVisible()
}

test("a refused offline installation keeps Home usable and retries on the next visit", async ({
  page,
  workerOrigin,
}) => {
  const refusal = "test-only service worker refusal"
  const diagnostics: string[] = []
  page.on("console", (message) => diagnostics.push(message.text()))
  page.on("pageerror", (error) => diagnostics.push(error.message))
  await page.addInitScript((reason) => {
    if (sessionStorage.getItem(reason)) return
    navigator.serviceWorker.register = async () => {
      sessionStorage.setItem(reason, "refused")
      throw new Error(reason)
    }
  }, refusal)
  await page.goto(workerOrigin)
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await expect(
    page.getByRole("button", {
      name: setup.presentations.standard.story.title,
      exact: true,
    }),
  ).toBeEnabled()
  await expect
    .poll(() => page.evaluate((key) => sessionStorage.getItem(key), refusal))
    .toBe("refused")
  expect(
    await page.evaluate(async () =>
      Boolean(await navigator.serviceWorker.getRegistration()),
    ),
  ).toBe(false)
  await page.reload()
  await expect
    .poll(
      () =>
        page.evaluate(
          async () =>
            (await navigator.serviceWorker.getRegistration())?.active?.state,
        ),
      { timeout: 30_000 },
    )
    .toBe("activated")
  expect(diagnostics.join("\n")).not.toContain(refusal)
})

test("exports animated profile cards with an installed offline shell online and offline", async ({
  page,
  context,
  workerOrigin,
}, testInfo) => {
  test.setTimeout(90_000)
  await page.goto(workerOrigin)
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
  const before = await savedProfile(page)
  try {
    for (const offline of [false, true]) {
      await context.setOffline(offline)
      await page
        .getByRole("button", { name: "Share profile card", exact: true })
        .click()
      const save = page.getByRole("button", { name: "Save GIF", exact: true })
      await expect(save).toBeEnabled({ timeout: 60_000 })
      const download = page.waitForEvent("download")
      await save.click()
      const path = testInfo.outputPath(offline ? "offline.gif" : "online.gif")
      await (await download).saveAs(path)
      const gif = await readFile(path)
      expect(gif.subarray(0, 6).toString()).toBe("GIF89a")
      expect(gif.readUInt16LE(6)).toBe(960)
      expect(gif.readUInt16LE(8)).toBe(540)
      expect(gif.includes(Buffer.from("NETSCAPE2.0"))).toBe(true)
      expect(gif.length).toBeLessThan(5_000_000)
      await page.getByRole("button", { name: "Back", exact: true }).click()
      expect(await savedProfile(page)).toEqual(before)
    }
  } finally {
    await context.setOffline(false)
  }
})

for (const [variant, previous] of [
  ["standard", "selected mode"],
  ["standard", "saved game"],
  ["chess960", "selected mode"],
  ["chess960", "saved game"],
] as const) {
  test(`plays ${variant} offline after a ${previous} and restores both plies with the origin stopped`, async ({
    browser,
    baseURL,
    request,
  }) => {
    test.setTimeout(90_000)
    if (!baseURL) throw Error("A built web target is required")
    const modeTitle = setup.presentations[variant].challenge.title
    const origin = await startOrigin(baseURL, request)
    const context = await browser.newContext({ baseURL: origin.url })
    try {
      const online = await context.newPage()
      const existing = previous === "saved game"
      await online.goto("/")
      await online.getByRole("button", { name: "Start", exact: true }).click()
      await online.getByRole("button", { name: modeTitle, exact: true }).click()
      if (existing) {
        await startWhiteChallenge(online, variant)
        await expect
          .poll(async () => (await savedProfile(online)).activeMatch?.matchId)
          .toBeTruthy()
      }
      await online.evaluate(async () => {
        await navigator.serviceWorker.ready
      })
      await expect
        .poll(() =>
          online.evaluate(() => Boolean(navigator.serviceWorker.controller)),
        )
        .toBe(true)
      const id = existing
        ? (await savedProfile(online)).activeMatch?.matchId
        : undefined
      const rosterStrips = await online.evaluate(async () => {
        const names = (await caches.keys()).filter((name) =>
          name.includes("precache"),
        )
        const entries = (
          await Promise.all(
            names.map(async (name) => (await caches.open(name)).keys()),
          )
        ).flat()
        return entries.filter((entry) =>
          new URL(entry.url).pathname.startsWith(
            "/generated/presentation-assets/battle/",
          ),
        ).length
      })
      expect(rosterStrips).toBe(0)

      await expect
        .poll(
          () =>
            online.evaluate(async () => {
              const programs = await caches.open("mapachess-stockfish-program")
              return (await programs.keys()).length
            }),
          {
            timeout: 30_000,
            message: "Wait for the first chess download to reach Cache Storage",
          },
        )
        .toBe(2)
      const reopened = await context.newPage()
      await online.close()
      await origin.close()
      await expect(fetch(origin.url)).rejects.toThrow()
      const board = reopened.getByRole("grid", { name: /Chessboard/ })
      if (existing) {
        await reopenSavedBoard(reopened)
        expect((await savedProfile(reopened)).activeMatch?.matchId).toBe(id)
      } else {
        await reopened.goto("/")
        await reopened
          .getByRole("button", { name: modeTitle, exact: true })
          .click()
        await startWhiteChallenge(reopened, variant)
      }
      await expect
        .poll(
          async () => (await savedProfile(reopened)).activeMatch?.moveHintsUsed,
          {
            timeout: 30_000,
            message:
              "Wait for the default automatic hints to finish saving offline",
          },
        )
        .toBe(true)
      const isChess960 = variant === "chess960"
      const piece = board.getByRole("gridcell", {
        name: isChess960 ? /^d1, White knight/ : /^e2, White pawn/,
      })
      await expect(piece).toHaveAttribute("aria-disabled", "false", {
        timeout: 30000,
      })
      await piece.click()
      await expect(piece).toHaveAttribute("aria-selected", "true")
      await board
        .getByRole("gridcell", {
          name: isChess960
            ? /^c3, empty, legal destination/
            : /^e4, empty, legal destination/,
        })
        .click()
      await expect
        .poll(async () => (await savedProfile(reopened)).activeMatch, {
          timeout: 30_000,
        })
        .toMatchObject({
          cursor: 2,
          moveIds: [isChess960 ? "d1c3" : "e2e4", expect.any(String)],
          playerColor: "white",
          startingPosition: {
            variant,
            chess960PositionId: isChess960 ? 0 : null,
          },
        })
      const played = (await savedProfile(reopened)).activeMatch
      if (!played) throw new Error("Expected the saved two-ply game")
      await reopened.close()
      const restored = await context.newPage()
      await reopenSavedBoard(restored)
      expect((await savedProfile(restored)).activeMatch).toMatchObject({
        matchId: played.matchId,
        startingPosition: played.startingPosition,
        currentFen: played.currentFen,
        cursor: played.cursor,
        moveIds: played.moveIds,
      })
    } finally {
      await context.close()
      await origin.close()
    }
  })
}
