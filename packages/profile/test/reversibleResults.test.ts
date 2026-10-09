import { describe, expect, it } from "vitest"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import { parseMatchMoveId } from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  currentMatchPosition,
} from "@mapachess/match/match-timeline"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import createInitialMapachessPlayerData, {
  GLOBAL_XP_PLAYER_DATA_SCHEMA_VERSION,
} from "../src/playerData.js"
import {
  canonicalPlayerData,
  decodeMapachessPlayerDataWithSource,
} from "../src/playerDataCodec.js"
import { decodeMapachessPortableBackup } from "../src/portableBackup.js"
import {
  changeAutoHintMode,
  replaceActiveMatch,
  resetPlayerElo,
} from "../src/profileMutations.js"
import { sha256 } from "./profileTestSupport.js"
import completedStoryMatch from "./storyProgressTestSupport.js"

const opened = (match: DurableMatchRecord): DurableMatchRecord => ({
  ...match,
  conclusion: null,
  cursor: 0,
  currentFen: createInitialMatchPosition(match.startingPosition).fen,
})

describe("one reversible active result", () => {
  it("preserves future move grades when a reopened ending is replaced and restored", () => {
    const fixture = completedStoryMatch()
    let timeline = createMatchTimeline(
      createInitialMatchPosition(fixture.startingPosition),
    )
    for (const id of fixture.moveIds.slice(0, 3)) {
      const moved = applyMatchTimelineMove(timeline, id)
      if (!moved.ok) throw new Error("Fixture prefix must be legal")
      timeline = moved.timeline
    }
    const beforeFen = currentMatchPosition(timeline).fen
    const move = parseMatchMoveId("d8h4")
    if (!move.ok) throw new Error("Fixture checkmate move must parse")
    const feedback: MoveFeedbackRecord = {
      ply: 4,
      moveId: move.moveId,
      mover: "black",
      beforeFen,
      afterFen: fixture.currentFen,
      before: { kind: "mate", bound: "exact", moves: 1, winner: "black" },
      after: { kind: "mate", bound: "exact", moves: 0, winner: "black" },
      grade: "best",
      reason: null,
      policyId: "mapachess-gdd-3.1",
    }
    const win: DurableMatchRecord = { ...fixture, moveFeedback: [feedback] }
    const accepted = replaceActiveMatch(
      replaceActiveMatch(createInitialMapachessPlayerData(), opened(win)),
      win,
    )
    const reopened: DurableMatchRecord = {
      ...win,
      conclusion: null,
      cursor: 3,
      currentFen: beforeFen,
    }
    const resignation = { type: "resignation", winner: "white" } as const
    const loss: DurableMatchRecord = {
      ...reopened,
      conclusion: resignation,
      retainedConclusion: { conclusion: resignation, cursor: 3 },
    }
    const replaced = replaceActiveMatch(
      replaceActiveMatch(accepted, reopened),
      loss,
    )
    const decoded = decodeMapachessPlayerDataWithSource(replaced)
    expect(decoded).toMatchObject({ ok: true })
    if (!decoded.ok) throw new Error("Replacement ending must remain portable")
    expect(decoded.data.activeMatch?.moveFeedback).toEqual([feedback])
    const undone = replaceActiveMatch(decoded.data, {
      ...loss,
      conclusion: null,
    })
    expect(decodeMapachessPlayerDataWithSource(undone).ok).toBe(true)
    const restored = replaceActiveMatch(undone, loss)
    expect(restored.totalXp).toBe(replaced.totalXp)
    expect(restored.activeMatch?.moveFeedback).toEqual([feedback])
    expect(decodeMapachessPlayerDataWithSource(restored).ok).toBe(true)
  })

  it.each(["standard", "chess960"] as const)(
    "retracts/restores %s balances while retaining milestones",
    (variant) => {
      const win = {
        ...completedStoryMatch(variant),
        opponentTargetElo: 200,
        ratedOpponentElo: 200,
      }
      const initial = replaceActiveMatch(
        createInitialMapachessPlayerData(),
        opened(win),
      )
      const accepted = replaceActiveMatch(initial, win)
      const reopened = replaceActiveMatch(accepted, opened(win))
      expect(reopened.totalXp).toBe(0)
      expect(reopened.ratings).toEqual(initial.ratings)
      expect(reopened.ratedMatchCounts).toEqual(initial.ratedMatchCounts)
      expect(reopened.unlockedAchievementIds).toEqual(["reach-level-5"])
      expect(reopened.storyProgress).toEqual(accepted.storyProgress)
      const decoded = decodeMapachessPlayerDataWithSource(
        JSON.parse(JSON.stringify(reopened)),
      )
      expect(decoded).toMatchObject({ ok: true })
      if (!decoded.ok) throw new Error("Reopened match must remain portable")
      const restored = replaceActiveMatch(decoded.data, win)
      expect(restored.totalXp).toBe(8)
      expect(restored.ratings).toEqual(accepted.ratings)
      expect(restored.ratedMatchCounts).toEqual(accepted.ratedMatchCounts)
      expect(restored.lastAcceptedResultReward?.unlockedAchievementIds).toEqual(
        [],
      )
      expect(replaceActiveMatch(restored, win).totalXp).toBe(8)
      const preferences = changeAutoHintMode(restored, "auto-piece-hints")
      const twiceReopened = replaceActiveMatch(preferences, {
        ...opened(win),
        autoHintMode: "auto-piece-hints",
      })
      expect(twiceReopened.settings.autoHintMode).toBe("auto-piece-hints")
      expect(
        replaceActiveMatch(twiceReopened, twiceReopened.activeMatch).totalXp,
      ).toBe(0)
    },
  )

  it.each(["standard", "chess960"] as const)(
    "replaces Challenge %s wins with losses, preserving the best medal",
    (variant) => {
      const win: DurableMatchRecord = {
        ...completedStoryMatch(variant),
        mode: "challenge",
        opponentTargetElo: 200,
        ratedOpponentElo: 200,
      }
      const start = replaceActiveMatch(
        createInitialMapachessPlayerData(),
        opened(win),
      )
      const accepted = replaceActiveMatch(start, win)
      const reopen = replaceActiveMatch(accepted, opened(win))
      expect(reopen.challengeHistory[variant].animals[0]).toMatchObject({
        lifetimeWins: 0,
        lifetimeLosses: 0,
        highestMedal: "gold",
      })
      expect(decodeMapachessPlayerDataWithSource(reopen)).toMatchObject({
        ok: true,
      })
      const loss: DurableMatchRecord = {
        ...opened(win),
        conclusion: { type: "resignation", winner: "white" },
      }
      const replaced = replaceActiveMatch(reopen, loss)
      expect(replaced.totalXp).toBe(4)
      expect(replaced.ratedMatchCounts[variant]).toBe(1)
      expect(
        replaced.lastAcceptedResultReward?.contribution?.ending.conclusion,
      ).toEqual(loss.conclusion)
      expect(replaced.challengeHistory[variant].animals[0]).toMatchObject({
        lifetimeWins: 0,
        lifetimeLosses: 1,
        highestMedal: "gold",
      })
      expect(decodeMapachessPlayerDataWithSource(replaced).ok).toBe(true)
      const again = replaceActiveMatch(replaced, loss)
      expect(again.challengeHistory).toBe(replaced.challengeHistory)
      const draw: DurableMatchRecord = {
        ...opened(win),
        conclusion: { type: "draw-agreement" },
      }
      const drawn = replaceActiveMatch(
        replaceActiveMatch(again, opened(win)),
        draw,
      )
      expect(drawn.totalXp).toBe(4)
      expect(drawn.challengeHistory[variant].animals[0]).toMatchObject({
        lifetimeWins: 0,
        lifetimeLosses: 0,
        highestMedal: "gold",
      })
    },
  )

  it("never resurrects an Elo reset after a completed ending", () => {
    const win = {
      ...completedStoryMatch(),
      opponentTargetElo: 200,
      ratedOpponentElo: 200,
    }
    const accepted = replaceActiveMatch(
      replaceActiveMatch(createInitialMapachessPlayerData(), opened(win)),
      win,
    )
    const reset = resetPlayerElo(accepted, "standard")
    expect(decodeMapachessPlayerDataWithSource(reset)).toMatchObject({
      ok: true,
    })
    const redo = replaceActiveMatch(replaceActiveMatch(reset, opened(win)), win)
    expect(redo.totalXp).toBe(8)
    expect(redo.ratings.standard).toBe(100)
    expect(redo.ratedMatchCounts.standard).toBe(0)
    expect(redo.lastAcceptedResultReward?.ratedElo).toBeNull()
  })

  it("rates a new ending against an Elo reset while unfinished", () => {
    const win = {
      ...completedStoryMatch(),
      opponentTargetElo: 200,
      ratedOpponentElo: 200,
    }
    const initial = {
      ...createInitialMapachessPlayerData(),
      ratings: { standard: 500, chess960: 100 },
      ratedMatchCounts: { standard: 9, chess960: 0 },
    }
    const accepted = replaceActiveMatch(
      replaceActiveMatch(initial, opened(win)),
      win,
    )
    const reset = resetPlayerElo(
      replaceActiveMatch(accepted, opened(win)),
      "standard",
    )
    expect(decodeMapachessPlayerDataWithSource(reset)).toMatchObject({
      ok: true,
    })
    const redo = replaceActiveMatch(reset, win)
    expect(redo.lastAcceptedResultReward?.ratedElo?.before).toBe(100)
    expect(
      redo.lastAcceptedResultReward?.contribution?.ratedMatchCountBefore,
    ).toBe(0)
    expect(redo.ratedMatchCounts.standard).toBe(1)
    expect(decodeMapachessPlayerDataWithSource(redo).ok).toBe(true)
  })

  it("authenticates v8 before migration and keeps its missing contribution as a baseline", async () => {
    const win = {
      ...completedStoryMatch(),
      opponentTargetElo: 200,
      ratedOpponentElo: 200,
    }
    const accepted = replaceActiveMatch(
      replaceActiveMatch(createInitialMapachessPlayerData(), opened(win)),
      win,
    )
    const reward = accepted.lastAcceptedResultReward
    if (reward === null) throw new Error("Fixture requires a receipt")
    const { contribution: _contribution, ...legacyReward } = reward
    const {
      appearance: _appearance,
      settings: {
        chessAppearance: _chessAppearance,
        coachCollection: _coachCollection,
        ...settings
      },
      ...legacyFields
    } = accepted
    const payload = {
      ...legacyFields,
      settings,
      schemaVersion: GLOBAL_XP_PLAYER_DATA_SCHEMA_VERSION,
      lastAcceptedResultReward: legacyReward,
    }
    const legacyCurrent = {
      ...accepted,
      lastAcceptedResultReward: legacyReward,
    }
    const canonical = canonicalPlayerData(
      legacyCurrent,
      GLOBAL_XP_PLAYER_DATA_SCHEMA_VERSION,
    )
    const decoded = await decodeMapachessPortableBackup(
      JSON.stringify({
        applicationVersion: "legacy",
        gddRevision: "v4.8",
        format: "mapachess-portable-backup",
        formatVersion: 1,
        saveSchemaVersion: 8,
        payload,
        integrity: {
          algorithm: "SHA-256",
          payloadHash: await sha256(canonical),
        },
      }),
      sha256,
    )
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("Authenticated v8 must import")
    const reopened = replaceActiveMatch(decoded.backup.payload, opened(win))
    const ended = replaceActiveMatch(reopened, {
      ...opened(win),
      conclusion: { type: "resignation", winner: "white" },
    })
    expect(ended.totalXp).toBe(accepted.totalXp)
    expect(ended.ratings).toEqual(accepted.ratings)
    expect(ended.ratedMatchCounts).toEqual(accepted.ratedMatchCounts)
    expect(ended.lastAcceptedResultReward).toBeNull()
  })

  it("rejects inconsistent reversal facts rather than subtracting a guessed contribution", () => {
    const win = {
      ...completedStoryMatch(),
      opponentTargetElo: 200,
      ratedOpponentElo: 200,
    }
    const accepted = replaceActiveMatch(
      replaceActiveMatch(createInitialMapachessPlayerData(), opened(win)),
      win,
    )
    expect(
      decodeMapachessPlayerDataWithSource({
        ...accepted,
        ratedMatchCounts: { ...accepted.ratedMatchCounts, standard: 5 },
      }).ok,
    ).toBe(false)
    expect(
      decodeMapachessPlayerDataWithSource({
        ...accepted,
        ratings: { ...accepted.ratings, standard: 999 },
      }).ok,
    ).toBe(false)
    expect(() =>
      replaceActiveMatch({ ...accepted, totalXp: 12 }, opened(win)),
    ).toThrow("accepted receipt")
  })
})
