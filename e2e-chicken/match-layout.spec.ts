import { createHash } from "node:crypto"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { webMatchId } from "../apps/web/lib/gameplay/webOpponent"
import {
  MAPACHESS_INDEXED_DB_CURRENT_KEY,
  MAPACHESS_INDEXED_DB_NAME,
  MAPACHESS_INDEXED_DB_PLAYER_DATA_STORE,
} from "../apps/web/lib/profile/IndexedDbDurableStore"
import { parseChess960PositionId } from "../packages/match/dist/chess960Position.js"
import {
  listLegalMatchMoves,
  type MatchMoveId,
} from "../packages/match/dist/matchMove.js"
import { createInitialMatchPosition } from "../packages/match/dist/matchPosition.js"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  currentMatchPosition,
} from "../packages/match/dist/matchTimeline.js"
import { requireSha256Hex } from "../packages/profile/dist/sha256.js"
import {
  decodeStoredPlayerData,
  encodeStoredPlayerData,
} from "../packages/profile/dist/storedPlayerData.js"
import { parseDeterministicRandomSeed } from "../packages/stockfish/dist/opponentMoveSelection.js"

const digest = async (value: string) =>
  requireSha256Hex(createHash("sha256").update(value).digest("hex"))
const databaseConfig = {
  database: MAPACHESS_INDEXED_DB_NAME,
  store: MAPACHESS_INDEXED_DB_PLAYER_DATA_STORE,
  key: MAPACHESS_INDEXED_DB_CURRENT_KEY,
}

const startMatch = async (page: Page) => {
  await page.goto("/")
  await page.getByRole("button", { name: /Standard Challenge/ }).click()
  await page.getByRole("radio", { name: "White", exact: true }).check()
  await page.getByRole("button", { name: /Start match/ }).click()
  await expect(page.getByRole("meter")).toHaveAttribute(
    "aria-valuetext",
    /White|Black|Even/,
  )
}

const resumeLegalGame = async (
  page: Page,
  moves: readonly string[],
  playerColor: "white" | "black",
  mode: "story" | "challenge",
  variant: "standard" | "chess960",
) => {
  await startMatch(page)
  await page.route("**/layout-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Local save fixture</title>",
    }),
  )
  await page.goto("/layout-fixture")
  const raw = await page.evaluate(async ({ database, store, key }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(database)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<string>((resolve, reject) => {
        const request = db
          .transaction(store, "readonly")
          .objectStore(store)
          .get(key)
        request.onsuccess = () =>
          typeof request.result === "string"
            ? resolve(request.result)
            : reject(new Error("Missing saved match"))
        request.onerror = () => reject(request.error)
      })
    } finally {
      db.close()
    }
  }, databaseConfig)
  const decoded = await decodeStoredPlayerData(raw, digest)
  if (!decoded.ok || decoded.data.activeMatch === null)
    throw new Error("Fixture requires a valid application save")
  const match = decoded.data.activeMatch
  const matchSeed = parseDeterministicRandomSeed(
    "00000001000000020000000300000004",
    "layout fixture",
  )
  const parsedPosition = parseChess960PositionId(518)
  if (!parsedPosition.ok) throw new Error("Invalid Chess960 fixture position")
  const startingPosition =
    variant === "chess960"
      ? { variant, chess960PositionId: parsedPosition.positionId }
      : match.startingPosition
  let timeline = createMatchTimeline(
    createInitialMatchPosition(startingPosition),
  )
  const moveIds: MatchMoveId[] = []
  for (const uci of moves) {
    const move = listLegalMatchMoves(currentMatchPosition(timeline)).find(
      (candidate) => candidate.uci === uci,
    )
    if (move === undefined) throw new Error(`Illegal fixture move ${uci}`)
    const applied = applyMatchTimelineMove(timeline, move.id)
    if (!applied.ok) throw new Error(`Unapplied fixture move ${uci}`)
    timeline = applied.timeline
    moveIds.push(move.id)
  }
  const encoded = await encodeStoredPlayerData(
    {
      ...decoded.data,
      activeMatch: {
        ...match,
        matchSeed,
        matchId: webMatchId(
          matchSeed,
          startingPosition,
          { mode, playerColor },
          match.opponentId,
        ),
        mode,
        startingPosition,
        playerColor,
        currentFen: currentMatchPosition(timeline).fen,
        cursor: moveIds.length,
        moveIds,
        moveFeedback: [],
        conclusion: null,
      },
    },
    digest,
  )
  await page.evaluate(
    async ({ database, store, key, encoded }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(database)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(store, "readwrite")
          transaction.objectStore(store).put(encoded, key)
          transaction.oncomplete = () => resolve()
          transaction.onerror = () => reject(transaction.error)
        })
      } finally {
        db.close()
      }
    },
    { ...databaseConfig, encoded },
  )
  await page.goto("/")
  await expect(page.getByRole("grid", { name: /Chessboard/ })).toBeVisible()
  await expect(page.getByRole("meter")).toHaveAttribute(
    "aria-valuetext",
    /White|Black|Even/,
  )
}

const geometry = async (locator: Locator) =>
  locator.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return {
      x: box.x + scrollX,
      y: box.y + scrollY,
      width: box.width,
      height: box.height,
    }
  })

const stableGeometry = async (page: Page) => ({
  board: await geometry(page.getByRole("grid", { name: /Chessboard/ })),
  stage: await geometry(
    page.getByRole("region", { name: "Reactive Battle Stage" }),
  ),
  undo: await geometry(page.getByRole("button", { name: "Undo", exact: true })),
  redo: await geometry(page.getByRole("button", { name: "Redo", exact: true })),
  menu: await geometry(page.getByLabel("Match menu", { exact: true })),
})

for (const config of [
  {
    width: 412,
    height: 915,
    color: "white",
    mode: "story",
    font: 16,
    variant: "standard",
  },
  {
    width: 1280,
    height: 800,
    color: "white",
    mode: "story",
    font: 16,
    variant: "standard",
  },
  {
    width: 1440,
    height: 900,
    color: "black",
    mode: "challenge",
    font: 16,
    variant: "standard",
  },
  {
    width: 320,
    height: 915,
    color: "black",
    mode: "challenge",
    font: 24,
    variant: "standard",
  },
  {
    width: 412,
    height: 915,
    color: "white",
    mode: "story",
    font: 16,
    variant: "chess960",
  },
  {
    width: 1280,
    height: 800,
    color: "black",
    mode: "challenge",
    font: 16,
    variant: "chess960",
  },
] as const) {
  test(`${config.variant} checkmate preserves layout at ${config.width} with ${config.color} hero and ${config.font}px text`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: config.width, height: config.height })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await resumeLegalGame(
      page,
      config.color === "white"
        ? ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6"]
        : ["f2f3", "e7e5", "g2g4"],
      config.color,
      config.mode,
      config.variant,
    )
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}px`
    }, config.font)
    const before = await stableGeometry(page)
    const meter = await geometry(page.getByRole("meter"))
    expect(meter.x).toBe(before.board.x)
    expect(meter.width).toBe(before.board.width)
    expect(meter.y + meter.height).toBe(before.board.y)
    if (config.width < 1280) expect(before.board.width).toBe(config.width)
    else
      expect(before.board.width).toBeGreaterThan(config.height - 18 * 16 - 24)
    await page.screenshot({
      path: testInfo.outputPath("before-checkmate.png"),
      fullPage: true,
    })
    const origin = page.getByRole("gridcell", {
      name: new RegExp(`^${config.color === "white" ? "h5" : "d8"},`),
    })
    await expect(origin).toHaveAttribute("aria-disabled", "false")
    await origin.click()
    await page
      .getByRole("gridcell", {
        name: new RegExp(`^${config.color === "white" ? "f7" : "h4"},`),
      })
      .click()
    const label = `${config.color === "white" ? "White" : "Black"} checkmate`
    await expect(page.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      label,
    )
    const result = page.getByRole("region", {
      name: "Match result",
      exact: true,
    })
    await expect(
      result.getByRole("heading", { name: "You won!" }),
    ).toBeVisible()
    if (config.mode === "story")
      await expect(result).toContainText("Bronze this match · Saved")
    else await expect(result).not.toContainText("Saved")
    expect(await stableGeometry(page)).toEqual(before)
    const resultBox = await geometry(result)
    expect(resultBox.y).toBeGreaterThan(before.menu.y + before.menu.height)
    if (config.width < 1280)
      expect(resultBox.y).toBeGreaterThanOrEqual(
        before.stage.y + before.stage.height,
      )
    else
      expect(resultBox.x).toBeGreaterThan(before.board.x + before.board.width)
    const scoreBox = await geometry(page.getByRole("meter").locator("span"))
    expect(scoreBox.x + scoreBox.width / 2).toBeCloseTo(
      meter.x + meter.width / 2,
      0,
    )
    expect(scoreBox.y + scoreBox.height / 2).toBeCloseTo(
      meter.y + meter.height / 2,
      0,
    )
    await expect(
      page.getByText("Checkmate — you won.", { exact: true }),
    ).toHaveCount(0)
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({
      path: testInfo.outputPath("after-checkmate.png"),
      fullPage: true,
    })
  })
}

for (const ending of [
  { action: "Resign", result: "You resigned — Chicken Stockfish won." },
  { action: "Offer Draw", result: "Draw by agreement." },
] as const) {
  test(`${ending.action} remains below stable controls and battle`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await startMatch(page)
    const before = await stableGeometry(page)
    await page.getByLabel("Match menu", { exact: true }).click()
    await page.getByRole("button", { name: ending.action, exact: true }).click()
    await expect(
      page.getByRole("region", { name: "Match result", exact: true }),
    ).toContainText(ending.result)
    await page.getByLabel("Match menu", { exact: true }).click()
    expect(await stableGeometry(page)).toEqual(before)
    await page.screenshot({
      path: testInfo.outputPath("non-checkmate-result.png"),
      fullPage: true,
    })
  })
}
