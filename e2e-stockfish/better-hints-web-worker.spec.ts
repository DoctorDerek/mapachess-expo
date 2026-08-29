import { expect, test } from "@playwright/test"
import type { BetterHintsBrowserProof } from "../apps/web/stockfish-integration-harness/stockfishBrowserHarness"

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/
type BetterHintsProofResult = BetterHintsBrowserProof["initial"]

const expectExactOpeningHints = (result: BetterHintsProofResult): void => {
  expect(result.player).toHaveLength(3)
  expect(result.opponent).toHaveLength(3)
  expect(new Set(result.player.map((hint) => hint.from)).size).toBe(3)
  expect(new Set(result.opponent.map((hint) => hint.from)).size).toBe(3)
  expect(result.player.every((hint) => hint.color === "white")).toBe(true)
  expect(result.opponent.every((hint) => hint.color === "black")).toBe(true)
  expect(
    [...result.player, ...result.opponent].every((hint) =>
      UCI_MOVE.test(hint.uci),
    ),
  ).toBe(true)
}

test("derives exact and checked-position hints with real Stockfish", async ({
  context,
  page,
}, testInfo) => {
  const requestedUrls: string[] = []
  const failedRequests: string[] = []
  const browserErrors: string[] = []
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
    worker.on("close", () => {
      closedWorkerCount += 1
    })
  })

  await page.goto("/")
  const proof = await page.evaluate<BetterHintsBrowserProof>(() =>
    window.mapachessStockfishBrowserHarness.runBetterHintsProof(),
  )

  expect(proof.identity.name).toBe("Stockfish 18 Lite WASM")
  expect(proof.finalState).toBe("closed")
  expect(proof.initial.requestId).toBe("browser-proof/initial")
  expectExactOpeningHints(proof.initial)

  expect(proof.checked.requestId).toBe("browser-proof/checked")
  expect(proof.checked.positionFen).toBe(proof.checkedPositionFen)
  expect(proof.checked.player.map((hint) => hint.from)).toEqual(["e1"])
  expect(proof.checked.opponent.map((hint) => hint.from).sort()).toEqual([
    "e2",
    "e8",
  ])
  expect(proof.checked.opponent.every((hint) => hint.to !== "e1")).toBe(true)

  testInfo.annotations.push({
    type: "better-hints-timings-milliseconds",
    description: JSON.stringify(proof.timingsMilliseconds),
  })
  for (const duration of Object.values(proof.timingsMilliseconds)) {
    expect(Number.isFinite(duration)).toBe(true)
    expect(duration).toBeGreaterThanOrEqual(0)
  }

  await expect.poll(() => closedWorkerCount).toBe(1)
  expect(page.workers()).toHaveLength(0)
  expect(failedRequests).toEqual([])
  expect(browserErrors).toEqual([])

  const localOrigin = new URL(page.url()).origin
  const externalRequests = requestedUrls.filter((url) => {
    const parsedUrl = new URL(url)
    return (
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") &&
      parsedUrl.origin !== localOrigin
    )
  })
  expect(externalRequests).toEqual([])
})
