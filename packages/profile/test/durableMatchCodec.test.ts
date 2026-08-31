import { describe, expect, it } from "vitest"
import createInitialMapachessPlayerData from "../src/playerData.js"
import { decodeMapachessPlayerData } from "../src/playerDataCodec.js"

const INITIAL_STANDARD_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const AFTER_E4_FEN =
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"

const activeMatch = Object.freeze({
  autoHintsEnabledAtStart: true,
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
  recordVersion: 1,
  startingPosition: Object.freeze({
    chess960PositionId: null,
    variant: "standard",
  }),
  timeControl: Object.freeze({ type: "untimed" }),
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
          ...activeMatch,
          currentFen: AFTER_E4_FEN,
          cursor: 1,
          moveIds: ["e2e4", "e7e5"],
        }),
      ),
    ).toMatchObject({
      data: {
        activeMatch: {
          currentFen: AFTER_E4_FEN,
          cursor: 1,
          moveIds: ["e2e4", "e7e5"],
        },
      },
      ok: true,
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
