import { describe, expect, it } from "vitest"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
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
  chickenPolicyFingerprint,
  selectStoryPlayerColor,
  STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
} from "../chicken/chickenOpponent"
import {
  buildFreshWebMatch,
  default as resumeWebMatch,
  type FreshWebMatchInput,
} from "./webDurableMatch"

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
  startingPosition: { variant: "standard", chess960PositionId: null } as const,
}) satisfies FreshWebMatchInput["runtime"]

const requireMoveId = (uci: string) => {
  const result = parseMatchMoveId(uci)
  if (!result.ok) throw new Error(`Invalid test move ID ${uci}`)
  return result.moveId
}

describe("web Story durable match mapping", () => {
  it.each([0, 959])(
    "round-trips Chess960 layout %i, its seed, and undone history",
    (layout) => {
      const parsed = parseChess960PositionId(layout)
      if (!parsed.ok) throw new Error("Invalid test layout")
      const startingPosition = {
        variant: "chess960",
        chess960PositionId: parsed.positionId,
      } as const
      const fresh = buildFreshWebMatch({
        autoHintMode: "auto-piece-hints",
        playerEloAtStart: 725,
        runtime: {
          ...runtime,
          startingPosition,
          matchId: chickenMatchId(matchSeed, startingPosition),
          opponentPolicyFingerprint: chickenPolicyFingerprint("chess960"),
        },
      })
      const saved = {
        ...fresh,
        moveIds: [requireMoveId("e2e4"), requireMoveId("e7e5")],
        pieceHintsUsed: true,
      }
      const imported: unknown = JSON.parse(
        JSON.stringify({
          ...createInitialMapachessPlayerData(),
          activeMatch: saved,
        }),
      )
      const decoded = decodeMapachessPlayerData(imported)
      if (!decoded.ok || decoded.data.activeMatch === null)
        throw new Error("Chess960 profile must decode")
      const resumed = resumeWebMatch(decoded.data.activeMatch)
      expect(resumed.timeline.cursor).toBe(0)
      expect(resumed.timeline.transitions).toHaveLength(2)
      expect(resumed.matchSeed).toBe(matchSeed)
      expect(currentMatchPosition(resumed.timeline).fen).toBe(fresh.currentFen)
      expect(decoded.data.activeMatch).toEqual(saved)
      expect(() =>
        resumeWebMatch({
          ...saved,
          opponentPolicyFingerprint: STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
        }),
      ).toThrow("policy does not match")
      expect(() =>
        resumeWebMatch({ ...saved, matchId: chickenMatchId(matchSeed) }),
      ).toThrow("identity does not match")
    },
  )

  it("builds the exact cursor-zero record for a fresh runtime", () => {
    const record = buildFreshWebMatch({
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
    const fresh = buildFreshWebMatch({
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

    const resumed = resumeWebMatch(saved)
    expect(resumed.matchSeed).toBe(matchSeed)
    expect(resumed.timeline.cursor).toBe(0)
    expect(resumed.timeline.transitions).toHaveLength(2)
    expect(currentMatchPosition(resumed.timeline).fen).toBe(fresh.currentFen)
  })

  it("rejects a saved match from another Chicken policy", () => {
    const fresh = buildFreshWebMatch({
      autoHintMode: "auto-move-hints",
      playerEloAtStart: 100,
      runtime,
    })

    expect(() =>
      resumeWebMatch({
        ...fresh,
        opponentPolicyFingerprint: `${STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT}/changed`,
      }),
    ).toThrow("Saved Chicken policy does not match")
  })

  it("round-trips the implemented identity but rejects catalog-only opponents", () => {
    const record = buildFreshWebMatch({
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
    expect(resumeWebMatch(decoded.data.activeMatch)).toEqual(
      resumeWebMatch(record),
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
