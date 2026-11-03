import { once } from "node:events"
import { createServer } from "node:http"
import { expect, type APIRequestContext } from "@playwright/test"
import loadCatalog from "../packages/localization/src/catalog.js"
import { firstArrivalTest as test } from "./fixtures.js"
import savedProfile from "./savedProfile.js"
import startHintMatch from "./startHintMatch.js"

// A stopped origin exercises the real service worker, including in WebKit where
// driver-level offline emulation can reject navigation before the worker runs.
async function startOrigin(upstream: string, request: APIRequestContext) {
  const server = createServer(async (input, output) => {
    try {
      if (
        !input.url?.startsWith("/") ||
        input.url.startsWith("//") ||
        input.method !== "GET"
      ) {
        output.writeHead(405).end()
        return
      }
      const local = new URL(input.url, "http://127.0.0.1")
      const destination = new URL(upstream)
      destination.pathname = local.pathname
      destination.search = local.search
      const response = await request.get(destination.href, { maxRedirects: 0 })
      try {
        const headers = response.headers()
        output
          .writeHead(response.status(), {
            "Content-Type":
              headers["content-type"] ?? "application/octet-stream",
            "Cache-Control": headers["cache-control"] ?? "no-cache",
          })
          .end(await response.body())
      } finally {
        await response.dispose()
      }
    } catch {
      output.destroy()
    }
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (!address || typeof address === "string")
    throw Error("Expected a TCP test origin")
  return {
    url: "http://127.0.0.1:" + address.port,
    close: async () => {
      if (!server.listening) return
      const closed = once(server, "close")
      server.close()
      server.closeAllConnections()
      await closed
    },
  }
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
        .poll(() =>
          online.evaluate(async () => {
            const programs = await caches.open("mapachess-stockfish-program")
            return (await programs.keys()).length
          }),
        )
        .toBe(2)
      const reopened = await context.newPage()
      await online.close()
      await origin.close()
      await expect(fetch(origin.url)).rejects.toThrow()
      const board = reopened.getByRole("grid", { name: /Chessboard/ })
      if (existing) {
        await reopened.goto("/", { waitUntil: "domcontentloaded" })
        const resume = reopened.getByRole("button", {
          name: "Resume match Untimed",
          exact: true,
          disabled: false,
        })
        await expect(board.or(resume).first()).toBeVisible()
        if (await resume.isVisible()) await resume.click()
        await expect(board).toBeVisible()
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
        .poll(
          async () =>
            (await savedProfile(reopened)).activeMatch?.moveIds.length,
        )
        .toBeGreaterThan(0)
    } finally {
      await context.close()
      await origin.close()
    }
  })
}
