import { expect, test } from "@playwright/test"
import savedProfile from "./savedProfile.js"

test("retries a denied storage accessor without replacing saved player data", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).check()
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  const before = await savedProfile(page)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const database = indexedDB
    let denied = true
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get: () => {
        if (denied) throw new DOMException("Storage denied", "SecurityError")
        return database
      },
    })
    window.addEventListener(
      "restore-storage-access",
      () => {
        denied = false
      },
      { once: true },
    )
  })
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Local saves are unavailable." }),
  ).toBeVisible()
  await page.evaluate(() =>
    window.dispatchEvent(new Event("restore-storage-access")),
  )
  await page.getByRole("button", { name: "Try Again", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Share profile card", exact: true }),
  ).toBeVisible()
  expect(await savedProfile(page)).toEqual(before)
  expect(errors).toEqual([])
})

test("recovers the match view without discarding its owned game", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.getByRole("radio", { name: "No Auto Hints", exact: true }).check()
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Standard Chess Challenge", exact: true })
    .click()
  await page.getByRole("radio", { name: "White", exact: true }).check()
  await page.getByRole("button", { name: "Start match", exact: true }).click()
  const piece = page.getByRole("gridcell", { name: /^e2,/ })
  await expect(piece).toHaveAttribute("aria-disabled", "false", {
    timeout: 30000,
  })
  const before = (await savedProfile(page)).activeMatch
  await page.evaluate(() => {
    const setAttribute = Element.prototype.setAttribute
    Element.prototype.setAttribute = function (name, value) {
      if (name === "aria-label" && value.startsWith("e2,"))
        throw new Error("Injected board display failure")
      setAttribute.call(this, name, value)
    }
    window.addEventListener(
      "restore-board-display",
      () => {
        Element.prototype.setAttribute = setAttribute
      },
      { once: true },
    )
  })
  await piece.click()
  await expect(
    page.getByRole("heading", { name: "This screen could not be displayed." }),
  ).toBeVisible()
  const download = page.waitForEvent("download")
  await page
    .getByRole("button", { name: "Export player data", exact: true })
    .click()
  expect((await download).suggestedFilename()).toBe(
    "mapachess-player-data.json",
  )
  await page.evaluate(() =>
    window.dispatchEvent(new Event("restore-board-display")),
  )
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(piece).toHaveAttribute("aria-disabled", "false")
  const after = (await savedProfile(page)).activeMatch
  expect(after?.matchId).toBe(before?.matchId)
  expect(after?.currentFen).toBe(before?.currentFen)
  expect(after?.cursor).toBe(before?.cursor)
  await piece.click()
  await page.getByRole("gridcell", { name: /^e4,/ }).click()
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
      timeout: 30000,
    })
    .toBe(2)
})

test("keeps a prepared card after download and share errors", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    })
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: () => {
        throw new Error("Share unavailable")
      },
    })
  })
  await page.goto("/")
  await page
    .getByRole("button", { name: "Share profile card", exact: true })
    .click()
  await page.getByRole("button", { name: "PNG · Still", exact: true }).click()
  const save = page.getByRole("button", { name: "Save PNG", exact: true })
  await expect(save).toBeEnabled()
  const before = await savedProfile(page)
  await page.getByRole("button", { name: "Share PNG", exact: true }).click()
  await expect(
    page.getByText(
      "Sharing did not complete. You can retry or save the file.",
      { exact: true },
    ),
  ).toBeVisible()
  await expect(save).toBeEnabled()
  await page.evaluate(() => {
    const click = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      HTMLAnchorElement.prototype.click = click
      throw new Error("Download unavailable")
    }
  })
  await save.click()
  await expect(
    page.getByText(
      "The download could not start. Your card is still ready; try saving again.",
      { exact: true },
    ),
  ).toBeVisible()
  const download = page.waitForEvent("download")
  await save.click()
  expect((await download).suggestedFilename()).toBe("Mapachess-profile.png")
  await page.evaluate(() =>
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => {
        throw new Error("Capability unavailable")
      },
    }),
  )
  await page
    .getByRole("checkbox", { name: "Animal companion", exact: true })
    .uncheck()
  await expect(save).toBeEnabled()
  await expect(
    page.getByRole("button", { name: "Share PNG", exact: true }),
  ).toBeDisabled()
  expect(await savedProfile(page)).toEqual(before)
  expect(errors).toEqual([])
})

test("recovers an unreadable GIF worker message through Retry GIF", async ({
  page,
}) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  await expect(
    page.getByRole("button", { name: "Share profile card", exact: true }),
  ).toBeVisible()
  const before = await savedProfile(page)
  await page.evaluate(() => {
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (message, options) {
      if (
        typeof message === "object" &&
        message !== null &&
        "frames" in message
      ) {
        Worker.prototype.postMessage = post
        this.dispatchEvent(new MessageEvent("messageerror"))
      } else post.call(this, message, options ?? [])
    }
  })
  await page
    .getByRole("button", { name: "Share profile card", exact: true })
    .click()
  const retry = page.getByRole("button", { name: "Retry GIF", exact: true })
  await expect(retry).toBeVisible()
  await retry.click()
  await expect(
    page.getByRole("button", { name: "Save GIF", exact: true }),
  ).toBeEnabled({ timeout: 60000 })
  await expect(retry).toBeHidden()
  expect(await savedProfile(page)).toEqual(before)
  expect(errors).toEqual([])
})

test("isolates an editor view failure while retaining the unsaved appearance", async ({
  page,
}) => {
  await page.goto("/")
  await page
    .getByRole("button", { name: "Customize profile card", exact: true })
    .click()
  const before = await savedProfile(page)
  await page.getByRole("button", { name: "Face", exact: true }).click()
  await page.evaluate(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function () {
      throw new Error("Injected canvas initialization failure")
    }
    window.addEventListener(
      "restore-canvas-context",
      () => {
        HTMLCanvasElement.prototype.getContext = getContext
      },
      { once: true },
    )
  })
  await page.getByRole("button", { name: "Face 5", exact: true }).click()
  await expect(
    page.getByRole("heading", {
      name: "Customization could not be displayed.",
    }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Back", exact: true }),
  ).toBeVisible()
  expect(await savedProfile(page)).toEqual(before)
  await page.evaluate(() =>
    window.dispatchEvent(new Event("restore-canvas-context")),
  )
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await page.getByRole("button", { name: "Face", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Face 5", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByText("Unsaved appearance", { exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click()
  await expect(
    page.getByText("Saved appearance", { exact: true }),
  ).toBeVisible()
  expect((await savedProfile(page)).appearance.face).toBe(5)
})

for (const engine of ["opponent", "evaluation", "better-hints"] as const) {
  test(`restarts a failed ${engine} Worker without replacing the match`, async ({
    page,
  }) => {
    test.setTimeout(90000)
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.addInitScript((failedEngine) => {
      let failed = false
      const randomValues = crypto.getRandomValues.bind(crypto)
      crypto.getRandomValues = (array) => {
        if (array instanceof Uint32Array && array.length === 4) {
          array.set([1, 2, 3, 4])
          return array
        }
        return randomValues(array)
      }
      const NativeWorker = Worker
      window.Worker = class extends NativeWorker {
        readonly engineName: string
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options)
          this.engineName = options?.name ?? ""
        }
        override postMessage(
          message: unknown,
          options?: Transferable[] | StructuredSerializeOptions,
        ): void {
          if (
            !failed &&
            this.engineName === `mapachess-stockfish-18-${failedEngine}` &&
            typeof message === "string" &&
            message.startsWith("go nodes ")
          ) {
            failed = true
            this.dispatchEvent(
              new ErrorEvent("error", {
                message: "Injected engine failure",
                cancelable: true,
              }),
            )
            return
          }
          if (Array.isArray(options)) super.postMessage(message, options)
          else super.postMessage(message, options)
        }
      }
    }, engine)
    await page.goto("/")
    await page.getByRole("button", { name: "Settings", exact: true }).click()
    await page
      .getByRole("radio", { name: "No Auto Hints", exact: true })
      .check()
    await page
      .getByRole("button", { name: "Close Settings", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Standard Chess Challenge", exact: true })
      .click()
    await page.getByRole("button", { name: /Change difficulty/ }).click()
    await page
      .getByRole("radio", { name: "2300 Elo", exact: true })
      .press("Space")
    await page.getByRole("button", { name: "Done", exact: true }).click()
    await page.getByRole("radio", { name: "White", exact: true }).check()
    await page.getByRole("button", { name: "Start match", exact: true }).click()
    await expect(page.getByRole("grid", { name: /Chessboard/ })).toBeVisible({
      timeout: 30000,
    })
    const initial = (await savedProfile(page)).activeMatch
    if (initial === null) throw new Error("Expected a started match")
    let expectedCursor = 0
    if (engine === "opponent") {
      await page.getByRole("gridcell", { name: /^e2,/ }).click()
      await page.getByRole("gridcell", { name: /^e4,/ }).click()
      expectedCursor = 2
    } else if (engine === "better-hints") {
      await page
        .getByRole("button", { name: "Show Piece Hints", exact: true })
        .click()
    }
    const retry = page.getByRole("button", {
      name:
        engine === "opponent"
          ? "Retry Chicken Stockfish turn"
          : engine === "evaluation"
            ? "Retry Evaluation"
            : "Retry Piece Hints",
      exact: true,
    })
    await expect(retry).toBeVisible()
    await retry.click()
    await expect(retry).toBeHidden()
    if (engine === "opponent") {
      await expect
        .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
          timeout: 30000,
        })
        .toBe(expectedCursor)
    } else if (engine === "evaluation") {
      await expect(
        page.getByRole("meter", { name: "Stockfish evaluation", exact: true }),
      ).not.toHaveAttribute("aria-valuetext", /unavailable|waiting/)
    } else {
      await expect(
        page.getByRole("button", { name: "Show Move Hints", exact: true }),
      ).toBeEnabled({ timeout: 30000 })
    }
    const recovered = (await savedProfile(page)).activeMatch
    expect(recovered?.matchId).toBe(initial.matchId)
    expect(recovered?.cursor).toBe(expectedCursor)
    if (engine !== "opponent")
      expect(recovered?.currentFen).toBe(initial.currentFen)
    await expect(page.getByRole("grid", { name: /Chessboard/ })).toBeVisible()
    expect(errors).toEqual([])
  })
}
