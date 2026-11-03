import { expect } from "@playwright/test"
import { firstArrivalTest as test } from "./fixtures.js"

test("keeps the chess engine off a fresh customization-only journey", async ({
  page,
  context,
}) => {
  const engine: string[] = []
  context.on("request", (request) => {
    if (request.url().includes("/stockfish-runtime/"))
      engine.push(request.url())
  })
  await page.goto("/")
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await page
    .getByRole("button", { name: "Customize profile card", exact: true })
    .click()
  await expect(
    page.getByRole("region", { name: "Customize profile card", exact: true }),
  ).toBeVisible()
  if (
    process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT_VERCEL_TRUSTED_OIDC === "true"
  ) {
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    const cacheKeys = await page.evaluate(async () =>
      (
        await Promise.all(
          (await caches.keys()).map(async (name) =>
            (await (await caches.open(name)).keys()).map((r) => r.url),
          ),
        )
      ).flat(),
    )
    expect(
      cacheKeys.filter((url) => url.includes("/stockfish-runtime/")),
    ).toEqual([])
  }
  expect(engine).toEqual([])
  await page.close()
})
