import { describe, expect, it } from "vitest"
import {
  DURABLE_MATCH_RECORD_VERSION,
  LEGACY_DURABLE_MATCH_RECORD_VERSION_2,
} from "@mapachess/match/durable-match-record"
import createInitialMapachessPlayerData from "../src/playerData.js"
import { decodeMapachessPlayerData } from "../src/playerDataCodec.js"

const INITIAL_STANDARD_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const AFTER_E4_FEN =
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"

const activeMatchFields = Object.freeze({
  currentFen: INITIAL_STANDARD_FEN,
  cursor: 0,
  matchId: "standard-story-chicken/0123456789abcdef0123456789abcdef",
  matchSeed: "0123456789abcdef0123456789abcdef",
  mode: "story",
  moveHintsUsed: false,
  moveIds: Object.freeze([]),
  opponentId: "chicken-stockfish",
  opponentPolicyFingerprint: "standard-chicken-test-policy",
  pieceHintsUsed: false,
  playerColor: "white",
  playerEloAtStart: 100,
  startingPosition: Object.freeze({
    chess960PositionId: null,
    variant: "standard",
  }),
  timeControl: Object.freeze({ type: "untimed" }),
})

const legacyActiveMatch = Object.freeze({
  ...activeMatchFields,
  autoHintsEnabledAtStart: true,
  recordVersion: 1,
})

const activeMatch = Object.freeze({
  ...activeMatchFields,
  autoHintMode: "auto-move-hints",
  conclusion: null,
  recordVersion: DURABLE_MATCH_RECORD_VERSION,
})

const playerDataWithMatch = (match: unknown): unknown => ({
  ...createInitialMapachessPlayerData(),
  activeMatch: match,
})

describe("durable active-match decoding", () => {
  it("accepts a chess branch whose saved cursor derives its exact FEN", () => {
    expect(
      decodeMapachessPlayerData(
        playerDataWithMatch({
          ...legacyActiveMatch,
          currentFen: AFTER_E4_FEN,
          cursor: 1,
          moveIds: ["e2e4", "e7e5"],
        }),
      ),
    ).toMatchObject({
      data: {
        activeMatch: {
          autoHintMode: "auto-move-hints",
          conclusion: null,
          currentFen: AFTER_E4_FEN,
          cursor: 1,
          moveIds: ["e2e4", "e7e5"],
          recordVersion: DURABLE_MATCH_RECORD_VERSION,
        },
      },
      ok: true,
    })
  })

  it("migrates record v2 and its binary Auto-Hints setting", () => {
    expect(
      decodeMapachessPlayerData(
        playerDataWithMatch({
          ...legacyActiveMatch,
          conclusion: null,
          recordVersion: LEGACY_DURABLE_MATCH_RECORD_VERSION_2,
        }),
      ),
    ).toMatchObject({
      data: {
        activeMatch: {
          autoHintMode: "auto-move-hints",
          conclusion: null,
          recordVersion: DURABLE_MATCH_RECORD_VERSION,
        },
      },
      ok: true,
    })
  })

  it("derives a retained terminal result while migrating record v1", () => {
    expect(
      decodeMapachessPlayerData(
        playerDataWithMatch({
          ...legacyActiveMatch,
          currentFen:
            "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
          cursor: 4,
          moveIds: ["f2f3", "e7e5", "g2g4", "d8h4"],
        }),
      ),
    ).toMatchObject({
      data: {
        activeMatch: {
          conclusion: { type: "checkmate", winner: "black" },
          recordVersion: DURABLE_MATCH_RECORD_VERSION,
        },
      },
      ok: true,
    })
  })

  it("accepts a current draw agreement on an active branch", () => {
    expect(
      decodeMapachessPlayerData(
        playerDataWithMatch({
          ...activeMatch,
          conclusion: { type: "draw-agreement" },
        }),
      ),
    ).toMatchObject({
      data: {
        activeMatch: {
          conclusion: { type: "draw-agreement" },
          recordVersion: DURABLE_MATCH_RECORD_VERSION,
        },
      },
      ok: true,
    })
  })

  it("rejects a resignation that declares the player the winner", () => {
    expect(
      decodeMapachessPlayerData(
        playerDataWithMatch({
          ...activeMatch,
          conclusion: { type: "resignation", winner: "white" },
        }),
      ),
    ).toEqual({
      issue: {
        path: "$.activeMatch.conclusion",
        type: "PROFILE.DATA_INVALID",
      },
      ok: false,
    })
  })

  it("rejects a voluntary result on a terminal retained branch", () => {
    expect(
      decodeMapachessPlayerData(
        playerDataWithMatch({
          ...activeMatch,
          conclusion: { type: "draw-agreement" },
          currentFen:
            "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
          cursor: 4,
          moveIds: ["f2f3", "e7e5", "g2g4", "d8h4"],
        }),
      ),
    ).toEqual({
      issue: {
        path: "$.activeMatch.conclusion",
        type: "PROFILE.DATA_INVALID",
      },
      ok: false,
    })
  })

  it("rejects a syntactic move that is illegal in the replayed position", () => {
    expect(
      decodeMapachessPlayerData(
        playerDataWithMatch({
          ...activeMatch,
          cursor: 1,
          moveIds: ["e2e5"],
        }),
      ),
    ).toEqual({
      issue: {
        path: "$.activeMatch.moveIds[0]",
        type: "PROFILE.DATA_INVALID",
      },
      ok: false,
    })
  })

  it("rejects a current FEN that disagrees with the saved cursor", () => {
    expect(
      decodeMapachessPlayerData(
        playerDataWithMatch({
          ...activeMatch,
          cursor: 1,
          moveIds: ["e2e4"],
        }),
      ),
    ).toEqual({
      issue: {
        path: "$.activeMatch.currentFen",
        type: "PROFILE.DATA_INVALID",
      },
      ok: false,
    })
  })
})
