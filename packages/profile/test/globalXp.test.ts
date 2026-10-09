import { describe, expect, it } from "vitest"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import {
  completedMatchXpAward,
  levelAchievementsCrossed,
  levelFromTotalXp,
  levelProgress,
  xpAtLevel,
} from "../src/globalXp.js"
import createInitialMapachessPlayerData, {
  TWO_VARIANT_PLAYER_DATA_SCHEMA_VERSION,
} from "../src/playerData.js"
import {
  decodeMapachessPlayerData,
  decodeMapachessPlayerDataWithSource,
} from "../src/playerDataCodec.js"
import { decodeMapachessPortableBackup } from "../src/portableBackup.js"
import { replaceActiveMatch, resetPlayerElo } from "../src/profileMutations.js"
import { decodeStoredPlayerData } from "../src/storedPlayerData.js"
import { sha256 } from "./profileTestSupport.js"
import completedStoryMatch from "./storyProgressTestSupport.js"

const completed = completedStoryMatch()
const opening = {
  ...completed,
  conclusion: null,
  currentFen: createInitialMatchPosition(completed.startingPosition).fen,
  cursor: 0,
  moveIds: [],
}

describe("global match XP", () => {
  it("derives uncapped Levels and ordered boundaries from canonical XP", () => {
    expect([0, 4, 8, 20, 180, 1820, 16364].map(levelFromTotalXp)).toEqual([
      1, 3, 5, 12, 100, 1002, 9001,
    ])
    expect(xpAtLevel(2)).toBe(2)
    expect(xpAtLevel(3)).toBe(4)
    expect(xpAtLevel(100)).toBe(180)
    expect(levelProgress(4)).toEqual({ level: 3, current: 0, required: 2 })
    expect(levelAchievementsCrossed(0, 8)).toEqual(["reach-level-5"])
    expect(levelAchievementsCrossed(16, 20)).toEqual(["reach-level-10"])
  })

  it("awards base XP for all completed outcomes and bonuses only for a calibrated stronger win", () => {
    const stronger = { ...completed, ratedOpponentElo: 200 }
    expect(completedMatchXpAward(stronger)).toBe(8)
    expect(completedMatchXpAward({ ...stronger, ratedOpponentElo: 199 })).toBe(
      4,
    )
    expect(completedMatchXpAward({ ...stronger, ratedOpponentElo: null })).toBe(
      4,
    )
    expect(
      completedMatchXpAward({ ...stronger, conclusion: { type: "stalemate" } }),
    ).toBe(4)
    expect(
      completedMatchXpAward({
        ...stronger,
        conclusion: { type: "resignation", winner: "white" },
      }),
    ).toBe(4)
    expect(() => completedMatchXpAward(opening)).toThrow()
  })

  it("records XP, Level unlock and exact Elo in the same once-only result revision", () => {
    const initial = createInitialMapachessPlayerData()
    const activeOpening = {
      ...opening,
      opponentTargetElo: 200,
      ratedOpponentElo: 200,
    }
    const activeResult = {
      ...completed,
      opponentTargetElo: 200,
      ratedOpponentElo: 200,
    }
    const before = replaceActiveMatch(initial, activeOpening)
    const accepted = replaceActiveMatch(before, activeResult)

    expect(accepted.totalXp).toBe(8)
    expect(levelFromTotalXp(accepted.totalXp)).toBe(5)
    expect(accepted.unlockedAchievementIds).toEqual(["reach-level-5"])
    expect(accepted.processedMatchResultIds).toEqual([activeResult.matchId])
    expect(accepted.lastAcceptedResultReward).toMatchObject({
      matchId: activeResult.matchId,
      awardedXp: 8,
      totalXpBefore: 0,
      unlockedAchievementIds: ["reach-level-5"],
      ratedElo: {
        variant: "standard",
        before: 100,
        after: accepted.ratings.standard,
      },
    })
    expect(replaceActiveMatch(accepted, activeResult).totalXp).toBe(8)
    expect(resetPlayerElo(accepted, "standard").totalXp).toBe(8)
    expect(
      decodeMapachessPlayerData(JSON.parse(JSON.stringify(accepted))),
    ).toEqual({ data: accepted, ok: true })
  })

  it("migrates version seven and its authenticated portable backup without retrospective XP", async () => {
    const completedOldProfile = replaceActiveMatch(
      replaceActiveMatch(createInitialMapachessPlayerData(), opening),
      completed,
    )
    const {
      totalXp: _totalXp,
      settings: {
        chessAppearance: _chessAppearance,
        coachCollection: _coachCollection,
        ...settings
      },
      appearance: _appearance,
      unlockedAchievementIds: _unlockedAchievementIds,
      lastAcceptedResultReward: _lastAcceptedResultReward,
      ...previousFields
    } = completedOldProfile
    const versionSeven = {
      ...previousFields,
      settings,
      schemaVersion: TWO_VARIANT_PLAYER_DATA_SCHEMA_VERSION,
    }
    const decoded = decodeMapachessPlayerDataWithSource(versionSeven)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("The legacy profile must migrate.")
    expect(decoded.data.totalXp).toBe(0)
    expect(decoded.data.unlockedAchievementIds).toEqual([])
    expect(decoded.data.lastAcceptedResultReward).toBeNull()
    expect(decoded.data.processedMatchResultIds).toEqual([completed.matchId])
    expect(replaceActiveMatch(decoded.data, completed).totalXp).toBe(0)
    expect(decoded.source.schemaVersion).toBe(7)
    const backup = {
      applicationVersion: "legacy-test",
      format: "mapachess-portable-backup",
      formatVersion: 1,
      gddRevision: "v4.4",
      integrity: {
        algorithm: "SHA-256",
        payloadHash: await sha256(decoded.source.canonical),
      },
      payload: versionSeven,
      saveSchemaVersion: 7,
    }
    const imported = await decodeMapachessPortableBackup(
      JSON.stringify(backup),
      sha256,
    )
    expect(imported.ok).toBe(true)
    if (!imported.ok) throw new Error("Legacy backup must migrate.")
    expect(imported.backup.payload.totalXp).toBe(0)
    expect(imported.backup.payload.processedMatchResultIds).toEqual([
      completed.matchId,
    ])
    const stored = await decodeStoredPlayerData(
      JSON.stringify({
        format: "mapachess-stored-player-data",
        formatVersion: 1,
        integrity: backup.integrity,
        payload: versionSeven,
        saveSchemaVersion: 7,
      }),
      sha256,
    )
    expect(stored).toEqual({ data: decoded.data, ok: true })
  })

  it("rejects forged or inconsistent XP and reward receipts on import", () => {
    const initial = createInitialMapachessPlayerData()
    expect(
      decodeMapachessPlayerData({ ...initial, totalXp: -4 }),
    ).toMatchObject({ ok: false, issue: { path: "$.totalXp" } })
    expect(decodeMapachessPlayerData({ ...initial, totalXp: 5 })).toMatchObject(
      { ok: false, issue: { path: "$.totalXp" } },
    )
    expect(
      decodeMapachessPlayerData({
        ...initial,
        unlockedAchievementIds: ["reach-level-5"],
      }),
    ).toMatchObject({ ok: true })
    expect(
      decodeMapachessPlayerData({
        ...initial,
        lastAcceptedResultReward: {
          matchId: "not-processed",
          awardedXp: 8,
          totalXpBefore: 0,
          unlockedAchievementIds: ["reach-level-5"],
          ratedElo: null,
        },
        totalXp: 8,
      }),
    ).toMatchObject({
      ok: false,
      issue: { path: "$.lastAcceptedResultReward.matchId" },
    })
  })
})
