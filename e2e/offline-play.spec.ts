import { expect, type Page } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import { firstArrivalTest as test } from "./fixtures.js"
import startOrigin from "./offlineOrigin.js"
import savedProfile from "./savedProfile.js"
import startHintMatch from "./startHintMatch.js"

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

for (const previous of ["selected mode", "saved game"] as const) {
  test(`plays offline after a ${previous} and persists a move with the origin stopped`, async ({
    browser,
    baseURL,
    request,
  }) => {
    test.skip(
      !process.env.PLAYWRIGHT_TEST_BASE_URL &&
        process.env.PLAYWRIGHT_VERCEL_TRUSTED_OIDC !== "true",
      "The service worker is shipped in production builds.",
    )
    test.setTimeout(90_000)
    if (!baseURL) throw Error("A built web target is required")
    const copy = loadCatalog("en")
    const origin = await startOrigin(baseURL, request)
    const context = await browser.newContext({ baseURL: origin.url })
    try {
      const online = await context.newPage()
      const existing = previous === "saved game"
      if (existing) await startHintMatch(online)
      else {
        await online.goto("/")
        await online.getByRole("button", { name: "Start", exact: true }).click()
        await online
          .getByRole("button", {
            name: copy.setup.presentations.standard.challenge.title,
            exact: true,
          })
          .click()
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
      if (existing) expect(id).toBeTruthy()
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
          .getByRole("button", {
            name: copy.setup.presentations.standard.challenge.title,
            exact: true,
          })
          .click()
        await reopened
          .getByRole("radio", { name: copy.setup.white, exact: true })
          .check()
        await reopened
          .getByRole("button", { name: copy.setup.startMatch, exact: true })
          .click()
        await expect(board).toBeVisible()
      }
      const pawn = board.getByRole("gridcell", { name: /^e2,/ })
      await expect(pawn).toHaveAttribute("aria-disabled", "false", {
        timeout: 30000,
      })
      await pawn.click()
      await board.getByRole("gridcell", { name: /^e4,/ }).click()
      await expect
        .poll(async () => (await savedProfile(reopened)).activeMatch, {
          timeout: 30_000,
        })
        .toMatchObject({
          cursor: 2,
          moveIds: ["e2e4", expect.any(String)],
          playerColor: "white",
          startingPosition: { variant: "standard", chess960PositionId: null },
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
