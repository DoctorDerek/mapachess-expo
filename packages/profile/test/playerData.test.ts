import { describe, expect, it } from "vitest"
import { DEFAULT_CHALLENGE_SETUP } from "@mapachess/match/challenge-setup"
import createInitialMapachessPlayerData, {
  INITIAL_PLAYER_ELO,
  MAPACHESS_PLAYER_DATA_SCHEMA,
  MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  PLAYER_ELO_RATING_IDS,
} from "../src/playerData.js"
import { decodeMapachessPlayerData } from "../src/playerDataCodec.js"

describe("Mapachess player data", () => {
  it("creates the canonical private player profile", () => {
    const playerData = createInitialMapachessPlayerData()

    expect(playerData).toEqual({
      activeMatch: null,
      ratings: {
        chess960Challenge: INITIAL_PLAYER_ELO,
        chess960Story: INITIAL_PLAYER_ELO,
        standardChallenge: INITIAL_PLAYER_ELO,
        standardStory: INITIAL_PLAYER_ELO,
      },
      revision: 0,
      schema: MAPACHESS_PLAYER_DATA_SCHEMA,
      schemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
      storyProgress: { standard: [], chess960: [] },
      settings: {
        autoHintMode: "auto-move-hints",
        challengeSetup: DEFAULT_CHALLENGE_SETUP,
      },
    })
    expect(Object.keys(playerData.ratings).sort()).toEqual(
      [...PLAYER_ELO_RATING_IDS].sort(),
    )
    expect(Object.isFrozen(playerData)).toBe(true)
    expect(Object.isFrozen(playerData.ratings)).toBe(true)
    expect(Object.isFrozen(playerData.settings)).toBe(true)
  })

  it("creates independent immutable rating records", () => {
    const first = createInitialMapachessPlayerData()
    const second = createInitialMapachessPlayerData()

    expect(first.ratings).not.toBe(second.ratings)
    expect(first.ratings).toEqual(second.ratings)
  })

  it.each([null, 0, 959])(
    "preserves Chess960 selection %s without sharing mutable input",
    (chess960PositionId) => {
      const setup = {
        opponentId: "bunny-stockfish",
        difficultyTargetElo: 1000,
        chess960PositionId,
        playerColor: "black",
        variant: "chess960",
      }
      const initial = createInitialMapachessPlayerData()
      const decoded = decodeMapachessPlayerData({
        ...initial,
        settings: { ...initial.settings, challengeSetup: setup },
      })
      if (!decoded.ok) throw new Error("Valid Challenge setup must decode")
      expect(decoded.data.settings.challengeSetup).toEqual(setup)
      expect(decoded.data.settings.challengeSetup).not.toBe(setup)
      expect(Object.isFrozen(decoded.data.settings.challengeSetup)).toBe(true)
      expect(decoded.data.ratings).toEqual(initial.ratings)
    },
  )

  it.each([
    undefined,
    null,
    { ...DEFAULT_CHALLENGE_SETUP, variant: "unsupported" },
    { ...DEFAULT_CHALLENGE_SETUP, playerColor: "random" },
    { ...DEFAULT_CHALLENGE_SETUP, chess960PositionId: 0 },
    { ...DEFAULT_CHALLENGE_SETUP, variant: "chess960", chess960PositionId: -1 },
    {
      ...DEFAULT_CHALLENGE_SETUP,
      variant: "chess960",
      chess960PositionId: 960,
    },
    {
      ...DEFAULT_CHALLENGE_SETUP,
      variant: "chess960",
      chess960PositionId: 0.5,
    },
    { ...DEFAULT_CHALLENGE_SETUP, extra: true },
    { ...DEFAULT_CHALLENGE_SETUP, opponentId: "invented-animal" },
    { ...DEFAULT_CHALLENGE_SETUP, difficultyTargetElo: 0 },
    { ...DEFAULT_CHALLENGE_SETUP, difficultyTargetElo: "100" },
  ])(
    "rejects invalid saved Challenge setup %j rather than substituting defaults",
    (challengeSetup) => {
      const initial = createInitialMapachessPlayerData()
      expect(
        decodeMapachessPlayerData({
          ...initial,
          settings: { ...initial.settings, challengeSetup },
        }),
      ).toEqual({
        issue: {
          path: "$.settings.challengeSetup",
          type: "PROFILE.DATA_INVALID",
        },
        ok: false,
      })
    },
  )
})
