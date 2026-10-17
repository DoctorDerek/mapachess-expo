import { expect, type Page } from "@playwright/test"
import { listLegalMatchMoves } from "../packages/match/src/matchMove.js"
import { reconstructMatchPosition } from "../packages/match/src/matchPosition.js"
import { activate, injectControllerInput, press } from "./controllerInput.js"
import { firstArrivalTest as test } from "./fixtures.js"
import importPlayerData from "./importPlayerData.js"
import savedProfile from "./savedProfile.js"

async function startTimedMatch(
  page: Page,
  spanish = false,
  benchmarkDifficulty = false,
): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  if (spanish)
    await page
      .getByRole("combobox", { name: "Language" })
      .selectOption("es-419")
  await page
    .getByRole("button", { name: spanish ? "Comenzar" : "Start", exact: true })
    .click()
  await page
    .getByRole("button", {
      name: spanish ? "Configuración" : "Settings",
      exact: true,
    })
    .click()
  await page
    .getByRole("radio", {
      name: spanish ? "Pistas de movimientos automáticas" : "Auto Move Hints",
      exact: true,
    })
    .check()
  await page
    .getByRole("button", {
      name: spanish ? "Cerrar configuración" : "Close Settings",
      exact: true,
    })
    .click()
  await page
    .getByRole("button", {
      name: spanish ? "Desafío de ajedrez 960" : "Standard Chess Challenge",
      exact: true,
    })
    .click()
  await page
    .getByRole("radio", { name: spanish ? "Blancas" : "White", exact: true })
    .check()
  if (spanish)
    await page
      .getByRole("spinbutton", { name: "Número de posición (0–959)" })
      .fill("42")
  if (benchmarkDifficulty) {
    await page
      .getByRole("button", {
        name: spanish ? "Cambiar dificultad" : "Change difficulty",
        exact: true,
      })
      .click()
    const difficulty = page.getByRole("radio", {
      name: "2300 Elo",
      exact: true,
    })
    await difficulty.focus()
    await difficulty.press("Space")
    await expect(difficulty).toBeChecked()
    await page
      .getByRole("button", { name: spanish ? "Listo" : "Done", exact: true })
      .click()
  }
  await page
    .getByRole("button", {
      name: spanish ? "Cambiar control de tiempo" : "Change time control",
      exact: true,
    })
    .click()
  await page.screenshot({
    path: test.info().outputPath("time-control-picker.png"),
  })
  await page
    .getByRole("radio", {
      name: spanish ? "Relámpago · 3+2" : "Bullet · 1+0",
      exact: true,
    })
    .check()
  await page
    .getByRole("button", { name: spanish ? "Listo" : "Done", exact: true })
    .click()
  await page
    .getByRole("button", {
      name: spanish ? "Iniciar partida" : "Start match",
      exact: true,
    })
    .click()
  await expect(page.getByRole("gridcell", { name: /^e2,/ })).toHaveAttribute(
    "aria-disabled",
    "false",
    { timeout: 30000 },
  )
}

for (const spanish of [false, true]) {
  test(`bounded real-worker latency at 2300 Elo with Auto Move Hints (${spanish ? "Chess960" : "Standard Chess"})`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000)
    await startTimedMatch(page, spanish, true)
    expect((await savedProfile(page)).activeMatch?.opponentTargetElo).toBe(2300)
    const samples: {
      cursor: number
      opponentMs: number
      hintWaitMs: number
      waitedForHints: boolean
    }[] = []
    for (const preferred of ["e2e4", "g1f3", "f1c4", "d2d3", "b1c3", "c1e3"]) {
      const hintStart = performance.now()
      const waitedForHints = samples.length % 2 === 0
      if (waitedForHints)
        await expect(
          page.getByRole("button", {
            name: spanish
              ? "Pistas de movimientos visibles"
              : "Move Hints Shown",
            exact: true,
          }),
        ).toBeVisible({ timeout: 30000 })
      const hintWaitMs = performance.now() - hintStart
      const before = (await savedProfile(page)).activeMatch
      if (before?.clock === undefined) throw new Error("Expected timed game")
      const position = reconstructMatchPosition(
        before.startingPosition,
        before.currentFen,
      )
      if (!position.ok) throw new Error("Expected legal saved position")
      const legal = listLegalMatchMoves(position.position)
      const move =
        legal.find(({ uci }) => uci === preferred) ??
        legal.find(
          (candidate) =>
            candidate.kind === "normal" && candidate.promotion === null,
        )
      if (move === undefined)
        throw new Error("Expected playable test continuation")
      await expect(
        page.getByRole("gridcell", { name: new RegExp(`^${move.from},`) }),
      ).toHaveAttribute("aria-disabled", "false")
      await page
        .getByRole("gridcell", { name: new RegExp(`^${move.from},`) })
        .click()
      await page
        .getByRole("gridcell", { name: new RegExp(`^${move.to},`) })
        .click()
      await expect
        .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
          timeout: 30000,
        })
        .toBe(before.cursor + 2)
      const after = (await savedProfile(page)).activeMatch
      if (after?.clock === undefined || after.timeControl.type !== "fischer")
        throw new Error("Expected clock history")
      const clockBefore = after.clock.history[before.cursor + 1]!
      const clockAfter = after.clock.history[before.cursor + 2]!
      const opponentMs =
        clockBefore.black +
        after.timeControl.incrementSeconds * 1000 -
        clockAfter.black
      expect(opponentMs).toBeGreaterThanOrEqual(0)
      expect(opponentMs).toBeLessThan(10000)
      samples.push({
        cursor: after.cursor,
        opponentMs,
        hintWaitMs,
        waitedForHints,
      })
    }
    await testInfo.attach("bounded-worker-latency", {
      body: JSON.stringify(samples),
      contentType: "application/json",
    })
  })
}

test("controller selects Bullet and explicitly resumes paused clocks", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await injectControllerInput(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Mapachess", exact: true, level: 1 }),
  ).toBeFocused()
  await activate(
    page,
    page.getByRole("button", { name: "Standard Chess Challenge", exact: true }),
  )
  await activate(
    page,
    page.getByRole("button", { name: "Change time control", exact: true }),
  )
  const bullet = page.getByRole("radio", { name: "Bullet · 1+0", exact: true })
  await activate(page, bullet)
  await expect(bullet).toBeChecked()
  await activate(page, page.getByRole("button", { name: "Done", exact: true }))
  await activate(
    page,
    page.getByRole("button", { name: "Start match", exact: true }),
  )
  await expect(page.getByRole("timer")).toHaveCount(2)
  await press(page, 9)
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.clock?.paused)
    .toBe(true)
  await press(page, 1)
  const resume = page.getByRole("button", {
    name: "Resume clocks",
    exact: true,
  })
  await expect(resume).toBeVisible()
  await activate(page, resume)
  await expect(resume).toHaveCount(0)
  expect((await savedProfile(page)).activeMatch?.timeControl).toEqual({
    type: "fischer",
    baseSeconds: 60,
    incrementSeconds: 0,
  })
})

test("Bullet uses real Auto Move Hints and pauses on navigation without changing the Untimed rating", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await startTimedMatch(page)
  await expect(page.getByRole("timer")).toHaveCount(2)
  await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6, {
    timeout: 30000,
  })
  await page.screenshot({
    path: testInfo.outputPath("bullet-auto-hints.png"),
    fullPage: true,
  })
  await page.getByRole("gridcell", { name: /^e2,/ }).click()
  await page.getByRole("gridcell", { name: /^e4,/ }).click()
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
      timeout: 30000,
    })
    .toBe(2)
  const played = await savedProfile(page)
  expect(played.activeMatch?.clock?.history).toHaveLength(3)
  expect(played.activeMatch?.moveHintsUsed).toBe(true)
  expect(played.ratings.standard).toBe(100)
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Resume clocks", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Redo", exact: true }).click()
  await expect
    .poll(
      async () => (await savedProfile(page)).activeMatch?.clock?.remainingMs,
    )
    .toEqual(played.activeMatch?.clock?.history[2])
  await page.getByRole("button", { name: "Resume clocks", exact: true }).click()
  await page.getByLabel("Match menu", { exact: true }).click()
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.clock?.paused)
    .toBe(true)
  const paused = await savedProfile(page)
  await page.getByLabel("Match menu", { exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Resume clocks", exact: true }),
  ).toBeVisible()
  await page.goBack()
  await expect(
    page.getByRole("button", { name: "Start match", exact: true }),
  ).toBeVisible()
  await page.goForward()
  await expect(
    page.getByRole("button", { name: "Resume clocks", exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole("button", { name: "Resume clocks", exact: true }),
  ).toBeVisible({ timeout: 30000 })
  expect((await savedProfile(page)).activeMatch?.clock).toEqual(
    paused.activeMatch?.clock,
  )
  await page.getByRole("button", { name: "Resume clocks", exact: true }).click()
  await page.evaluate(() => window.dispatchEvent(new Event("blur")))
  await expect(
    page.getByRole("button", { name: "Resume clocks", exact: true }),
  ).toHaveCount(0)
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(
    page.getByRole("button", { name: "Resume clocks", exact: true }),
  ).toBeVisible()
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "visibilityState")
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(
    page.getByRole("button", { name: "Resume clocks", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Resume clocks", exact: true }).click()
  await page.goBack()
  await expect(
    page.getByRole("button", { name: "Resume match", exact: true }),
  ).toBeVisible()
  await page.goForward()
  await expect(
    page.getByRole("button", { name: "Resume clocks", exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("Mexican Spanish Blitz keeps its increment, contextual rating and clocks readable on narrow screens", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000)
  await startTimedMatch(page, true)
  await expect(page.locator('[data-hint-kind="move"]')).toHaveCount(6, {
    timeout: 30000,
  })
  await page.getByRole("gridcell", { name: /^e2,/ }).click()
  await page.getByRole("gridcell", { name: /^e4,/ }).click()
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
      timeout: 30000,
    })
    .toBe(2)
  const played = await savedProfile(page)
  expect(played.activeMatch?.timeControl).toEqual({
    type: "fischer",
    baseSeconds: 180,
    incrementSeconds: 2,
  })
  const clock = played.activeMatch?.clock
  expect(clock?.history).toHaveLength(3)
  expect(clock?.history[1]?.white).toBeLessThanOrEqual(182000)
  expect(clock?.history[1]?.white).toBeGreaterThan(150000)
  expect(clock?.history[2]?.black).toBeGreaterThan(180000)
  await page.getByLabel("Menú de partida", { exact: true }).click()
  await page.getByLabel("Menú de partida", { exact: true }).click()
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await expect(page.getByRole("timer")).toHaveCount(2)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    for (const timer of await page.getByRole("timer").all()) {
      await expect(timer).toBeVisible()
      expect(
        await timer.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true)
    }
    await page.screenshot({
      path: testInfo.outputPath(`spanish-blitz-${width}.png`),
      fullPage: true,
    })
  }
})

test("a no-move timeout survives import, retracts on Undo and reapplies only once on Redo", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000)
  await startTimedMatch(page)
  await page.getByLabel("Match menu", { exact: true }).click()
  await expect
    .poll(async () => (await savedProfile(page)).activeMatch?.clock?.paused)
    .toBe(true)
  const before = await savedProfile(page)
  if (before.activeMatch?.clock === undefined)
    throw new Error("Expected timed fixture")
  await importPlayerData(page, {
    ...before,
    activeMatch: {
      ...before.activeMatch,
      clock: {
        ...before.activeMatch.clock,
        remainingMs: { white: 1500, black: 60000 },
        paused: true,
      },
    },
  })
  await page.getByRole("button", { name: "Resume clocks", exact: true }).click()
  await expect(
    page.getByRole("dialog", {
      name: "Your time ran out — you lost.",
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 })
  const ended = await savedProfile(page)
  expect(ended.activeMatch?.cursor).toBe(0)
  expect(ended.activeMatch?.conclusion).toEqual({
    type: "timeout",
    winner: "black",
  })
  expect(ended.ratedMatchCounts["standard-bullet"]).toBe(1)
  expect(ended.ratedMatchCounts.standard).toBe(0)
  await page.screenshot({
    path: testInfo.outputPath("timeout-rewards.png"),
    fullPage: true,
  })
  await page.getByRole("button", { name: "Review board", exact: true }).click()
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Resume clocks", exact: true }),
  ).toBeVisible()
  const undone = await savedProfile(page)
  expect(undone.ratedMatchCounts["standard-bullet"]).toBe(0)
  expect(undone.activeMatch?.clock?.remainingMs.white).toBe(60000)
  await page.getByRole("button", { name: "Redo", exact: true }).click()
  await expect
    .poll(
      async () =>
        (await savedProfile(page)).ratedMatchCounts["standard-bullet"],
    )
    .toBe(1)
  expect((await savedProfile(page)).totalXp).toBe(ended.totalXp)
})
