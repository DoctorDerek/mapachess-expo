import { describe, expect, it } from "vitest"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import createInitialMapachessPlayerData from "../src/playerData.js"
import {
  createMapachessPortableBackup,
  decodeMapachessPortableBackup,
} from "../src/portableBackup.js"
import { decodeStoredPlayerData } from "../src/storedPlayerData.js"
import applyStoryMatchResult, {
  canPlayStoryOpponent,
  selectChallengeUnlockedOpponents,
  selectDefaultStoryOpponent,
  selectStoryCompletion,
  selectStoryLadder,
  STORY_MEDALS,
} from "../src/storyProgress.js"
import decodeStoryProgress from "../src/storyProgressCodec.js"
import { sha256 } from "./profileTestSupport.js"
import completedStoryMatch from "./storyProgressTestSupport.js"

const original = STOCKFISH_OPPONENTS.filter(
  ({ originalStoryTargetElo }) => originalStoryTargetElo !== null,
)
const victories = (count: number) =>
  original.slice(0, count).map(({ id }, index) => ({
    opponentId: id,
    highestMedal: STORY_MEDALS[index % STORY_MEDALS.length]!,
  }))

describe("Story roster upgrades", () => {
  it("verifies the original v19 checksum before retaining Falcon access and adding unplayed Bear", async () => {
    const payload = {
      ...createInitialMapachessPlayerData(),
      schemaVersion: 19,
      introductionCompleted: true,
      storyProgress: {
        standard: STOCKFISH_OPPONENTS.slice(0, 18).map(({ id }) => ({
          opponentId: id,
          highestMedal: "gold",
        })),
        chess960: [],
      },
    }
    const envelope = {
      formatVersion: 1,
      saveSchemaVersion: 19,
      payload,
      integrity: {
        algorithm: "SHA-256",
        payloadHash:
          "0f44aa2f33d5521dc87a0b7ae5be547312f8beb829b1cf27bf0304922857f218",
      },
    }
    const stored = await decodeStoredPlayerData(
      JSON.stringify({ ...envelope, format: "mapachess-stored-player-data" }),
      sha256,
    )
    if (!stored.ok) throw new Error(JSON.stringify(stored.issue))
    expect(stored.data).toEqual({
      ...payload,
      schemaVersion: 20,
      storyProgress: {
        ...payload.storyProgress,
        retainedAccess: { standard: "falcon-stockfish" },
      },
    })
    for (const id of ["bear-stockfish", "falcon-stockfish"] as const)
      expect(
        canPlayStoryOpponent(stored.data.storyProgress, "standard", id),
      ).toBe(true)
    expect(
      selectChallengeUnlockedOpponents(stored.data.storyProgress).map(
        ({ id }) => id,
      ),
    ).not.toContain("bear-stockfish")
    expect(
      selectStoryCompletion(stored.data.storyProgress).standard,
    ).toBeCloseTo((100 * 18) / 26)
    const backup = {
      ...envelope,
      format: "mapachess-portable-backup",
      applicationVersion: "historical-v19",
      gddRevision: "5.6",
    }
    expect(
      await decodeMapachessPortableBackup(JSON.stringify(backup), sha256),
    ).toMatchObject({ ok: true, backup: { payload: stored.data } })
    expect(
      await decodeMapachessPortableBackup(
        await createMapachessPortableBackup({
          playerData: stored.data,
          applicationVersion: "test",
          gddRevision: "5.7",
          sha256,
        }),
        sha256,
      ),
    ).toMatchObject({
      ok: true,
      backup: { saveSchemaVersion: 20, payload: stored.data },
    })
    expect(
      await decodeMapachessPortableBackup(
        JSON.stringify({ ...backup, payload: { ...payload, totalXp: 4 } }),
        sha256,
      ),
    ).toMatchObject({
      ok: false,
      issue: { type: "PROFILE.BACKUP_INTEGRITY_MISMATCH" },
    })
  })
  it.each(["standard", "chess960"] as const)(
    "retains every old %s frontier by identity, without awarding new wins",
    (variant) => {
      const other = variant === "standard" ? "chess960" : "standard"
      for (let count = 0; count <= original.length; count++) {
        const source = {
          standard: [],
          chess960: [],
          [variant]: victories(count),
        }
        const progress = decodeStoryProgress(source, "$.storyProgress", true)
        expect(progress[variant]).toEqual(source[variant])
        expect(progress[other]).toEqual([])
        for (const [index, opponent] of original.entries())
          expect(canPlayStoryOpponent(progress, variant, opponent.id)).toBe(
            index <= count,
          )
        expect(
          canPlayStoryOpponent(progress, variant, "squirrel-stockfish"),
        ).toBe(count >= 5)
        expect(canPlayStoryOpponent(progress, variant, "tiger-stockfish")).toBe(
          count >= 16,
        )
        expect(
          selectChallengeUnlockedOpponents(progress).map(({ id }) => id),
        ).toEqual(original.slice(0, Math.max(1, count)).map(({ id }) => id))
        expect(
          decodeStoryProgress(
            JSON.parse(JSON.stringify(progress)),
            "$.storyProgress",
          ),
        ).toEqual(progress)
      }
    },
  )
  it.each(["standard", "chess960"] as const)(
    "records 23 → 24 → 25 → 26 in %s and shares only the defeated animal with Challenge",
    (variant) => {
      const progress = decodeStoryProgress(
        { standard: [], chess960: [], [variant]: victories(23) },
        "$.storyProgress",
        true,
      )
      const win = completedStoryMatch(variant)
      expect(selectStoryCompletion(progress)[variant]).toBeCloseTo(
        (100 * 23) / 26,
      )
      expect(selectDefaultStoryOpponent(progress, variant)).toBe(
        "squirrel-stockfish",
      )
      const tiger = applyStoryMatchResult(progress, {
        ...win,
        opponentId: "tiger-stockfish",
      })
      expect(selectStoryCompletion(tiger)[variant]).toBeCloseTo((100 * 24) / 26)
      expect(
        selectChallengeUnlockedOpponents(tiger).map(({ id }) => id),
      ).toContain("tiger-stockfish")
      expect(
        selectChallengeUnlockedOpponents(tiger).map(({ id }) => id),
      ).not.toContain("squirrel-stockfish")
      const squirrel = applyStoryMatchResult(tiger, {
        ...win,
        opponentId: "squirrel-stockfish",
      })
      expect(selectStoryCompletion(squirrel)[variant]).toBeCloseTo(
        (100 * 25) / 26,
      )
      const bear = applyStoryMatchResult(squirrel, {
        ...win,
        opponentId: "bear-stockfish",
      })
      expect(selectStoryCompletion(bear)[variant]).toBe(100)
      expect(
        selectStoryLadder(bear, variant).every(
          ({ status }) => status === "defeated",
        ),
      ).toBe(true)
      expect(
        applyStoryMatchResult(squirrel, {
          ...win,
          opponentId: "tiger-stockfish",
        }),
      ).toBe(squirrel)
      expect(decodeStoryProgress(squirrel, "$.storyProgress")).toEqual(squirrel)
    },
  )
  it("imports a v18 backup and stored envelope with the original release's SHA-256, then exports and reimports its new access", async () => {
    const payload = {
      ...createInitialMapachessPlayerData(),
      schemaVersion: 18,
      introductionCompleted: true,
      storyProgress: { standard: victories(5), chess960: victories(16) },
    }
    const envelope = {
      formatVersion: 1,
      saveSchemaVersion: 18,
      integrity: {
        algorithm: "SHA-256",
        payloadHash:
          "0a7063b428462a3fe477e8844e52f2afcac364e829b6ffc5cede5971d2324f65",
      },
      payload,
    }
    const backup = {
      ...envelope,
      format: "mapachess-portable-backup",
      applicationVersion: "historical-qa",
      gddRevision: "historical",
    }
    const result = await decodeMapachessPortableBackup(
      JSON.stringify(backup),
      sha256,
    )
    if (!result.ok) throw new Error(JSON.stringify(result.issue))
    const migrated = result.backup.payload
    expect(migrated.storyProgress.retainedAccess).toEqual({
      standard: "frog-stockfish",
      chess960: "falcon-stockfish",
    })
    expect(
      await decodeStoredPlayerData(
        JSON.stringify({ ...envelope, format: "mapachess-stored-player-data" }),
        sha256,
      ),
    ).toEqual({ ok: true, data: migrated })
    const roundTrip = await decodeMapachessPortableBackup(
      await createMapachessPortableBackup({
        playerData: migrated,
        applicationVersion: "test",
        gddRevision: "5.5",
        sha256,
      }),
      sha256,
    )
    expect(roundTrip).toMatchObject({
      ok: true,
      backup: { saveSchemaVersion: 20, payload: migrated },
    })
    expect(
      await decodeMapachessPortableBackup(
        JSON.stringify({ ...backup, payload: { ...payload, revision: 7 } }),
        sha256,
      ),
    ).toMatchObject({
      ok: false,
      issue: { type: "PROFILE.BACKUP_INTEGRITY_MISMATCH" },
    })
  })
  it("keeps a returning player's chosen Wolf, earned achievements and Challenge record", async () => {
    const initial = createInitialMapachessPlayerData()
    const animal = "wolf-stockfish"
    const challengeSetup = {
      ...initial.settings.challengeSetup,
      opponentId: animal,
      difficultyTargetElo: 2325,
    }
    const history = {
      animals: [
        {
          opponentId: animal,
          lifetimeWins: 1,
          lifetimeLosses: 0,
          highestMedal: "silver",
        },
      ],
      difficulties: [
        { targetElo: 2325, lastPlayedAnimal: animal, highestMedal: "silver" },
      ],
    }
    const payload = {
      ...initial,
      schemaVersion: 18,
      introductionCompleted: true,
      totalXp: 100,
      storyProgress: { standard: victories(23), chess960: [] },
      appearance: { ...initial.appearance, animal },
      settings: { ...initial.settings, challengeSetup },
      unlockedAchievementIds: [
        "reach-level-5",
        "reach-level-10",
        "reach-level-25",
        "reach-level-37",
        "reach-level-50",
      ],
      challengeHistory: { ...initial.challengeHistory, chess960: history },
    }
    const migrated = await decodeStoredPlayerData(
      JSON.stringify({
        format: "mapachess-stored-player-data",
        formatVersion: 1,
        saveSchemaVersion: 18,
        payload,
        integrity: {
          algorithm: "SHA-256",
          payloadHash:
            "dd28bc2c6cc42b72e7634be2499b113625d6cf1eb21615a75b4b9175892ea774",
        },
      }),
      sha256,
    )
    expect(migrated).toMatchObject({
      ok: true,
      data: {
        schemaVersion: 20,
        totalXp: 100,
        appearance: payload.appearance,
        settings: payload.settings,
        challengeHistory: payload.challengeHistory,
        unlockedAchievementIds: payload.unlockedAchievementIds,
        ratings: payload.ratings,
        ratedMatchCounts: payload.ratedMatchCounts,
      },
    })
  })
  it("keeps a new player on the new route and rejects unearned access or impossible victory order", () => {
    const fresh = { standard: victories(5), chess960: [] }
    const decoded = decodeStoryProgress(fresh, "$.storyProgress")
    expect(
      canPlayStoryOpponent(decoded, "standard", "squirrel-stockfish"),
    ).toBe(true)
    expect(canPlayStoryOpponent(decoded, "standard", "frog-stockfish")).toBe(
      false,
    )
    expect(() =>
      decodeStoryProgress(
        { ...fresh, retainedAccess: { standard: "falcon-stockfish" } },
        "$.storyProgress",
      ),
    ).toThrow()
    expect(() =>
      decodeStoryProgress(
        { standard: victories(6), chess960: [] },
        "$.storyProgress",
      ),
    ).toThrow()
    expect(() =>
      decodeStoryProgress(
        { standard: [...victories(1), ...victories(1)], chess960: [] },
        "$.storyProgress",
      ),
    ).toThrow()
  })
})
