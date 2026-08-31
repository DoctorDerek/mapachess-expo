import { describe, expect, it } from "vitest"
import createInitialMapachessPlayerData, {
  INITIAL_PLAYER_ELO,
  MAPACHESS_PLAYER_DATA_SCHEMA,
  MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  PLAYER_ELO_RATING_IDS,
} from "../src/playerData.js"

describe("Mapachess player data", () => {
  it("creates the canonical private first-run profile", () => {
    const playerData = createInitialMapachessPlayerData()

    expect(playerData).toEqual({
      activeMatch: null,
      firstRun: { autoHintsChoiceCompleted: false },
      ratings: {
        chess960Challenge: INITIAL_PLAYER_ELO,
        chess960Story: INITIAL_PLAYER_ELO,
        standardChallenge: INITIAL_PLAYER_ELO,
        standardStory: INITIAL_PLAYER_ELO,
      },
      revision: 0,
      schema: MAPACHESS_PLAYER_DATA_SCHEMA,
      schemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
      settings: { autoHintsEnabled: true },
    })
    expect(Object.keys(playerData.ratings).sort()).toEqual(
      [...PLAYER_ELO_RATING_IDS].sort(),
    )
    expect(Object.isFrozen(playerData)).toBe(true)
    expect(Object.isFrozen(playerData.firstRun)).toBe(true)
    expect(Object.isFrozen(playerData.ratings)).toBe(true)
    expect(Object.isFrozen(playerData.settings)).toBe(true)
  })

  it("creates independent immutable rating records", () => {
    const first = createInitialMapachessPlayerData()
    const second = createInitialMapachessPlayerData()

    expect(first.ratings).not.toBe(second.ratings)
    expect(first.ratings).toEqual(second.ratings)
  })
})
