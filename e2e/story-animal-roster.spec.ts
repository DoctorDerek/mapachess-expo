import { expect } from "@playwright/test"
import { listLegalMatchMoves } from "../packages/match/src/matchMove.js"
import { reconstructMatchPosition } from "../packages/match/src/matchPosition.js"
import { STOCKFISH_OPPONENTS } from "../packages/match/src/stockfishOpponent.js"
import createInitialMapachessPlayerData from "../packages/profile/src/playerData.js"
import { test } from "./fixtures.js"
import importPlayerData from "./importPlayerData.js"
import savedProfile from "./savedProfile.js"

for (const variant of ["standard", "chess960"] as const) {
  for (const [id, name, target] of [
    ["squirrel-stockfish", "Squirrel", 500],
    ["tiger-stockfish", "Tiger", 1450],
  ] as const) {
    test(`plays and resumes ${name} at ${target} in ${variant} Story`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(
        variant === "standard"
          ? { width: 390, height: 844 }
          : { width: 1280, height: 800 },
      )
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.goto("/")
      const initial = createInitialMapachessPlayerData()
      const index = STOCKFISH_OPPONENTS.findIndex(
        (opponent) => opponent.id === id,
      )
      await importPlayerData(page, {
        ...initial,
        settings: { ...initial.settings, autoHintMode: "no-auto-hints" },
        storyProgress: {
          ...initial.storyProgress,
          [variant]: STOCKFISH_OPPONENTS.slice(0, index).map(
            ({ id: opponentId }) => ({ opponentId, highestMedal: "bronze" }),
          ),
        },
      })
      await page
        .getByRole("button", {
          name:
            variant === "standard"
              ? "Standard Chess Challenge"
              : "Chess960 Challenge",
          exact: true,
        })
        .click()
      await page
        .getByRole("button", { name: "Change animal", exact: true })
        .click()
      const challenge = page.getByRole("dialog")
      await expect(challenge.getByRole("listitem")).toHaveCount(25)
      const locked = challenge
        .getByRole("listitem")
        .filter({ hasText: new RegExp(name + " · Locked") })
      await expect(locked).toBeVisible()
      await expect(locked.getByRole("radio")).toHaveCount(0)
      const silhouette = locked.locator('span[style*="background-image"]')
      await expect(silhouette).toHaveCSS("filter", "brightness(0)")
      await expect(silhouette).toHaveCSS(
        "background-image",
        new RegExp("/battle/" + name.toLowerCase() + "/"),
      )
      await locked.click()
      await expect(
        challenge.getByRole("radio", {
          name: "Chicken Stockfish",
          exact: true,
        }),
      ).toBeChecked()
      await challenge
        .getByRole("button", { name: "Cancel", exact: true })
        .click()
      await page.goto("/")
      await page
        .getByRole("button", {
          name:
            variant === "standard" ? "Standard Chess Story" : "Chess960 Story",
          exact: true,
        })
        .click()
      await page
        .getByRole("button", { name: "Change Story opponent", exact: true })
        .click()
      const picker = page.getByRole("dialog")
      const selected = picker.getByRole("radio", {
        name: new RegExp(name + " Stockfish"),
      })
      await expect(selected).toBeChecked()
      await expect(
        picker.locator(`span[style*="/battle/${name.toLowerCase()}/"]`).first(),
      ).toBeVisible()
      await picker.getByRole("button", { name: "Done", exact: true }).click()
      await page
        .getByRole("button", { name: "Start match", exact: true })
        .click()
      const board = page.getByRole("grid", { name: /Chessboard/ })
      await expect(board).toBeVisible({ timeout: 30000 })
      const started = (await savedProfile(page)).activeMatch
      expect(started).toMatchObject({
        opponentId: id,
        opponentTargetElo: target,
        ratedOpponentElo: target,
        mode: "story",
        startingPosition: { variant },
      })
      await expect
        .poll(async () => (await savedProfile(page)).activeMatch?.cursor)
        .toBe(started?.playerColor === "white" ? 0 : 1)
      const before = (await savedProfile(page)).activeMatch!
      const position = reconstructMatchPosition(
        before.startingPosition,
        before.currentFen,
      )
      if (!position.ok) throw new Error("Expected playable Story position")
      const legal = listLegalMatchMoves(position.position)
      const preferred = before.playerColor === "white" ? "e2e4" : "e7e5"
      const move =
        legal.find((candidate) => candidate.uci === preferred) ??
        legal.find(
          (candidate) =>
            candidate.kind === "normal" && candidate.promotion === null,
        )
      if (!move) throw new Error("Expected legal opening move")
      await board
        .getByRole("gridcell", { name: new RegExp("^" + move.from + ",") })
        .click()
      await board
        .getByRole("gridcell", { name: new RegExp("^" + move.to + ",") })
        .click()
      await expect
        .poll(async () => (await savedProfile(page)).activeMatch?.cursor, {
          timeout: 20000,
        })
        .toBe(before.cursor + 2)
      const played = (await savedProfile(page)).activeMatch!
      await page.screenshot({
        path: testInfo.outputPath(name.toLowerCase() + "-game.png"),
      })
      await page.reload()
      await expect(board).toBeVisible({ timeout: 30000 })
      expect((await savedProfile(page)).activeMatch).toMatchObject({
        matchId: played.matchId,
        currentFen: played.currentFen,
        opponentPolicyFingerprint: played.opponentPolicyFingerprint,
        opponentTargetElo: target,
        ratedOpponentElo: target,
      })
    })
  }
}
