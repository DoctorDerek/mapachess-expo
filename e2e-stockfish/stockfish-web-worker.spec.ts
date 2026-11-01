import { expect, test } from "@playwright/test"
import { STOCKFISH_WEB_WORKER_URL } from "../apps/web/lib/stockfish/createWebStockfishSession"
import type {
  CalibratedOpponentBrowserProof,
  StockfishBrowserProof,
} from "../apps/web/stockfish-integration-harness/stockfishBrowserHarness"
import { WEB_CHALLENGE_PRESETS } from "../packages/stockfish/src/webOpponentPolicy"

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/
const EXPECTED_OPTION_NAMES = [
  "Clear Hash",
  "EvalFile",
  "EvalFileSmall",
  "Hash",
  "Move Overhead",
  "MultiPV",
  "Ponder",
  "Skill Level",
  "Threads",
  "UCI_Chess960",
  "UCI_Elo",
  "UCI_LimitStrength",
  "UCI_ShowWDL",
  "nodestime",
] as const

test("runs and cleans up the real Stockfish Worker lifecycle", async ({
  context,
  page,
}, testInfo) => {
  const requestedUrls: string[] = []
  const failedRequests: string[] = []
  const browserErrors: string[] = []
  const workerUrls: string[] = []
  let closedWorkerCount = 0

  context.on("request", (request) => requestedUrls.push(request.url()))
  context.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.url()}: ${request.failure()?.errorText ?? "unknown"}`,
    )
  })
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  page.on("pageerror", (error) => browserErrors.push(error.message))
  page.on("worker", (worker) => {
    workerUrls.push(worker.url())
    worker.on("close", () => {
      closedWorkerCount += 1
    })
  })

  await page.goto("/")
  const proof = await page.evaluate<StockfishBrowserProof>(() =>
    window.mapachessStockfishBrowserHarness.runProof(),
  )

  expect(proof.standard.identity.name).toBe("Stockfish 18 Lite WASM")
  expect(proof.standard.identity.author).toBe(
    "the Stockfish developers (see AUTHORS file)",
  )
  expect(proof.chess960.identity).toEqual(proof.standard.identity)
  expect(proof.standard.identity.optionNames).toEqual(EXPECTED_OPTION_NAMES)

  expect(proof.standard.initialSearch).toMatchObject({
    requestId: "standard-initial-search",
  })
  expect(proof.standard.initialSearch.bestMove).toMatch(UCI_MOVE)
  expect(proof.standard.initialSearch.informationLineCount).toBeGreaterThan(0)
  expect(proof.standard.cancellation).toEqual({
    errorName: "StockfishOperationAbortedError",
    errorMessage:
      "Stockfish search request standard-cancelled-search was aborted.",
  })
  expect(proof.standard.subsequentSearch).toMatchObject({
    requestId: "standard-subsequent-search",
  })
  expect(proof.standard.subsequentSearch.bestMove).toMatch(UCI_MOVE)
  expect(proof.standard.finalState).toBe("closed")

  expect(proof.chess960.search).toMatchObject({ requestId: "chess960-search" })
  expect(proof.chess960.search.bestMove).toMatch(UCI_MOVE)
  expect(proof.chess960.search.informationLineCount).toBeGreaterThan(0)
  expect(proof.chess960.finalState).toBe("closed")

  testInfo.annotations.push({
    type: "timings-milliseconds",
    description: JSON.stringify(proof.timingsMilliseconds),
  })
  for (const duration of Object.values(proof.timingsMilliseconds)) {
    expect(Number.isFinite(duration)).toBe(true)
    expect(duration).toBeGreaterThanOrEqual(0)
  }

  await expect.poll(() => closedWorkerCount).toBe(2)
  expect(page.workers()).toHaveLength(0)
  expect(workerUrls).toHaveLength(2)
  expect(
    workerUrls.every(
      (url) => new URL(url, page.url()).pathname === STOCKFISH_WEB_WORKER_URL,
    ),
  ).toBe(true)

  const localOrigin = new URL(page.url()).origin
  const externalRequests = requestedUrls.filter((url) => {
    const parsedUrl = new URL(url)
    return (
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") &&
      parsedUrl.origin !== localOrigin
    )
  })
  const requestedPathnames = requestedUrls.map((url) => new URL(url).pathname)

  expect(externalRequests).toEqual([])
  expect(requestedPathnames).toContain(STOCKFISH_WEB_WORKER_URL)
  expect(requestedPathnames).toContain(
    "/stockfish-runtime/stockfish-18-lite-single.wasm",
  )
  expect(failedRequests).toEqual([])
  expect(browserErrors).toEqual([])
})

test("checks every rated Challenge preset through the production opponent and local web Worker", async ({
  page,
}) => {
  await page.goto("/")
  const proof = await page.evaluate<CalibratedOpponentBrowserProof>(() =>
    window.mapachessStockfishBrowserHarness.runCalibratedOpponentProof(),
  )
  for (const variant of ["standard", "chess960"] as const) {
    const result = proof[variant]
    expect(result.identity.name).toBe("Stockfish 18 Lite WASM")
    expect(result.finalState).toBe("closed")
    expect(result.rows).toHaveLength(91)
    const randomMoves = new Set<string>()
    for (const [index, row] of result.rows.entries()) {
      const preset = WEB_CHALLENGE_PRESETS[variant][index]
      expect(row.policy).toMatchObject({
        ...preset,
        nodeLimit: 10_000,
        opponentId: "chicken-stockfish",
        targetElo: 100 + index * 25,
        variant,
      })
      expect(row.policy.fingerprint).not.toBe(row.policy.calibrationFingerprint)
      expect(row.highRollMove).toMatch(UCI_MOVE)
      expect(row.lowRollMove).toMatch(UCI_MOVE)
      const highDraw = { requestId: "grid-proof-20667", nodeLimit: 10_000 }
      if (row.policy.randomMoveProbabilityBasisPoints === 0) {
        expect(row.searches).toEqual([
          highDraw,
          { requestId: "grid-proof-16629", nodeLimit: 10_000 },
        ])
      } else {
        expect(row.searches).toEqual([highDraw])
        randomMoves.add(row.lowRollMove)
      }
    }
    expect(randomMoves.size).toBe(1)
  }
  await expect.poll(() => page.workers().length).toBe(0)
})
