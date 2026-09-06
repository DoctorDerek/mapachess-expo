import { describe, expect, it } from "vitest"
import {
  DURABLE_MATCH_RECORD_VERSION,
  type DurableMatchRecord,
} from "@mapachess/match/durable-match-record"
import { parseMatchMoveId } from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  currentMatchPosition,
} from "@mapachess/match/match-timeline"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import createInitialMapachessPlayerData from "@mapachess/profile/player-data"
import { decodeMapachessPlayerData } from "@mapachess/profile/player-data-codec"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import {
  chickenMatchId,
  selectStoryPlayerColor,
  STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
} from "./chickenOpponent"
import {
  buildFreshStandardChickenMatch,
  default as resumeStandardChickenMatch,
  type FreshStandardChickenMatchInput,
} from "./standardChickenDurableMatch"

const matchSeed = parseDeterministicRandomSeed(
  "00000001000000020000000300000004",
  "durable match test seed",
)

const runtime = Object.freeze({
  matchId: chickenMatchId(matchSeed),
  matchSeed,
  opponentId: "chicken-stockfish",
  opponentPolicyFingerprint: STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
  playerColor: selectStoryPlayerColor(matchSeed),
}) satisfies FreshStandardChickenMatchInput["runtime"]

const requireMoveId = (uci: string) => {
  const result = parseMatchMoveId(uci)
  if (!result.ok) throw new Error(`Invalid test move ID ${uci}`)
  return result.moveId
}

describe("Standard Chicken durable match mapping", () => {
  it("builds the exact cursor-zero record for a fresh runtime", () => {
    const record = buildFreshStandardChickenMatch({
      autoHintMode: "no-auto-hints",
      playerEloAtStart: 100,
      runtime,
    })

    expect(record).toMatchObject({
      autoHintMode: "no-auto-hints",
      cursor: 0,
      matchId: runtime.matchId,
      matchSeed,
      mode: "story",
      moveHintsUsed: false,
      moveIds: [],
      opponentId: "chicken-stockfish",
      opponentPolicyFingerprint: STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
      pieceHintsUsed: false,
      playerColor: runtime.playerColor,
      playerEloAtStart: 100,
      recordVersion: DURABLE_MATCH_RECORD_VERSION,
      startingPosition: { chess960PositionId: null, variant: "standard" },
      timeControl: { type: "untimed" },
    })
    expect(record.currentFen).toBe(
      createInitialMatchPosition(record.startingPosition).fen,
    )
  })

  it("reconstructs the full branch while retaining the saved cursor", () => {
    const fresh = buildFreshStandardChickenMatch({
      autoHintMode: "auto-move-hints",
      playerEloAtStart: 100,
      runtime,
    })
    const initialTimeline = createMatchTimeline(
      createInitialMatchPosition(fresh.startingPosition),
    )
    const e4Move = requireMoveId("e2e4")
    const e5Move = requireMoveId("e7e5")
    const e4 = applyMatchTimelineMove(initialTimeline, e4Move)
    if (!e4.ok) throw new Error("Test e2e4 must be legal")
    const e5 = applyMatchTimelineMove(e4.timeline, e5Move)
    if (!e5.ok) throw new Error("Test e7e5 must be legal")
    const saved: DurableMatchRecord = Object.freeze({
      ...fresh,
      currentFen: fresh.currentFen,
      cursor: 0,
      moveIds: Object.freeze([e4Move, e5Move]),
      pieceHintsUsed: true,
    })

    const resumed = resumeStandardChickenMatch(saved)
    expect(resumed.matchSeed).toBe(matchSeed)
    expect(resumed.timeline.cursor).toBe(0)
    expect(resumed.timeline.transitions).toHaveLength(2)
    expect(currentMatchPosition(resumed.timeline).fen).toBe(fresh.currentFen)
  })

  it("rejects a saved match from another Chicken policy", () => {
    const fresh = buildFreshStandardChickenMatch({
      autoHintMode: "auto-move-hints",
      playerEloAtStart: 100,
      runtime,
    })

    expect(() =>
      resumeStandardChickenMatch({
        ...fresh,
        opponentPolicyFingerprint: `${STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT}/changed`,
      }),
    ).toThrow("Saved Chicken policy does not match")
  })

  it("round-trips the implemented identity but rejects catalog-only opponents", () => {
    const record = buildFreshStandardChickenMatch({
      autoHintMode: "auto-move-hints",
      playerEloAtStart: 100,
      runtime,
    })
    const playerData = {
      ...createInitialMapachessPlayerData(),
      activeMatch: record,
    }
    const importedData: unknown = JSON.parse(JSON.stringify(playerData))
    const decoded = decodeMapachessPlayerData(importedData)
    expect(decoded).toMatchObject({ data: playerData, ok: true })
    if (!decoded.ok || decoded.data.activeMatch === null) {
      throw new Error("The implemented Chicken match must round-trip.")
    }
    expect(resumeStandardChickenMatch(decoded.data.activeMatch)).toEqual(
      resumeStandardChickenMatch(record),
    )
    expect(
      decodeMapachessPlayerData({
        ...playerData,
        activeMatch: {
          ...record,
          opponentId: stockfishOpponent("bunny-stockfish").id,
        },
      }),
    ).toEqual({
      issue: { path: "$.activeMatch.opponentId", type: "PROFILE.DATA_INVALID" },
      ok: false,
    })
  })
})
