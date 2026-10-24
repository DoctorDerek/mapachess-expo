import { describe, expect, it, vi } from "vitest"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import {
  advanceMatchClock,
  createMatchClock,
  durableMatchClock,
} from "@mapachess/match/match-clock"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import type { TimeCategory, TimeControl } from "@mapachess/match/time-control"
import SerializedPlayerDataStore, {
  EMPTY_DURABLE_STORE_SNAPSHOT,
} from "../src/durableStore.js"
import { completedMatchXpAward } from "../src/globalXp.js"
import createInitialMapachessPlayerData, {
  type MapachessPlayerData,
} from "../src/playerData.js"
import {
  canonicalPlayerData,
  decodeMapachessPlayerDataWithSource,
} from "../src/playerDataCodec.js"
import {
  createMapachessPortableBackup,
  decodeMapachessPortableBackup,
} from "../src/portableBackup.js"
import {
  changePlayerAppearance,
  replaceActiveMatch,
  resetPlayerElo,
} from "../src/profileMutations.js"
import {
  PLAYER_RATING_CONTEXTS,
  playerRatingId,
  ratingValues,
  startingPlayerElos,
} from "../src/ratingContext.js"
import {
  decodeStoredPlayerData,
  encodeStoredPlayerData,
} from "../src/storedPlayerData.js"
import {
  InMemoryDurableStoreAdapter,
  sha256,
  withoutAssistanceRatings,
} from "./profileTestSupport.js"
import completedStoryMatch from "./storyProgressTestSupport.js"

const controls: Readonly<Record<TimeCategory, TimeControl>> = {
  untimed: { type: "untimed" },
  bullet: { type: "fischer", baseSeconds: 60, incrementSeconds: 0 },
  blitz: { type: "fischer", baseSeconds: 180, incrementSeconds: 2 },
  rapid: { type: "fischer", baseSeconds: 600, incrementSeconds: 0 },
}

const opened = (match: DurableMatchRecord): DurableMatchRecord => ({
  ...match,
  conclusion: null,
  cursor: 0,
  currentFen: createInitialMatchPosition(match.startingPosition).fen,
  ...(match.timeControl.type === "untimed"
    ? {}
    : {
        clock: {
          ...match.clock!,
          activeColor: "white",
          remainingMs: match.clock!.history[0]!,
          paused: true,
        },
      }),
})

const requireProfile = (received: unknown): MapachessPlayerData => {
  const decoded = decodeMapachessPlayerDataWithSource(received)
  if (!decoded.ok) throw new Error(JSON.stringify(decoded.issue))
  return decoded.data
}

function completedContext(
  context: (typeof PLAYER_RATING_CONTEXTS)[number],
  mode: "story" | "challenge",
  outcome: "win" | "draw" | "loss",
): DurableMatchRecord {
  const fixture = completedStoryMatch(context.variant)
  const control = controls[context.category]
  let clock = createMatchClock(control, "white")
  if (outcome === "win") {
    for (let ply = 1; ply <= fixture.cursor; ply++) {
      clock = advanceMatchClock(
        clock,
        control,
        ply,
        ply % 2 === 0 ? "white" : "black",
      )
    }
  }
  return {
    ...fixture,
    ...(outcome === "win"
      ? {}
      : {
          cursor: 0,
          moveIds: [],
          currentFen: createInitialMatchPosition(fixture.startingPosition).fen,
          conclusion:
            outcome === "draw"
              ? { type: "draw-agreement" }
              : { type: "resignation", winner: "white" },
        }),
    mode,
    timeControl: control,
    clock: durableMatchClock(clock),
    pieceHintsUsed: context.assistance !== "gold",
    moveHintsUsed: context.assistance === "bronze",
    opponentTargetElo: 300,
    ratedOpponentElo: 300,
    playerElosAtStart: { gold: 600, silver: 600, bronze: 600 },
  }
}

describe("24 assistance rating contexts", () => {
  it.each(PLAYER_RATING_CONTEXTS)(
    "routes $id results once and reverses only their exact balances",
    (context) => {
      for (const mode of ["story", "challenge"] as const) {
        for (const outcome of ["win", "draw", "loss"] as const) {
          const ending = completedContext(context, mode, outcome)
          const initial = {
            ...createInitialMapachessPlayerData(),
            ratings: ratingValues(() => 600),
          }
          const start = replaceActiveMatch(initial, opened(ending))
          const accepted = requireProfile(replaceActiveMatch(start, ending))
          expect(accepted.ratedMatchCounts[context.id]).toBe(1)
          expect(accepted.ratings[context.id]).not.toBe(600)
          expect(accepted.lastAcceptedResultReward?.ratedElo).toMatchObject({
            variant: context.variant,
            assistance: context.assistance,
          })
          for (const other of PLAYER_RATING_CONTEXTS.filter(
            ({ id }) => id !== context.id,
          )) {
            expect(accepted.ratings[other.id]).toBe(600)
            expect(accepted.ratedMatchCounts[other.id]).toBe(0)
          }
          expect(replaceActiveMatch(accepted, ending)).toMatchObject({
            ratings: accepted.ratings,
            totalXp: accepted.totalXp,
            ratedMatchCounts: accepted.ratedMatchCounts,
          })
          const undone = requireProfile(
            replaceActiveMatch(accepted, opened(ending)),
          )
          expect(undone.ratings).toEqual(initial.ratings)
          expect(undone.ratedMatchCounts).toEqual(initial.ratedMatchCounts)
          expect(undone.totalXp).toBe(0)
          expect(undone.storyProgress).toEqual(accepted.storyProgress)
          const redone = requireProfile(replaceActiveMatch(undone, ending))
          expect(redone).toMatchObject({
            ratings: accepted.ratings,
            ratedMatchCounts: accepted.ratedMatchCounts,
            totalXp: accepted.totalXp,
            challengeHistory: accepted.challengeHistory,
          })
        }
      }
    },
  )

  it("keeps the original receipt valid when Undo is followed by stronger hints and a different XP reference", async () => {
    const initial = createInitialMapachessPlayerData()
    const ratings = {
      ...initial.ratings,
      "standard-untimed-silver": 400,
      "standard-untimed-bronze": 500,
    }
    const snapshots = startingPlayerElos(ratings, "standard", "untimed")
    const win = {
      ...completedStoryMatch(),
      ratedOpponentElo: 300,
      opponentTargetElo: 300,
      playerElosAtStart: snapshots,
    }
    const accepted = replaceActiveMatch(
      replaceActiveMatch({ ...initial, ratings }, opened(win)),
      win,
    )
    expect(accepted.totalXp).toBe(8)
    const hinted = { ...opened(win), pieceHintsUsed: true, moveHintsUsed: true }
    const reopened = requireProfile(replaceActiveMatch(accepted, hinted))
    expect(reopened.lastAcceptedResultReward?.contribution?.assistance).toBe(
      "gold",
    )
    const reload = await decodeStoredPlayerData(
      await encodeStoredPlayerData(reopened, sha256),
      sha256,
    )
    if (!reload.ok) throw new Error("Reopened result must reload")
    const bronzeWin = { ...win, pieceHintsUsed: true, moveHintsUsed: true }
    const replaced = requireProfile(replaceActiveMatch(reload.data, bronzeWin))
    expect(replaced.totalXp).toBe(4)
    expect(replaced.ratedMatchCounts["standard-untimed-gold"]).toBe(0)
    expect(replaced.ratedMatchCounts["standard-untimed-bronze"]).toBe(1)
    expect(replaced.storyProgress.standard[0]?.highestMedal).toBe("gold")
    expect(replaced.activeMatch?.playerElosAtStart).toEqual(snapshots)
    const again = replaceActiveMatch(
      replaceActiveMatch(replaced, hinted),
      bronzeWin,
    )
    expect(again).toMatchObject({
      totalXp: 4,
      ratings: replaced.ratings,
      ratedMatchCounts: replaced.ratedMatchCounts,
    })
    expect(
      decodeMapachessPlayerDataWithSource({ ...replaced, activeMatch: win }).ok,
    ).toBe(false)
  })

  it("does not let resetting Gold suppress a later Bronze result or change its frozen XP baseline", () => {
    const win = {
      ...completedStoryMatch(),
      ratedOpponentElo: 300,
      opponentTargetElo: 300,
      playerElosAtStart: { gold: 100, silver: 400, bronze: 500 },
    }
    const accepted = replaceActiveMatch(
      replaceActiveMatch(createInitialMapachessPlayerData(), opened(win)),
      win,
    )
    const reset = resetPlayerElo(accepted, "standard-untimed-gold")
    const replay = replaceActiveMatch(
      replaceActiveMatch(reset, opened(win)),
      win,
    )
    expect(replay.ratedMatchCounts["standard-untimed-gold"]).toBe(0)
    const hinted = { ...opened(win), pieceHintsUsed: true, moveHintsUsed: true }
    const replaced = requireProfile(
      replaceActiveMatch(replaceActiveMatch(replay, hinted), {
        ...win,
        pieceHintsUsed: true,
        moveHintsUsed: true,
      }),
    )
    expect(replaced.ratedMatchCounts["standard-untimed-bronze"]).toBe(1)
    expect(replaced.totalXp).toBe(4)
  })
})

describe("24-rating cutover and portable preferences", () => {
  const legacyPayload = (data: MapachessPlayerData) => ({
    ...withoutAssistanceRatings(data),
    schemaVersion: 17,
  })

  it.each(["complete", "unfinished", "undone"] as const)(
    "resets old balances without losing %s match progress or resurrecting retired Elo",
    async (state) => {
      const initial = createInitialMapachessPlayerData()
      const win = {
        ...completedStoryMatch(),
        playerEloAtStart: 450,
        ratedOpponentElo: 550,
        opponentTargetElo: 550,
      }
      const start = replaceActiveMatch(
        {
          ...initial,
          ratings: ratingValues(() => 450),
          ratedMatchCounts: ratingValues(() => 12),
        },
        opened(win),
      )
      const complete = replaceActiveMatch(start, win)
      const source = requireProfile(
        state === "complete"
          ? complete
          : state === "unfinished"
            ? start
            : replaceActiveMatch(complete, opened(win)),
      )
      const payload = legacyPayload(source)
      const canonical = canonicalPlayerData(
        {
          ...source,
          ratings: payload.ratings,
          ratedMatchCounts: payload.ratedMatchCounts,
          lastAcceptedResultReward: payload.lastAcceptedResultReward,
        },
        17,
      )
      const raw = JSON.stringify({
        format: "mapachess-stored-player-data",
        formatVersion: 1,
        saveSchemaVersion: 17,
        payload,
        integrity: {
          algorithm: "SHA-256",
          payloadHash: await sha256(canonical),
        },
      })
      const decoded = await decodeStoredPlayerData(raw, sha256)
      if (!decoded.ok) throw new Error(JSON.stringify(decoded.issue))
      const migrated = decoded.data
      expect(migrated.ratings).toEqual(initial.ratings)
      expect(migrated.ratedMatchCounts).toEqual(initial.ratedMatchCounts)
      expect(migrated).toMatchObject({
        activeMatch: source.activeMatch,
        storyProgress: source.storyProgress,
        totalXp: source.totalXp,
        unlockedAchievementIds: source.unlockedAchievementIds,
        appearance: source.appearance,
      })
      expect(migrated.activeMatch?.playerElosAtStart).toBeUndefined()
      expect(
        completedMatchXpAward({
          ...win,
          pieceHintsUsed: true,
          moveHintsUsed: true,
        }),
      ).toBe(8)
      const reopened = replaceActiveMatch(migrated, {
        ...opened(win),
        pieceHintsUsed: true,
        moveHintsUsed: true,
      })
      const redone = requireProfile(
        replaceActiveMatch(reopened, {
          ...win,
          pieceHintsUsed: true,
          moveHintsUsed: true,
        }),
      )
      expect(redone.ratedMatchCounts["standard-untimed-bronze"]).toBe(
        state === "complete" ? 0 : 1,
      )
      expect(redone.totalXp).toBe(8)
      expect(
        await decodeStoredPlayerData(
          await encodeStoredPlayerData(redone, sha256),
          sha256,
        ),
      ).toEqual({ ok: true, data: redone })
      const tampered = {
        ...payload,
        ratings: { ...payload.ratings, standard: 451 },
      }
      expect(
        await decodeStoredPlayerData(
          JSON.stringify({
            format: "mapachess-stored-player-data",
            formatVersion: 1,
            saveSchemaVersion: 17,
            payload: tampered,
            integrity: {
              algorithm: "SHA-256",
              payloadHash: await sha256(canonical),
            },
          }),
          sha256,
        ),
      ).toMatchObject({ ok: false })
    },
  )

  it("preserves old raw bytes when saving the migration fails, then retries without resetting future ratings", async () => {
    const initial = {
      ...createInitialMapachessPlayerData(),
      ratings: ratingValues(() => 450),
    }
    const payload = legacyPayload(initial)
    const decoded = decodeMapachessPlayerDataWithSource(payload)
    if (!decoded.ok) throw new Error("Legacy fixture must decode")
    const raw = JSON.stringify({
      format: "mapachess-stored-player-data",
      formatVersion: 1,
      saveSchemaVersion: 17,
      payload,
      integrity: {
        algorithm: "SHA-256",
        payloadHash: await sha256(decoded.source.canonical),
      },
    })
    const adapter = new InMemoryDurableStoreAdapter({
      ...EMPTY_DURABLE_STORE_SNAPSHOT,
      current: raw,
    })
    const reject = vi
      .spyOn(adapter, "compareAndSwapVerified")
      .mockRejectedValueOnce(new Error("Storage unavailable"))
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const loaded = await store.load()
    if (loaded.current.type !== "valid")
      throw new Error("Legacy data must load")
    const candidate = { ...loaded.current.data, revision: 1 }
    await expect(store.commitCurrent(loaded, candidate)).rejects.toThrow(
      "Storage unavailable",
    )
    expect(adapter.snapshot.current).toBe(raw)
    reject.mockRestore()
    expect((await store.commitCurrent(loaded, candidate)).ok).toBe(true)
    expect(adapter.snapshot.lastKnownGood).toBe(raw)
    const win = {
      ...completedStoryMatch(),
      ratedOpponentElo: 300,
      opponentTargetElo: 300,
    }
    const accepted = replaceActiveMatch(
      replaceActiveMatch(candidate, opened(win)),
      win,
    )
    const saved = await store.commitCurrent(await store.load(), {
      ...accepted,
      revision: 2,
    })
    expect(saved.ok).toBe(true)
    const reloaded = await store.load()
    expect(reloaded.current).toMatchObject({
      type: "valid",
      data: {
        ratings: accepted.ratings,
        ratedMatchCounts: accepted.ratedMatchCounts,
      },
    })
  })

  it("round-trips all 24 balances and the card selection through saves, backups and unrelated resets", async () => {
    const initial = createInitialMapachessPlayerData()
    const changed = changePlayerAppearance(
      {
        ...initial,
        ratings: ratingValues(
          (id) =>
            200 +
            PLAYER_RATING_CONTEXTS.findIndex((context) => context.id === id),
        ),
        ratedMatchCounts: ratingValues(() => 7),
      },
      initial.appearance,
      { category: "blitz", assistance: "silver" },
    )
    expect(
      await decodeStoredPlayerData(
        await encodeStoredPlayerData(changed, sha256),
        sha256,
      ),
    ).toEqual({ ok: true, data: changed })
    const backup = await createMapachessPortableBackup({
      playerData: changed,
      applicationVersion: "test",
      gddRevision: "5.2",
      sha256,
    })
    expect(await decodeMapachessPortableBackup(backup, sha256)).toMatchObject({
      ok: true,
      backup: { payload: changed },
    })
    expect(
      resetPlayerElo(changed, playerRatingId("standard", "blitz", "silver"))
        .settings.cardRatingContext,
    ).toEqual(changed.settings.cardRatingContext)
    expect(
      decodeMapachessPlayerDataWithSource({
        ...changed,
        settings: {
          ...changed.settings,
          cardRatingContext: { category: "all", assistance: "silver" },
        },
      }).ok,
    ).toBe(false)
  })

  it("rejects malformed source balances and incomplete starting snapshots instead of silently resetting them", () => {
    const initial = createInitialMapachessPlayerData()
    const payload = legacyPayload(initial)
    for (const value of [-1, "400", null, undefined]) {
      expect(
        decodeMapachessPlayerDataWithSource({
          ...payload,
          ratings: { ...payload.ratings, standard: value },
        }).ok,
      ).toBe(false)
      expect(
        decodeMapachessPlayerDataWithSource({
          ...payload,
          ratedMatchCounts: { ...payload.ratedMatchCounts, standard: value },
        }).ok,
      ).toBe(false)
    }
    const match = opened(completedStoryMatch())
    expect(
      decodeMapachessPlayerDataWithSource({
        ...initial,
        activeMatch: {
          ...match,
          playerElosAtStart: { gold: 100, bronze: 100 },
        },
      }).ok,
    ).toBe(false)
    expect(
      decodeMapachessPlayerDataWithSource({
        ...payload,
        activeMatch: {
          ...match,
          playerElosAtStart: { gold: 100, silver: 100, bronze: 100 },
        },
      }).ok,
    ).toBe(false)
  })
})
