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
  original
    .slice(0, count)
    .map(({ id }, index) => ({
      opponentId: id,
      highestMedal: STORY_MEDALS[index % STORY_MEDALS.length]!,
    }))

describe("Story roster upgrades", () => {
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
    "records 23 → 24 → 25 in %s and shares only the defeated animal with Challenge",
    (variant) => {
      const progress = decodeStoryProgress(
        { standard: [], chess960: [], [variant]: victories(23) },
        "$.storyProgress",
        true,
      )
      const win = completedStoryMatch(variant)
      expect(selectStoryCompletion(progress)[variant]).toBe(92)
      expect(selectDefaultStoryOpponent(progress, variant)).toBe(
        "squirrel-stockfish",
      )
      const tiger = applyStoryMatchResult(progress, {
        ...win,
        opponentId: "tiger-stockfish",
      })
      expect(selectStoryCompletion(tiger)[variant]).toBe(96)
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
      expect(selectStoryCompletion(squirrel)[variant]).toBe(100)
      expect(
        selectStoryLadder(squirrel, variant).every(
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
      backup: { saveSchemaVersion: 19, payload: migrated },
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
