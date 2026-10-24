import { afterEach, describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import {
  createMatchClock,
  durableMatchClock,
} from "@mapachess/match/match-clock"
import matchMachine from "@mapachess/match/match-machine"
import {
  listLegalMatchMoves,
  type MatchMoveId,
} from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import type { MatchVariant } from "@mapachess/match/match-variant"
import { PLAYER_INPUT_ACTIONS } from "@mapachess/match/player-input"
import { timeCategory, type TimeControl } from "@mapachess/match/time-control"
import SerializedPlayerDataStore from "../src/durableStore.js"
import createInitialMapachessPlayerData from "../src/playerData.js"
import { decodeMapachessPlayerDataWithSource } from "../src/playerDataCodec.js"
import {
  createMapachessPortableBackup,
  decodeMapachessPortableBackup,
} from "../src/portableBackup.js"
import profileMachine, {
  selectCurrentPlayerData,
} from "../src/profileMachine.js"
import ProfileMatchPersistenceBridge from "../src/profileMatchPersistence.js"
import { playerRatingId } from "../src/ratingContext.js"
import { decodeStoredPlayerData } from "../src/storedPlayerData.js"
import {
  InMemoryDurableStoreAdapter,
  sha256,
  withoutMoveReactionPlacement,
} from "./profileTestSupport.js"
import completedStoryMatch from "./storyProgressTestSupport.js"

const cleanup: (() => void)[] = []
afterEach(() => {
  for (const close of cleanup.splice(0).reverse()) close()
})
const controls: readonly TimeControl[] = [
  { type: "fischer", baseSeconds: 60, incrementSeconds: 0 },
  { type: "fischer", baseSeconds: 180, incrementSeconds: 2 },
]

async function openTimed(variant: MatchVariant, control: TimeControl) {
  const fixture = completedStoryMatch(variant)
  const position = createInitialMatchPosition(fixture.startingPosition)
  const initialMatch = {
    ...fixture,
    timeControl: control,
    clock: durableMatchClock(createMatchClock(control, position.turn)),
    conclusion: null,
    moveIds: [],
    cursor: 0,
    currentFen: position.fen,
    opponentTargetElo: 300,
    ratedOpponentElo: 300,
  }
  const store = new SerializedPlayerDataStore(
    new InMemoryDurableStoreAdapter(),
    sha256,
  )
  const initial = createInitialMapachessPlayerData()
  const saved = await store.commitCurrent(await store.load(), {
    ...initial,
    ratings: {
      ...initial.ratings,
      "standard-untimed-gold": 445.212,
      "chess960-untimed-gold": 612.75,
    },
    ratedMatchCounts: {
      ...initial.ratedMatchCounts,
      "standard-untimed-gold": 17,
      "chess960-untimed-gold": 9,
    },
  })
  if (!saved.ok) throw new Error("Fixture profile must save")
  const profile = createActor(profileMachine, {
    input: {
      store,
      decodePortableBackup: (raw) => decodeMapachessPortableBackup(raw, sha256),
    },
  }).start()
  cleanup.push(() => profile.stop())
  await waitFor(profile, (snapshot) => snapshot.matches("ready"))
  const bridge = new ProfileMatchPersistenceBridge({
    actor: profile,
    expectedActiveMatch: null,
    initialMatch,
  })
  await bridge.establish(new AbortController().signal)
  let now = 0
  let respond: ((move: MatchMoveId) => void) | undefined
  const match = createActor(matchMachine, {
    input: {
      matchId: initialMatch.matchId,
      initialPosition: position,
      playerColor: "black",
      autoHintMode: "no-auto-hints",
      timeControl: control,
      monotonicClock: { now: () => now },
      durability: { type: "durable", persistence: bridge },
      opponent: {
        selectMove: () =>
          new Promise<MatchMoveId>((resolve) => {
            respond = resolve
          }),
      },
    },
  }).start()
  cleanup.push(() => match.stop())
  const data = () => {
    const value = selectCurrentPlayerData(profile.getSnapshot())
    if (value === null) throw new Error("Fixture lost its profile")
    return value
  }
  return {
    profile,
    match,
    data,
    setTime: (value: number) => {
      now = value
    },
    reply: () => {
      const move = listLegalMatchMoves(position).find(
        ({ uci }) => uci === "e2e4",
      )
      if (move === undefined) throw new Error("Fixture move must exist")
      respond?.(move.id)
    },
  }
}

describe("durable timed results and rating migration", () => {
  it.each(["standard", "chess960"] as const)(
    "reverses and restores a no-move timeout exactly in %s",
    async (variant) => {
      for (const control of controls) {
        const game = await openTimed(variant, control)
        const before = game.data()
        const id = playerRatingId(variant, timeCategory(control), "gold")
        game.setTime(
          control.type === "fischer" ? control.baseSeconds * 1000 : 0,
        )
        game.match.send({ type: "MATCH.CLOCK_EXPIRED" })
        await waitFor(game.match, (s) => s.matches("complete"))
        const accepted = game.data()
        expect(accepted.activeMatch?.cursor).toBe(0)
        expect(accepted.activeMatch?.conclusion).toEqual({
          type: "timeout",
          winner: "black",
        })
        expect(accepted.ratedMatchCounts[id]).toBe(1)
        expect(accepted.ratings[id]).toBeGreaterThan(100)
        expect(accepted.ratings["standard-untimed-gold"]).toBe(445.212)
        expect(accepted.ratings["chess960-untimed-gold"]).toBe(612.75)
        expect(accepted.totalXp).toBe(8)
        expect(accepted.storyProgress[variant]).toEqual([
          { opponentId: "chicken-stockfish", highestMedal: "gold" },
        ])
        expect(accepted.lastAcceptedResultReward?.ratedElo?.timeCategory).toBe(
          timeCategory(control),
        )
        game.match.send({ type: "MATCH.UNDO_REQUESTED" })
        await waitFor(game.match, (s) => s.matches("paused"))
        expect(game.data().ratings).toEqual(before.ratings)
        expect(game.data().ratedMatchCounts).toEqual(before.ratedMatchCounts)
        expect(game.data().totalXp).toBe(0)
        expect(game.data().unlockedAchievementIds).toEqual(
          accepted.unlockedAchievementIds,
        )
        const backup = await createMapachessPortableBackup({
          playerData: game.data(),
          sha256,
          applicationVersion: "test",
          gddRevision: "5.2",
        })
        const imported = await decodeMapachessPortableBackup(backup, sha256)
        expect(imported).toMatchObject({
          ok: true,
          backup: { payload: game.data() },
        })
        game.match.send({ type: "MATCH.REDO_REQUESTED" })
        await waitFor(game.match, (s) => s.matches("complete"))
        expect(game.data().ratings).toEqual(accepted.ratings)
        expect(game.data().ratedMatchCounts).toEqual(accepted.ratedMatchCounts)
        expect(game.data().totalXp).toBe(8)
        game.match.send({ type: "MATCH.UNDO_REQUESTED" })
        await waitFor(game.match, (s) => s.matches("paused"))
        game.match.send({ type: "MATCH.CLOCK_RESUME_REQUESTED" })
        game.reply()
        await waitFor(game.match, (s) => s.matches("playerTurn"))
        expect(decodeMapachessPlayerDataWithSource(game.data())).toMatchObject({
          ok: true,
        })
        game.match.send({ type: "MATCH.RESIGN_REQUESTED" })
        await waitFor(game.match, (s) => s.matches("complete"))
        expect(game.data().totalXp).toBe(4)
        expect(game.data().ratedMatchCounts[id]).toBe(1)
        expect(game.data().ratings[id]).toBe(100)
        expect(decodeMapachessPlayerDataWithSource(game.data())).toMatchObject({
          ok: true,
        })
        game.match.stop()
      }
    },
  )

  it("preserves separate-context resets and never resurrects a reset timed result", async () => {
    const control = controls[0]
    if (control === undefined) throw new Error("Fixture control missing")
    const game = await openTimed("standard", control)
    game.setTime(60_000)
    game.match.send({ type: "MATCH.CLOCK_EXPIRED" })
    await waitFor(game.match, (s) => s.matches("complete"))
    game.profile.send({
      type: "PROFILE.ELO_RESET_CONFIRMED",
      variant: "standard-blitz-gold",
    })
    await waitFor(game.profile, (s) => s.matches("ready"))
    expect(game.data().lastAcceptedResultReward?.ratedElo).not.toBeNull()
    game.profile.send({
      type: "PROFILE.ELO_RESET_CONFIRMED",
      variant: "standard-bullet-gold",
    })
    await waitFor(game.profile, (s) => s.matches("ready"))
    game.match.send({ type: "MATCH.UNDO_REQUESTED" })
    await waitFor(game.match, (s) => s.matches("paused"))
    game.match.send({ type: "MATCH.REDO_REQUESTED" })
    await waitFor(game.match, (s) => s.matches("complete"))
    expect(game.data().ratings["standard-bullet-gold"]).toBe(100)
    expect(game.data().ratedMatchCounts["standard-bullet-gold"]).toBe(0)
    expect(game.data().ratings["standard-untimed-gold"]).toBe(445.212)
    expect(decodeMapachessPlayerDataWithSource(game.data())).toMatchObject({
      ok: true,
    })
  })

  it("authenticates the exact schema15 two-rating preimage before initializing 24 contexts", async () => {
    const current = createInitialMapachessPlayerData()
    const payload = {
      ...withoutMoveReactionPlacement(current),
      schemaVersion: 15,
      ratings: { standard: 445.212, chess960: 612.75 },
      ratedMatchCounts: { standard: 17, chess960: 9 },
    }
    const canonical = JSON.stringify([
      "mapachess-player-data",
      15,
      0,
      "auto-move-hints",
      [445.212, 612.75],
      null,
      ["standard", "white", null, "chicken-stockfish", 100],
      [[], []],
      [
        [[], []],
        [[], []],
      ],
      [100, 100, 100, 100],
      [17, 9],
      [],
      0,
      [],
      null,
      current.appearance,
      ["current", "current"],
      "mapachito",
      PLAYER_INPUT_ACTIONS.map((action) => [
        current.settings.inputBindings.controller[action],
        current.settings.inputBindings.keyboard[action],
      ]),
      false,
      null,
    ])
    const decoded = decodeMapachessPlayerDataWithSource(payload)
    expect(decoded).toMatchObject({ ok: true, source: { canonical } })
    if (!decoded.ok) throw new Error("Legacy profile must decode")
    expect(decoded.data.ratings).toEqual(current.ratings)
    expect(decoded.data.ratedMatchCounts).toEqual(current.ratedMatchCounts)
    const envelope = {
      format: "mapachess-stored-player-data",
      formatVersion: 1,
      saveSchemaVersion: 15,
      payload,
      integrity: { algorithm: "SHA-256", payloadHash: await sha256(canonical) },
    }
    expect(
      await decodeStoredPlayerData(JSON.stringify(envelope), sha256),
    ).toEqual({ ok: true, data: decoded.data })
    expect(
      await decodeMapachessPortableBackup(
        JSON.stringify({
          ...envelope,
          format: "mapachess-portable-backup",
          applicationVersion: "test",
          gddRevision: "5.2",
        }),
        sha256,
      ),
    ).toMatchObject({ ok: true, backup: { payload: decoded.data } })
  })

  it("rejects corrupt clocks without accepting a partial timed profile", async () => {
    const game = await openTimed("standard", controls[0]!)
    const data = game.data()
    const match = data.activeMatch
    if (match?.clock == null) throw new Error("Timed fixture needs a clock")
    const corruptions = [
      null,
      { ...match.clock, activeColor: "black" },
      { ...match.clock, remainingMs: { white: -1, black: 60_000 } },
      { ...match.clock, history: [] },
      { ...match.clock, startedAt: 1 },
    ]
    for (const clock of corruptions)
      expect(
        decodeMapachessPlayerDataWithSource({
          ...data,
          activeMatch: { ...match, clock },
        }).ok,
      ).toBe(false)
    expect(
      decodeMapachessPlayerDataWithSource({
        ...data,
        activeMatch: {
          ...match,
          retainedConclusion: {
            cursor: 0,
            conclusion: { type: "timeout", winner: "white" },
          },
        },
      }).ok,
    ).toBe(false)
    expect(
      decodeMapachessPlayerDataWithSource({
        ...withoutMoveReactionPlacement(data),
        schemaVersion: 15,
        ratings: { standard: 100, chess960: 100 },
        ratedMatchCounts: { standard: 0, chess960: 0 },
      }).ok,
    ).toBe(false)
  })
})
