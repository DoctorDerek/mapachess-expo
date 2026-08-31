import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Locator, type Page } from "@playwright/test"

type DeterministicBrowserCryptography = Readonly<{
  digestDelayMilliseconds: number
  matchWords: readonly [number, number, number, number]
  positionSeed: string
}>

const WHITE_MATCH_WORDS = [1, 2, 3, 4] as const
const BLACK_MATCH_WORDS = [1, 0x0200_0000, 3, 4] as const
const RANDOM_POSITION_SEED = "00000001000000020000000300000004"
const STOCKFISH_POSITION_SEED = "00000001000000050000000300000004"
const OWNED_WORKER_COUNT = 2

const installDeterministicCryptography = async (
  page: Page,
  input: DeterministicBrowserCryptography,
): Promise<void> => {
  await page.addInitScript((configuration) => {
    const originalGetRandomValues = globalThis.crypto.getRandomValues.bind(
      globalThis.crypto,
    )
    const originalDigest = globalThis.crypto.subtle.digest.bind(
      globalThis.crypto.subtle,
    )

    Object.defineProperty(globalThis.crypto, "getRandomValues", {
      configurable: true,
      value: <Value extends ArrayBufferView | null>(array: Value): Value => {
        if (array instanceof Uint32Array && array.length === 4) {
          array.set(configuration.matchWords)
          return array
        }
        return originalGetRandomValues(array)
      },
    })
    Object.defineProperty(globalThis.crypto.subtle, "digest", {
      configurable: true,
      value: async (
        algorithm: AlgorithmIdentifier,
        data: BufferSource,
      ): Promise<ArrayBuffer> => {
        const dataBytes = ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : new Uint8Array(data)
        const canonicalInput = new TextDecoder().decode(dataBytes)
        if (
          !canonicalInput.includes("mapachess-web-sha256-position-state/v1")
        ) {
          return originalDigest(algorithm, data)
        }

        if (configuration.digestDelayMilliseconds > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, configuration.digestDelayMilliseconds),
          )
        }

        const digest = new ArrayBuffer(32)
        const digestBytes = new Uint8Array(digest)
        for (
          let index = 0;
          index < configuration.positionSeed.length;
          index += 2
        ) {
          digestBytes[index / 2] = Number.parseInt(
            configuration.positionSeed.slice(index, index + 2),
            16,
          )
        }
        return digest
      },
    })
  }, input)
}

const beginBrowserDiagnostics = (page: Page) => {
  const browserErrors: string[] = []
  const failedRequests: string[] = []
  const requestedUrls: string[] = []
  const workerUrls: string[] = []
  let closedWorkerCount = 0

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  page.on("pageerror", (error) => browserErrors.push(error.message))
  page.on("request", (request) => requestedUrls.push(request.url()))
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.url()}: ${request.failure()?.errorText ?? "unknown"}`,
    )
  })
  page.on("worker", (worker) => {
    workerUrls.push(worker.url())
    worker.on("close", () => {
      closedWorkerCount += 1
    })
  })

  return {
    assertClean: async (): Promise<void> => {
      await page.goto("/")
      await expect.poll(() => closedWorkerCount).toBe(OWNED_WORKER_COUNT)
      expect(page.workers()).toHaveLength(0)
      expect(workerUrls).toHaveLength(OWNED_WORKER_COUNT)
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
    },
  }
}

const expectNoHighImpactAccessibilityViolations = async (
  page: Page,
): Promise<void> => {
  const results = await new AxeBuilder({ page }).analyze()
  const highImpactViolations = results.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  )
  expect(highImpactViolations).toEqual([])
}

const openFirstChickenMatch = async (page: Page): Promise<void> => {
  await page.goto("/playtest")
  await page.getByRole("button", { name: "Keep Auto-Hints On" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Chicken Stockfish" }),
  ).toBeVisible()
}

const readHintSourceKeys = async (locator: Locator): Promise<string[]> =>
  locator.evaluateAll((elements) =>
    elements
      .map((element) =>
        [
          element.getAttribute("data-hint-owner"),
          element.getAttribute("data-source-x"),
          element.getAttribute("data-source-y"),
        ].join(":"),
      )
      .sort(),
  )

const expectExactAutomaticBetterHints = async (page: Page): Promise<void> => {
  await expect(
    page.getByRole("button", { name: "Show Move Hints" }),
  ).toBeVisible()

  const sourceHints = page.locator('[data-hint-kind="source"]')
  const moveHints = page.locator('[data-hint-kind="move"]')
  await expect(sourceHints).toHaveCount(6)
  await expect(moveHints).toHaveCount(0)
  await expect(
    page.locator(
      '[data-hint-kind="source"][data-hint-owner="player"][data-hint-shape="circle"]',
    ),
  ).toHaveCount(3)
  await expect(
    page.locator(
      '[data-hint-kind="source"][data-hint-owner="opponent"][data-hint-shape="warning-triangle"]',
    ),
  ).toHaveCount(3)
  await expect(page.getByText(/^Piece Hints shown\./)).toHaveCount(1)
  const pieceSourceKeys = await readHintSourceKeys(sourceHints)
  expect(new Set(pieceSourceKeys).size).toBe(6)

  await expect(
    page.getByRole("button", { name: "Move Hints Shown" }),
  ).toBeDisabled()
  await expect(sourceHints).toHaveCount(6)
  await expect(moveHints).toHaveCount(6)
  await expect(
    page.locator(
      '[data-hint-kind="move"][data-hint-owner="player"][data-hint-shape="target-cross"]',
    ),
  ).toHaveCount(3)
  await expect(
    page.locator(
      '[data-hint-kind="move"][data-hint-owner="opponent"][data-hint-shape="x"]',
    ),
  ).toHaveCount(3)
  await expect(page.getByText(/^Move Hints shown\./)).toHaveCount(1)
  expect(await readHintSourceKeys(moveHints)).toEqual(pieceSourceKeys)
  await expectNoHighImpactAccessibilityViolations(page)
}

test("plays White through automatic hints, cancellation, and redo", async ({
  page,
}) => {
  await installDeterministicCryptography(page, {
    digestDelayMilliseconds: 750,
    matchWords: WHITE_MATCH_WORDS,
    positionSeed: STOCKFISH_POSITION_SEED,
  })
  const diagnostics = beginBrowserDiagnostics(page)

  await openFirstChickenMatch(page)
  await expectExactAutomaticBetterHints(page)
  await expect(page.getByText("White", { exact: true })).toBeVisible()
  await expect(page.getByText("Your move.", { exact: true })).toBeVisible()

  await page.getByRole("gridcell", { name: /e2, White pawn/ }).click()
  await page.getByRole("gridcell", { name: /e4, empty/ }).click()
  await expect(page.locator('[data-hint-kind="source"]')).toHaveCount(0)
  await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(0)
  await expect(
    page.getByText(/Chicken Stockfish is choosing a move/),
  ).toBeVisible()

  await page.getByRole("button", { name: "Undo" }).click()
  await expect(page.getByText("Your move.", { exact: true })).toBeVisible()
  await expect(page.getByText("No moves yet.", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Redo" }).click()
  await expect(page.getByText("2 plies", { exact: true })).toBeVisible()
  await expect(page.getByText("Your move.", { exact: true })).toBeVisible()
  await expectExactAutomaticBetterHints(page)

  await diagnostics.assertClean()
})

test("plays Black through automatic hints and a complete Chicken turn", async ({
  page,
}) => {
  await installDeterministicCryptography(page, {
    digestDelayMilliseconds: 0,
    matchWords: BLACK_MATCH_WORDS,
    positionSeed: RANDOM_POSITION_SEED,
  })
  const diagnostics = beginBrowserDiagnostics(page)

  await openFirstChickenMatch(page)
  await expect(page.getByText("Black", { exact: true })).toBeVisible()
  await expect(page.getByText("1 ply", { exact: true })).toBeVisible()
  await expect(page.getByText("Your move.", { exact: true })).toBeVisible()
  await expectExactAutomaticBetterHints(page)

  await page.getByRole("gridcell", { name: /e7, Black pawn/ }).click()
  await page.getByRole("gridcell", { name: /e5, empty/ }).click()
  await expect(page.getByText("3 plies", { exact: true })).toBeVisible()
  await expect(page.getByText("Your move.", { exact: true })).toBeVisible()
  await expectExactAutomaticBetterHints(page)

  await diagnostics.assertClean()
})
