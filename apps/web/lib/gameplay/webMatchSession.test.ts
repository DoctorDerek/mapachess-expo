import { webcrypto } from "node:crypto"
import { IDBFactory, IDBObjectStore } from "fake-indexeddb"
import { describe, expect, it, vi, type TestContext } from "vitest"
import { waitFor } from "xstate"
import { buildFreshMatch as buildFreshWebMatch } from "@mapachess/gameplay/durable-match"
import {
  createMatchId,
  selectStoryPlayerColor,
} from "@mapachess/gameplay/match-identity"
import {
  DEFAULT_CHALLENGE_SETUP,
  type ChallengeSetup,
} from "@mapachess/match/challenge-setup"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import {
  IMPLEMENTED_DURABLE_OPPONENT_IDS,
  type DurableMatchRecord,
  type ImplementedDurableOpponentId,
} from "@mapachess/match/durable-match-record"
import { durableMatchClock } from "@mapachess/match/match-clock"
import { deriveRetainedBranchConclusion } from "@mapachess/match/match-conclusion"
import {
  selectMatchPosition,
  selectMatchTimeline,
} from "@mapachess/match/match-machine"
import { parseMatchMoveId } from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  type MatchStartingPosition,
} from "@mapachess/match/match-position"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  currentMatchPosition,
} from "@mapachess/match/match-timeline"
import { TIME_CONTROL_PRESETS } from "@mapachess/match/time-control"
import SerializedPlayerDataStore from "@mapachess/profile/durable-store"
import { MATCH_MEDALS } from "@mapachess/profile/match-medal"
import createInitialMapachessPlayerData from "@mapachess/profile/player-data"
import {
  selectCurrentPlayerData,
  selectPendingPlayerData,
  selectPersistenceFailure,
} from "@mapachess/profile/profile-machine"
import { persistProfileActiveMatch } from "@mapachess/profile/profile-match-persistence"
import { playerRatingId } from "@mapachess/profile/rating-context"
import {
  selectDefaultStoryOpponent,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import IndexedDbDurableStore from "../profile/IndexedDbDurableStore"
import openWebProfileRuntime, {
  type WebProfileRuntime,
} from "../profile/openWebProfileRuntime"
import webSha256 from "../profile/webSha256"
import type { OpenWebMatchRuntimeInput } from "./openWebMatchRuntime"
import type { WebMatchRuntime } from "./webMatchRuntime"
import {
  openCurrentWebMatchSession,
  openFreshWebMatchSession,
  returnWebMatchSessionToMenu,
} from "./webMatchSession"
import resolveWebOpponentPolicy, {
  resolveWebChallengePolicy,
} from "./webOpponentPolicy"

const FIRST_MATCH_SEED = "00000001000000020000000300000004"
const SECOND_MATCH_SEED = "00000005000000060000000700000008"

const openProfileRuntime = async (
  chess960StoryElo?: number,
  indexedDb = new IDBFactory(),
  storyProgress?: StoryProgress,
) => {
  if (chess960StoryElo !== undefined || storyProgress !== undefined) {
    const adapter = new IndexedDbDurableStore(indexedDb)
    const store = new SerializedPlayerDataStore(adapter, (value) =>
      webSha256(value, webcrypto.subtle),
    )
    const initial = createInitialMapachessPlayerData()
    const saved = await store.commitCurrent(await store.load(), {
      ...initial,
      storyProgress: storyProgress ?? initial.storyProgress,
      ratings: {
        ...initial.ratings,
        "standard-untimed-gold": 600,
        "chess960-untimed-gold":
          chess960StoryElo ?? initial.ratings["chess960-untimed-gold"],
      },
    })
    if (!saved.ok) throw new Error("Initial rating fixture must persist")
    await adapter.close()
  }
  const runtime = openWebProfileRuntime({
    indexedDb,
    subtleCrypto: webcrypto.subtle,
  })
  await waitFor(runtime.actor, (snapshot) => snapshot.matches("ready"))
  return runtime
}

const createRuntime = (
  seed: string,
  startingPosition: MatchStartingPosition = {
    variant: "standard",
    chess960PositionId: null,
  },
  selection: NonNullable<Parameters<typeof createMatchId>[2]> = {
    mode: "story",
  },
  policyFingerprint = "session-test-policy",
  opponentId: ImplementedDurableOpponentId = "chicken-stockfish",
  opponentTargetElo = 100,
) => {
  const matchSeed = parseDeterministicRandomSeed(seed, "session test seed")
  const close = vi.fn(async () => undefined)
  const runtime = Object.freeze({
    close,
    engineIdentity: Object.freeze({
      author: "Session test",
      name: "Session test engine",
      optionNames: Object.freeze([]),
    }),
    hintAnalyst: Object.freeze({
      analyze: vi.fn(async () => {
        throw new Error("Session ownership tests do not request hints.")
      }),
    }),
    matchId: createMatchId(matchSeed, startingPosition, selection, opponentId),
    matchSeed,
    opponent: Object.freeze({
      selectMove: vi.fn(async (request) => {
        const move = request.legalMoves[0]
        if (move === undefined) {
          throw new Error("Session ownership test received no legal move.")
        }
        return move.id
      }),
    }),
    opponentPolicyFingerprint: policyFingerprint,
    opponentTargetElo,
    ratedOpponentElo: opponentTargetElo,
    opponentId,
    playerColor:
      selection.mode === "challenge"
        ? selection.playerColor
        : selectStoryPlayerColor(matchSeed),
    startingPosition,
    positionEvaluator: vi.fn(async (request) =>
      Object.freeze({
        evaluation: Object.freeze({ kind: "draw" as const }),
        positionFen: request.position.fen,
        requestId: request.requestId,
      }),
    ),
  }) satisfies WebMatchRuntime

  return { close, runtime }
}

const runtimeOpener = (runtime: WebMatchRuntime) =>
  vi.fn(async (_input?: OpenWebMatchRuntimeInput) => runtime)

async function savePlayedBulletMatch(
  profile: WebProfileRuntime,
  runtime: WebMatchRuntime,
  ratingMetadata: "missing" | "recorded",
) {
  const bullet = TIME_CONTROL_PRESETS.find(({ id }) => id === "1+0")
  if (bullet === undefined) throw new Error("The test requires Bullet 1+0.")
  const fresh = {
    ...buildFreshWebMatch({
      autoHintMode: "no-auto-hints",
      playerEloAtStart: 100,
      runtime,
      timeControl: bullet.control,
    }),
  }
  if (ratingMetadata === "missing") delete fresh.ratedOpponentElo
  if (fresh.clock == null) throw new Error("The test requires timed clocks.")

  let timeline = createMatchTimeline(
    createInitialMatchPosition(fresh.startingPosition),
  )
  for (const uci of ["e2e4", "e7e5"]) {
    const parsed = parseMatchMoveId(uci)
    if (!parsed.ok) throw new Error("The fixture move must parse.")
    const played = applyMatchTimelineMove(timeline, parsed.moveId)
    if (!played.ok) throw new Error("The fixture move must be legal.")
    timeline = played.timeline
  }
  const position = currentMatchPosition(timeline)
  const afterWhite = { ...fresh.clock.remainingMs, white: 52_000 }
  const afterBlack = { ...afterWhite, black: 54_000 }
  const candidate = {
    ...fresh,
    currentFen: position.fen,
    cursor: timeline.cursor,
    moveIds: timeline.transitions.map(({ move }) => move.id),
    clock: durableMatchClock({
      activeColor: position.turn,
      history: [...fresh.clock.history, afterWhite, afterBlack],
      remainingMs: afterBlack,
      paused: true,
      startedAt: null,
    }),
  } satisfies DurableMatchRecord
  await persistProfileActiveMatch({
    actor: profile.actor,
    candidate,
    expectedActiveMatch: null,
    signal: new AbortController().signal,
  })
  const saved = selectCurrentPlayerData(profile.actor.getSnapshot())
  if (saved === null || saved.activeMatch === null)
    throw new Error("The played fixture must be saved.")
  return { playerData: saved, match: saved.activeMatch }
}

async function interruptResumeWrite(
  onTestFinished: TestContext["onTestFinished"],
) {
  const indexedDb = new IDBFactory()
  const profile = await openProfileRuntime(undefined, indexedDb)
  const storage = new IndexedDbDurableStore(indexedDb)
  onTestFinished(async () => {
    await profile.close()
    await storage.close()
  })
  const engine = createRuntime(FIRST_MATCH_SEED)
  const saved = await savePlayedBulletMatch(profile, engine.runtime, "missing")
  expect(saved.match.ratedOpponentElo).toBeUndefined()
  const storedBeforeResume = await storage.read()
  const controller = new AbortController()
  const put = IDBObjectStore.prototype.put
  const interruptedWrite = vi
    .spyOn(IDBObjectStore.prototype, "put")
    .mockImplementationOnce(function (this: IDBObjectStore, value, key) {
      const request = put.call(this, value, key)
      queueMicrotask(() => this.transaction.abort())
      return request
    })
  try {
    const openRuntime = runtimeOpener(engine.runtime)
    const opening = openCurrentWebMatchSession({
      openRuntime,
      profileActor: profile.actor,
      signal: controller.signal,
    })
    void opening.catch(() => undefined)
    onTestFinished(async () => {
      controller.abort()
      await opening.then(
        (session) => session.close(),
        () => undefined,
      )
    })
    const failed = await waitFor(profile.actor, (snapshot) =>
      snapshot.matches("persistenceFailure"),
    )
    expect(selectPersistenceFailure(failed)?.type).toBe(
      "PROFILE.STORAGE_REQUEST_FAILED",
    )
    expect(selectCurrentPlayerData(failed)).toEqual(saved.playerData)
    expect(selectPendingPlayerData(failed)?.activeMatch).toEqual({
      ...saved.match,
      ratedOpponentElo: engine.runtime.ratedOpponentElo,
    })
    expect(await storage.read()).toEqual(storedBeforeResume)
    expect(engine.close).not.toHaveBeenCalled()
    expect(engine.runtime.positionEvaluator).not.toHaveBeenCalled()
    return {
      controller,
      engine,
      indexedDb,
      opening,
      openRuntime,
      profile,
      saved,
      storage,
      storedBeforeResume,
    }
  } finally {
    interruptedWrite.mockRestore()
  }
}

describe("retained web match recovery", () => {
  it("resumes the same paused game only after retry accepts the interrupted rating backfill", async ({
    onTestFinished,
  }) => {
    const { engine, opening, openRuntime, profile, saved } =
      await interruptResumeWrite(onTestFinished)

    profile.actor.send({ type: "PROFILE.PERSISTENCE_RETRY_REQUESTED" })
    const resumed = await opening
    const ready = await waitFor(profile.actor, (snapshot) =>
      snapshot.matches("ready"),
    )
    const acceptedMatch = {
      ...saved.match,
      ratedOpponentElo: engine.runtime.ratedOpponentElo,
    }

    expect(openRuntime).toHaveBeenCalledOnce()
    expect(resumed.runtime).toBe(engine.runtime)
    expect(resumed.match).toEqual(acceptedMatch)
    expect(resumed.clockStartsOnArrival).toBe(false)
    const matchSnapshot = resumed.actor.getSnapshot()
    expect(selectMatchPosition(matchSnapshot).fen).toBe(saved.match.currentFen)
    const timeline = selectMatchTimeline(matchSnapshot)
    expect(timeline.cursor).toBe(saved.match.cursor)
    expect(timeline.transitions.map(({ move }) => move.id)).toEqual(
      saved.match.moveIds,
    )
    expect(durableMatchClock(matchSnapshot.context.clock)).toEqual(
      saved.match.clock,
    )
    expect(matchSnapshot.context.clock?.startedAt).toBeNull()
    expect(selectCurrentPlayerData(ready)).toEqual({
      ...saved.playerData,
      revision: saved.playerData.revision + 1,
      activeMatch: acceptedMatch,
    })
    expect(selectPendingPlayerData(ready)).toBeNull()
    expect(engine.close).not.toHaveBeenCalled()
    expect(engine.runtime.opponent.selectMove).not.toHaveBeenCalled()
    await resumed.close()
    expect(engine.close).toHaveBeenCalledOnce()
  })

  it("closes an abandoned Resume and reopens the unchanged save with a fresh runtime", async ({
    onTestFinished,
  }) => {
    const {
      controller,
      engine,
      indexedDb,
      opening,
      profile,
      saved,
      storage,
      storedBeforeResume,
    } = await interruptResumeWrite(onTestFinished)

    controller.abort()
    await expect(opening).rejects.toMatchObject({ name: "AbortError" })
    expect(engine.close).toHaveBeenCalledOnce()
    expect(engine.runtime.positionEvaluator).not.toHaveBeenCalled()
    expect(await storage.read()).toEqual(storedBeforeResume)
    await profile.close()

    const reloaded = await openProfileRuntime(undefined, indexedDb)
    onTestFinished(reloaded.close)
    expect(selectCurrentPlayerData(reloaded.actor.getSnapshot())).toEqual(
      saved.playerData,
    )
    const retryEngine = createRuntime(FIRST_MATCH_SEED)
    const resumed = await openCurrentWebMatchSession({
      openRuntime: runtimeOpener(retryEngine.runtime),
      profileActor: reloaded.actor,
      signal: new AbortController().signal,
    })
    onTestFinished(resumed.close)
    expect(resumed.match).toEqual({
      ...saved.match,
      ratedOpponentElo: retryEngine.runtime.ratedOpponentElo,
    })
    expect(
      durableMatchClock(resumed.actor.getSnapshot().context.clock),
    ).toEqual(saved.match.clock)
    expect(engine.close).toHaveBeenCalledOnce()
    expect(retryEngine.close).not.toHaveBeenCalled()
  })

  it.for(["missing", "recorded"] as const)(
    "protects a replacement save from a late Resume with %s rating metadata",
    async (ratingMetadata, { onTestFinished }) => {
      const indexedDb = new IDBFactory()
      const profile = await openProfileRuntime(undefined, indexedDb)
      const storage = new IndexedDbDurableStore(indexedDb)
      onTestFinished(async () => {
        await profile.close()
        await storage.close()
      })
      const oldEngine = createRuntime(FIRST_MATCH_SEED)
      const { match } = await savePlayedBulletMatch(
        profile,
        oldEngine.runtime,
        ratingMetadata,
      )
      expect(match.ratedOpponentElo).toBe(
        ratingMetadata === "recorded"
          ? oldEngine.runtime.ratedOpponentElo
          : undefined,
      )
      const controller = new AbortController()
      const engineOpening = Promise.withResolvers<WebMatchRuntime>()
      const openRuntime = vi.fn(() => engineOpening.promise)
      const opening = openCurrentWebMatchSession({
        openRuntime,
        profileActor: profile.actor,
        signal: controller.signal,
      })
      void opening.catch(() => undefined)
      onTestFinished(async () => {
        controller.abort()
        engineOpening.resolve(oldEngine.runtime)
        await opening.then(
          (session) => session.close(),
          () => undefined,
        )
      })
      expect(openRuntime).toHaveBeenCalledOnce()

      const replacement = buildFreshWebMatch({
        autoHintMode: match.autoHintMode,
        playerEloAtStart: match.playerEloAtStart,
        runtime: createRuntime(SECOND_MATCH_SEED).runtime,
        timeControl: match.timeControl,
      })
      await persistProfileActiveMatch({
        actor: profile.actor,
        candidate: replacement,
        expectedActiveMatch: match,
        signal: new AbortController().signal,
      })
      const accepted = selectCurrentPlayerData(profile.actor.getSnapshot())
      expect(accepted?.activeMatch).toEqual(replacement)
      const storedReplacement = await storage.read()

      engineOpening.resolve(oldEngine.runtime)
      await expect(opening).rejects.toThrow("Canonical active match changed")
      expect(oldEngine.close).toHaveBeenCalledOnce()
      expect(oldEngine.runtime.positionEvaluator).not.toHaveBeenCalled()
      expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(
        accepted,
      )
      expect(await storage.read()).toEqual(storedReplacement)
    },
  )
})

describe("web match session ownership", () => {
  it("rejects Resume before profile hydration or without an active match instead of opening an engine", async () => {
    const openingProfile = openWebProfileRuntime({
      indexedDb: new IDBFactory(),
      subtleCrypto: webcrypto.subtle,
    })
    const opener = runtimeOpener(createRuntime(FIRST_MATCH_SEED).runtime)
    try {
      await expect(
        openCurrentWebMatchSession({
          profileActor: openingProfile.actor,
          openRuntime: opener,
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow("valid player profile")
      await waitFor(openingProfile.actor, (snapshot) =>
        snapshot.matches("ready"),
      )
      await expect(
        openCurrentWebMatchSession({
          profileActor: openingProfile.actor,
          openRuntime: opener,
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow("no active match")
      expect(opener).not.toHaveBeenCalled()
    } finally {
      await openingProfile.close()
    }
  })

  it("keeps both the opening failure and cleanup failure without committing a mismatched Challenge", async () => {
    const profile = await openProfileRuntime()
    const engine = createRuntime(
      FIRST_MATCH_SEED,
      { variant: "standard", chess960PositionId: null },
      { mode: "challenge", playerColor: "white" },
    )
    const closeFailure = new Error("Owned runtime cleanup failed")
    engine.close.mockRejectedValueOnce(closeFailure)
    const before = selectCurrentPlayerData(profile.actor.getSnapshot())
    try {
      const result: unknown = await openFreshWebMatchSession({
        mode: "challenge",
        challengeSetup: {
          ...DEFAULT_CHALLENGE_SETUP,
          difficultyTargetElo: 1000,
        },
        previousSession: null,
        profileActor: profile.actor,
        openRuntime: runtimeOpener(engine.runtime),
        signal: new AbortController().signal,
      }).catch((error: unknown) => error)
      expect(result).toBeInstanceOf(AggregateError)
      if (!(result instanceof AggregateError))
        throw new Error("Both failures must be preserved together.")
      expect(result.errors).toEqual([
        expect.objectContaining({
          message:
            "The opened Challenge difficulty does not match the selection.",
        }),
        closeFailure,
      ])
      expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(
        before,
      )
    } finally {
      await profile.close()
    }
  })

  it("does not restart a session whose saved match was explicitly cleared", async () => {
    const profile = await openProfileRuntime()
    const engine = createRuntime(FIRST_MATCH_SEED)
    const signal = new AbortController().signal
    const session = await openFreshWebMatchSession({
      variant: "standard",
      previousSession: null,
      profileActor: profile.actor,
      openRuntime: runtimeOpener(engine.runtime),
      signal,
    })
    try {
      await returnWebMatchSessionToMenu({
        profileActor: profile.actor,
        session,
        signal,
      })
      await returnWebMatchSessionToMenu({
        profileActor: profile.actor,
        session,
        signal,
      })
      const opener = runtimeOpener(createRuntime(SECOND_MATCH_SEED).runtime)
      await expect(
        openFreshWebMatchSession({
          variant: "standard",
          previousSession: session,
          profileActor: profile.actor,
          openRuntime: opener,
          signal,
        }),
      ).rejects.toThrow("no longer active")
      expect(opener).not.toHaveBeenCalled()
      expect(
        selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch,
      ).toBeNull()
      expect(engine.close).toHaveBeenCalledOnce()
    } finally {
      await profile.close()
    }
  })
  it("starts selected setup rather than silently resuming a retained session, closing the old actor only after acceptance", async () => {
    const profile = await openProfileRuntime()
    const firstRuntime = createRuntime(FIRST_MATCH_SEED)
    const first = await openFreshWebMatchSession({
      variant: "standard",
      previousSession: null,
      profileActor: profile.actor,
      signal: new AbortController().signal,
      openRuntime: runtimeOpener(firstRuntime.runtime),
    })
    const nextRuntime = createRuntime(
      SECOND_MATCH_SEED,
      { variant: "standard", chess960PositionId: null },
      { mode: "challenge", playerColor: "white" },
    )
    const gate = Promise.withResolvers<WebMatchRuntime>()
    const opening = openFreshWebMatchSession({
      mode: "challenge",
      challengeSetup: DEFAULT_CHALLENGE_SETUP,
      previousSession: null,
      replacementSession: first,
      profileActor: profile.actor,
      signal: new AbortController().signal,
      openRuntime: () => gate.promise,
    })
    expect(first.actor.getSnapshot().status).toBe("active")
    expect(firstRuntime.close).not.toHaveBeenCalled()
    expect(
      selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch
        ?.matchId,
    ).toBe(first.match.matchId)
    gate.resolve(nextRuntime.runtime)
    const next = await opening
    expect(next.match.mode).toBe("challenge")
    expect(next.match.matchId).not.toBe(first.match.matchId)
    expect(firstRuntime.close).toHaveBeenCalledOnce()
    expect(
      selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch
        ?.matchId,
    ).toBe(next.match.matchId)
    await next.close()
    await profile.close()
  })

  it("retains the existing session and accepted save when a replacement cannot open", async () => {
    const profile = await openProfileRuntime()
    const firstRuntime = createRuntime(FIRST_MATCH_SEED)
    const first = await openFreshWebMatchSession({
      variant: "standard",
      previousSession: null,
      profileActor: profile.actor,
      signal: new AbortController().signal,
      openRuntime: runtimeOpener(firstRuntime.runtime),
    })
    await expect(
      openFreshWebMatchSession({
        variant: "chess960",
        previousSession: null,
        replacementSession: first,
        profileActor: profile.actor,
        signal: new AbortController().signal,
        openRuntime: async () => {
          throw new Error("Unavailable engine")
        },
      }),
    ).rejects.toThrow("Unavailable engine")
    expect(firstRuntime.close).not.toHaveBeenCalled()
    expect(first.actor.getSnapshot().status).toBe("active")
    expect(
      selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch,
    ).toEqual(first.match)
    await first.close()
    await profile.close()
  })

  it("prepares a match during a preference write and starts with the latest choice", async () => {
    const profile = await openProfileRuntime()
    const store = profile.actor.getSnapshot().context.store
    const commitCurrent = store.commitCurrent.bind(store)
    const gate = Promise.withResolvers<void>()
    vi.spyOn(store, "commitCurrent").mockImplementationOnce(async (...args) => {
      await gate.promise
      return commitCurrent(...args)
    })
    profile.actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "auto-piece-hints",
    })
    profile.actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "no-auto-hints",
    })
    const engine = createRuntime(FIRST_MATCH_SEED)
    const opener = runtimeOpener(engine.runtime)
    const opening = openFreshWebMatchSession({
      variant: "standard",
      previousSession: null,
      profileActor: profile.actor,
      openRuntime: opener,
      signal: new AbortController().signal,
    })
    try {
      await vi.waitFor(() => expect(opener).toHaveBeenCalledOnce())
      expect(
        selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch,
      ).toBeNull()
    } finally {
      gate.resolve()
    }
    const session = await opening
    try {
      expect(session.match.autoHintMode).toBe("no-auto-hints")
      expect(
        selectCurrentPlayerData(profile.actor.getSnapshot()),
      ).toMatchObject({
        activeMatch: { autoHintMode: "no-auto-hints" },
        settings: { autoHintMode: "no-auto-hints" },
      })
    } finally {
      await session.close()
      await profile.close()
    }
  })

  it("closes a mismatched Challenge runtime without committing its match or preferences", async () => {
    const profile = await openProfileRuntime()
    const before = selectCurrentPlayerData(profile.actor.getSnapshot())
    const engine = createRuntime(
      FIRST_MATCH_SEED,
      { variant: "standard", chess960PositionId: null },
      { mode: "challenge", playerColor: "white" },
    )
    await expect(
      openFreshWebMatchSession({
        mode: "challenge",
        challengeSetup: {
          ...DEFAULT_CHALLENGE_SETUP,
          difficultyTargetElo: 1000,
        },
        previousSession: null,
        profileActor: profile.actor,
        openRuntime: runtimeOpener(engine.runtime),
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("opened Challenge difficulty does not match")
    expect(engine.close).toHaveBeenCalledOnce()
    expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(before)
    await profile.close()
  })
  it.each([
    { ...DEFAULT_CHALLENGE_SETUP, opponentId: "bunny-stockfish" as const },
    { ...DEFAULT_CHALLENGE_SETUP, difficultyTargetElo: 2400 },
    { ...DEFAULT_CHALLENGE_SETUP, opponentId: "dragonfly-stockfish" as const },
  ])(
    "rejects unavailable Challenge selection %j before opening resources or changing saves",
    async (challengeSetup) => {
      const profile = await openProfileRuntime()
      const before = selectCurrentPlayerData(profile.actor.getSnapshot())
      const opener = runtimeOpener(createRuntime(FIRST_MATCH_SEED).runtime)
      await expect(
        openFreshWebMatchSession({
          mode: "challenge",
          challengeSetup,
          previousSession: null,
          profileActor: profile.actor,
          openRuntime: opener,
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow(/available|earned/)
      expect(opener).not.toHaveBeenCalled()
      expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(
        before,
      )
      await profile.close()
    },
  )

  it.each(["standard", "chess960"] as const)(
    "saves, reloads and restarts the complete earned roster of %s opponents without losing medals or the other ladder",
    async (variant) => {
      const parsed = parseChess960PositionId(518)
      if (!parsed.ok) throw new Error("Orthodox Chess960 fixture must parse")
      const startingPosition: MatchStartingPosition =
        variant === "standard"
          ? { variant, chess960PositionId: null }
          : { variant, chess960PositionId: parsed.positionId }
      const indexedDb = new IDBFactory()
      let profile = await openProfileRuntime(725, indexedDb)
      const initialRatings = selectCurrentPlayerData(
        profile.actor.getSnapshot(),
      )?.ratings
      if (initialRatings === undefined)
        throw new Error("A playable profile must have variant Elo ratings.")
      for (const [
        index,
        opponentId,
      ] of IMPLEMENTED_DURABLE_OPPONENT_IDS.entries()) {
        const policy = await resolveWebOpponentPolicy(opponentId, variant)
        const engine = createRuntime(
          FIRST_MATCH_SEED,
          startingPosition,
          { mode: "story" },
          policy.fingerprint,
          opponentId,
        )
        const opener = runtimeOpener(engine.runtime)
        const first = await openFreshWebMatchSession({
          mode: "story",
          variant,
          opponentId,
          previousSession: null,
          openRuntime: opener,
          profileActor: profile.actor,
          signal: new AbortController().signal,
        })
        expect(opener).toHaveBeenCalledWith(
          expect.objectContaining({ opponentId }),
        )
        await first.close()
        await waitFor(profile.actor, (snapshot) => snapshot.matches("ready"))
        const saved = selectCurrentPlayerData(profile.actor.getSnapshot())
        expect(saved?.activeMatch).toMatchObject({
          opponentId,
          opponentPolicyFingerprint: policy.fingerprint,
        })
        await profile.close()
        profile = await openProfileRuntime(undefined, indexedDb)
        expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(
          saved,
        )
        const resumed = await openCurrentWebMatchSession({
          openRuntime: runtimeOpener(engine.runtime),
          profileActor: profile.actor,
          signal: new AbortController().signal,
        })
        const replacement = createRuntime(
          SECOND_MATCH_SEED,
          startingPosition,
          { mode: "story" },
          policy.fingerprint,
          opponentId,
        )
        const restartOpener = runtimeOpener(replacement.runtime)
        const restarted = await openFreshWebMatchSession({
          mode: "story",
          variant,
          opponentId: "chicken-stockfish",
          previousSession: resumed,
          openRuntime: restartOpener,
          profileActor: profile.actor,
          signal: new AbortController().signal,
        })
        expect(restartOpener).toHaveBeenCalledWith(
          expect.objectContaining({
            opponentId,
            opponentPolicyFingerprint: policy.fingerprint,
          }),
        )
        expect(restarted.match.matchSeed).toBe(SECOND_MATCH_SEED)
        await restarted.close()
        await waitFor(profile.actor, (snapshot) => snapshot.matches("ready"))

        let timeline = createMatchTimeline(
          createInitialMatchPosition(startingPosition),
        )
        const moves =
          restarted.match.playerColor === "black"
            ? ["f2f3", "e7e5", "g2g4", "d8h4"]
            : ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"]
        for (const uci of moves) {
          const parsedMove = parseMatchMoveId(uci)
          if (!parsedMove.ok) throw new Error("Invalid fixture move")
          const applied = applyMatchTimelineMove(timeline, parsedMove.moveId)
          if (!applied.ok) throw new Error("Invalid fixture timeline")
          timeline = applied.timeline
        }
        const conclusion = deriveRetainedBranchConclusion(timeline)
        expect(conclusion).toMatchObject({
          type: "checkmate",
          winner: restarted.match.playerColor,
        })
        const completed: DurableMatchRecord = {
          ...restarted.match,
          conclusion,
          currentFen: currentMatchPosition(timeline).fen,
          cursor: timeline.cursor,
          moveIds: timeline.transitions.map(({ move }) => move.id),
          pieceHintsUsed: index % 3 !== 2,
          moveHintsUsed: index % 3 === 0,
        }
        const activeMatch = selectCurrentPlayerData(
          profile.actor.getSnapshot(),
        )?.activeMatch
        if (activeMatch === undefined)
          throw new Error("Profile must remain loaded")
        await persistProfileActiveMatch({
          actor: profile.actor,
          candidate: completed,
          expectedActiveMatch: activeMatch,
          signal: new AbortController().signal,
        })
        const progress = selectCurrentPlayerData(
          profile.actor.getSnapshot(),
        )?.storyProgress
        expect(progress?.[variant][index]).toEqual({
          opponentId,
          highestMedal:
            index % 3 === 0 ? "bronze" : index % 3 === 1 ? "silver" : "gold",
        })
        expect(
          progress?.[variant === "standard" ? "chess960" : "standard"],
        ).toEqual([])
        await returnWebMatchSessionToMenu({
          session: restarted,
          profileActor: profile.actor,
          signal: new AbortController().signal,
        })
        await profile.close()
        profile = await openProfileRuntime(undefined, indexedDb)
        const reloaded = selectCurrentPlayerData(profile.actor.getSnapshot())
        expect(reloaded?.storyProgress).toEqual(progress)
        const otherVariant = variant === "standard" ? "chess960" : "standard"
        for (const assistance of MATCH_MEDALS) {
          const otherId = playerRatingId(otherVariant, "untimed", assistance)
          expect(reloaded?.ratings[otherId]).toBe(initialRatings[otherId])
        }
        const assistance = MATCH_MEDALS[index % MATCH_MEDALS.length]!
        const ratingId = playerRatingId(variant, "untimed", assistance)
        expect(reloaded?.ratings[ratingId]).toBeGreaterThan(
          initialRatings[ratingId],
        )
        expect(reloaded?.ratedMatchCounts[ratingId]).toBe(
          Math.floor(index / MATCH_MEDALS.length) + 1,
        )
        if (progress === undefined)
          throw new Error("Story progress must remain available")
        expect(selectDefaultStoryOpponent(progress, variant)).toBe(
          IMPLEMENTED_DURABLE_OPPONENT_IDS[
            Math.min(index + 1, IMPLEMENTED_DURABLE_OPPONENT_IDS.length - 1)
          ],
        )
      }
      await profile.close()
    },
    // Each variant persists, reopens and restarts all 25 opponents in order.
    30_000,
  )

  it.each(["standard", "chess960"] as const)(
    "rejects a locked %s opponent before opening any engine or changing a save",
    async (variant) => {
      const profile = await openProfileRuntime()
      const before = selectCurrentPlayerData(profile.actor.getSnapshot())
      const openRuntime = runtimeOpener(createRuntime(FIRST_MATCH_SEED).runtime)
      await expect(
        openFreshWebMatchSession({
          mode: "story",
          variant,
          opponentId: "bunny-stockfish",
          previousSession: null,
          openRuntime,
          profileActor: profile.actor,
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow("not unlocked")
      expect(openRuntime).not.toHaveBeenCalled()
      expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(
        before,
      )
      await profile.close()
    },
  )

  it.each(["standard", "chess960"] as const)(
    "retains the current %s Story policy through durable reload and restart",
    async (variant) => {
      const parsed = parseChess960PositionId(959)
      if (!parsed.ok) throw new Error("Invalid test layout")
      const startingPosition: MatchStartingPosition =
        variant === "standard"
          ? { variant, chess960PositionId: null }
          : { variant, chess960PositionId: parsed.positionId }
      const policy = await resolveWebOpponentPolicy(
        "chicken-stockfish",
        variant,
      )
      const indexedDb = new IDBFactory()
      const profile = await openProfileRuntime(725, indexedDb)
      const ratings = selectCurrentPlayerData(
        profile.actor.getSnapshot(),
      )?.ratings
      const initialRuntime = createRuntime(
        FIRST_MATCH_SEED,
        startingPosition,
        { mode: "story" },
        policy.fingerprint,
      )
      const first = await openFreshWebMatchSession({
        variant,
        previousSession: null,
        openRuntime: runtimeOpener(initialRuntime.runtime),
        profileActor: profile.actor,
        signal: new AbortController().signal,
      })
      await first.close()
      await profile.close()

      const reloaded = await openProfileRuntime(undefined, indexedDb)
      const resumedRuntime = createRuntime(
        FIRST_MATCH_SEED,
        startingPosition,
        { mode: "story" },
        policy.fingerprint,
      )
      const resumeOpener = runtimeOpener(resumedRuntime.runtime)
      const resumed = await openCurrentWebMatchSession({
        openRuntime: resumeOpener,
        profileActor: reloaded.actor,
        signal: new AbortController().signal,
      })
      expect(resumeOpener).toHaveBeenCalledWith({
        matchSeed: FIRST_MATCH_SEED,
        opponentId: "chicken-stockfish",
        opponentPolicyFingerprint: policy.fingerprint,
        setup: startingPosition,
        signal: expect.any(AbortSignal),
      })
      expect(resumed.match).toEqual(first.match)
      const restartRuntime = createRuntime(
        SECOND_MATCH_SEED,
        startingPosition,
        { mode: "story" },
        policy.fingerprint,
      )
      const restartOpener = runtimeOpener(restartRuntime.runtime)
      const restarted = await openFreshWebMatchSession({
        variant,
        previousSession: resumed,
        openRuntime: restartOpener,
        profileActor: reloaded.actor,
        signal: new AbortController().signal,
      })
      expect(restartOpener).toHaveBeenCalledWith({
        opponentId: "chicken-stockfish",
        opponentPolicyFingerprint: policy.fingerprint,
        setup: startingPosition,
        signal: expect.any(AbortSignal),
      })
      expect(restarted.match.opponentPolicyFingerprint).toBe(policy.fingerprint)
      expect(restarted.match.matchSeed).toBe(SECOND_MATCH_SEED)
      expect(restarted.match.matchId).not.toBe(first.match.matchId)
      expect(
        selectCurrentPlayerData(reloaded.actor.getSnapshot())?.ratings,
      ).toEqual(ratings)
      await restarted.close()
      await reloaded.close()
    },
  )

  it.each(
    (["standard", "chess960"] as const).flatMap((variant) =>
      (["story", "challenge"] as const).map((mode) => ({ variant, mode })),
    ),
  )(
    "protects the saved $variant $mode board and rating when the runtime cannot reproduce its policy",
    async ({ variant, mode }) => {
      const parsed = parseChess960PositionId(518)
      if (!parsed.ok) throw new Error("Test layout must parse")
      const startingPosition: MatchStartingPosition =
        variant === "standard"
          ? { variant, chess960PositionId: null }
          : { variant, chess960PositionId: parsed.positionId }
      const selection =
        mode === "story" ? { mode } : { mode, playerColor: "white" as const }
      const policy =
        mode === "story"
          ? await resolveWebOpponentPolicy("chicken-stockfish", variant)
          : await resolveWebChallengePolicy("chicken-stockfish", variant)
      const profile = await openProfileRuntime(725)
      const engine = createRuntime(
        FIRST_MATCH_SEED,
        startingPosition,
        selection,
        policy.fingerprint,
        "chicken-stockfish",
        policy.targetElo,
      )
      const e4 = parseMatchMoveId("e2e4")
      const e5 = parseMatchMoveId("e7e5")
      if (!e4.ok || !e5.ok) throw new Error("Test moves must parse")
      const candidate = {
        ...buildFreshWebMatch({
          mode,
          autoHintMode: "no-auto-hints",
          playerEloAtStart: 100,
          runtime: engine.runtime,
        }),
        opponentPolicyFingerprint: "obsolete-policy",
        moveIds: [e4.moveId, e5.moveId],
        pieceHintsUsed: true,
        moveHintsUsed: true,
      }
      await persistProfileActiveMatch({
        actor: profile.actor,
        candidate,
        expectedActiveMatch: null,
        signal: new AbortController().signal,
      })
      const before = selectCurrentPlayerData(profile.actor.getSnapshot())
      if (before === null) throw new Error("Test profile must be ready")
      const openRuntime = runtimeOpener(engine.runtime)
      await expect(
        openCurrentWebMatchSession({
          openRuntime,
          profileActor: profile.actor,
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow("requires its original opponent policy")
      expect(engine.close).toHaveBeenCalledOnce()
      expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(
        before,
      )
      await profile.close()
    },
  )

  it("closes the runtime and retains the saved match when reopening the match is aborted", async () => {
    const profile = await openProfileRuntime()
    const engine = createRuntime(FIRST_MATCH_SEED)
    const candidate = {
      ...buildFreshWebMatch({
        autoHintMode: "no-auto-hints",
        playerEloAtStart: 100,
        runtime: engine.runtime,
      }),
      opponentPolicyFingerprint: "obsolete-policy",
    }
    await persistProfileActiveMatch({
      actor: profile.actor,
      candidate,
      expectedActiveMatch: null,
      signal: new AbortController().signal,
    })
    const before = selectCurrentPlayerData(profile.actor.getSnapshot())
    const controller = new AbortController()
    await expect(
      openCurrentWebMatchSession({
        openRuntime: async () => {
          controller.abort()
          return engine.runtime
        },
        profileActor: profile.actor,
        signal: controller.signal,
      }),
    ).rejects.toThrow("aborted")
    expect(engine.close).toHaveBeenCalledOnce()
    expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(before)
    await profile.close()
  })

  it.each(
    (["standard", "chess960"] as const).flatMap((variant) =>
      (["black", "random"] as const).map((playerColor) => ({
        variant,
        playerColor,
      })),
    ),
  )(
    "persists and reloads $variant Challenge with $playerColor preference, actual Black and independent rating",
    async ({ variant, playerColor }) => {
      const layout = parseChess960PositionId(959)
      if (!layout.ok) throw new Error("Invalid test layout")
      const startingPosition: MatchStartingPosition =
        variant === "standard"
          ? { variant, chess960PositionId: null }
          : { variant, chess960PositionId: layout.positionId }
      const challengeSetup: ChallengeSetup = {
        ...DEFAULT_CHALLENGE_SETUP,
        opponentId: "bunny-stockfish",
        difficultyTargetElo: 1000,
        ...startingPosition,
        playerColor,
        ...(playerColor === "random" ? { chess960PositionId: null } : {}),
      }
      const selection = { mode: "challenge", playerColor: "black" } as const
      const policy = await resolveWebChallengePolicy(
        "bunny-stockfish",
        variant,
        1000,
      )
      const indexedDb = new IDBFactory()
      const earned: StoryProgress = {
        standard: [],
        chess960: [],
        [variant === "standard" ? "chess960" : "standard"]: [
          { opponentId: "chicken-stockfish", highestMedal: "gold" },
          { opponentId: "bunny-stockfish", highestMedal: "silver" },
        ],
      }
      const profile = await openProfileRuntime(725, indexedDb, earned)
      const engine = createRuntime(
        FIRST_MATCH_SEED,
        startingPosition,
        selection,
        policy.fingerprint,
        "bunny-stockfish",
        policy.targetElo,
      )
      const opener = runtimeOpener(engine.runtime)
      const first = await openFreshWebMatchSession({
        mode: "challenge",
        challengeSetup,
        ...(variant === "chess960"
          ? { displayedChess960PositionId: layout.positionId }
          : {}),
        previousSession: null,
        openRuntime: opener,
        profileActor: profile.actor,
        signal: new AbortController().signal,
      })
      expect(opener).toHaveBeenCalledWith({
        ...selection,
        playerColor,
        difficultyTargetElo: 1000,
        opponentId: "bunny-stockfish",
        setup: startingPosition,
        signal: expect.any(AbortSignal),
      })
      expect(first.match).toMatchObject({
        mode: "challenge",
        opponentId: "bunny-stockfish",
        opponentPolicyFingerprint: policy.fingerprint,
        playerColor: "black",
        playerEloAtStart: variant === "standard" ? 600 : 725,
      })
      await first.close()
      await waitFor(profile.actor, (snapshot) => snapshot.matches("ready"))
      const saved = selectCurrentPlayerData(profile.actor.getSnapshot())
      expect(saved?.settings.challengeSetup).toEqual(challengeSetup)
      expect(saved?.activeMatch?.opponentTargetElo).toBe(1000)
      expect(saved?.challengeHistory[variant].difficulties).toEqual([
        {
          targetElo: 1000,
          lastPlayedAnimal: "bunny-stockfish",
          highestMedal: null,
        },
      ])
      await profile.close()

      const reloaded = await openProfileRuntime(undefined, indexedDb)
      expect(selectCurrentPlayerData(reloaded.actor.getSnapshot())).toEqual(
        saved,
      )
      const resumeOpener = runtimeOpener(
        createRuntime(
          FIRST_MATCH_SEED,
          startingPosition,
          selection,
          policy.fingerprint,
          "bunny-stockfish",
          policy.targetElo,
        ).runtime,
      )
      const resumed = await openCurrentWebMatchSession({
        openRuntime: resumeOpener,
        profileActor: reloaded.actor,
        signal: new AbortController().signal,
      })
      expect(resumeOpener).toHaveBeenCalledWith({
        ...selection,
        difficultyTargetElo: 1000,
        matchSeed: FIRST_MATCH_SEED,
        setup: startingPosition,
        signal: expect.any(AbortSignal),
        opponentId: "bunny-stockfish",
        opponentPolicyFingerprint: policy.fingerprint,
      })
      expect(resumed.match).toEqual(saved?.activeMatch)
      expect(resumed.runtime.opponentTargetElo).toBe(1000)
      expect(
        selectCurrentPlayerData(reloaded.actor.getSnapshot())?.challengeHistory,
      ).toEqual(saved?.challengeHistory)
      const restartOpener = runtimeOpener(
        createRuntime(
          SECOND_MATCH_SEED,
          startingPosition,
          selection,
          policy.fingerprint,
          "bunny-stockfish",
          policy.targetElo,
        ).runtime,
      )
      const restarted = await openFreshWebMatchSession({
        mode: "challenge",
        challengeSetup: { ...DEFAULT_CHALLENGE_SETUP, playerColor: "white" },
        previousSession: resumed,
        openRuntime: restartOpener,
        profileActor: reloaded.actor,
        signal: new AbortController().signal,
      })
      expect(restartOpener).toHaveBeenCalledWith({
        ...selection,
        setup: startingPosition,
        signal: expect.any(AbortSignal),
        opponentId: "bunny-stockfish",
        opponentPolicyFingerprint: policy.fingerprint,
      })
      expect(restarted.match).toMatchObject({
        mode: "challenge",
        opponentId: "bunny-stockfish",
        opponentPolicyFingerprint: policy.fingerprint,
        playerColor: "black",
        matchSeed: SECOND_MATCH_SEED,
        startingPosition,
      })
      expect(restarted.runtime.opponentTargetElo).toBe(1000)
      expect(
        selectCurrentPlayerData(reloaded.actor.getSnapshot())?.ratings,
      ).toEqual(saved?.ratings)
      expect(
        selectCurrentPlayerData(reloaded.actor.getSnapshot())?.storyProgress,
      ).toEqual(earned)
      expect(
        selectCurrentPlayerData(reloaded.actor.getSnapshot())?.settings
          .challengeSetup,
      ).toEqual(challengeSetup)
      await restarted.close()
      await reloaded.close()
    },
  )

  it("remembers Random without replacing it with the concrete board during restart or resume", async () => {
    const layout = parseChess960PositionId(959)
    if (!layout.ok) throw new Error("Invalid test layout")
    const startingPosition = {
      variant: "chess960",
      chess960PositionId: layout.positionId,
    } as const
    const challengeSetup: ChallengeSetup = {
      ...DEFAULT_CHALLENGE_SETUP,
      variant: "chess960",
      chess960PositionId: null,
      playerColor: "white",
    }
    const selection = { mode: "challenge", playerColor: "white" } as const
    const policy = await resolveWebChallengePolicy(
      "chicken-stockfish",
      "chess960",
      100,
    )
    const profile = await openProfileRuntime()
    const opener = runtimeOpener(
      createRuntime(
        FIRST_MATCH_SEED,
        startingPosition,
        selection,
        policy.fingerprint,
        "chicken-stockfish",
        policy.targetElo,
      ).runtime,
    )
    const first = await openFreshWebMatchSession({
      mode: "challenge",
      challengeSetup,
      previousSession: null,
      openRuntime: opener,
      profileActor: profile.actor,
      signal: new AbortController().signal,
    })
    expect(opener).toHaveBeenCalledWith({
      ...selection,
      difficultyTargetElo: 100,
      opponentId: "chicken-stockfish",
      setup: { variant: "chess960" },
      signal: expect.any(AbortSignal),
    })
    const restarted = await openFreshWebMatchSession({
      mode: "challenge",
      challengeSetup,
      previousSession: first,
      openRuntime: runtimeOpener(
        createRuntime(
          SECOND_MATCH_SEED,
          startingPosition,
          selection,
          policy.fingerprint,
          "chicken-stockfish",
          policy.targetElo,
        ).runtime,
      ),
      profileActor: profile.actor,
      signal: new AbortController().signal,
    })
    expect(restarted.match.startingPosition).toEqual(startingPosition)
    expect(
      selectCurrentPlayerData(profile.actor.getSnapshot())?.settings
        .challengeSetup,
    ).toEqual(challengeSetup)
    await restarted.close()
    const resumed = await openCurrentWebMatchSession({
      openRuntime: runtimeOpener(
        createRuntime(
          SECOND_MATCH_SEED,
          startingPosition,
          selection,
          policy.fingerprint,
          "chicken-stockfish",
          policy.targetElo,
        ).runtime,
      ),
      profileActor: profile.actor,
      signal: new AbortController().signal,
    })
    expect(resumed.match.startingPosition).toEqual(startingPosition)
    expect(
      selectCurrentPlayerData(profile.actor.getSnapshot())?.settings
        .challengeSetup,
    ).toEqual(challengeSetup)
    await resumed.close()
    await profile.close()
  })

  it("closes an aborted Challenge launch without saving its match or setup", async () => {
    const profile = await openProfileRuntime()
    const initial = selectCurrentPlayerData(profile.actor.getSnapshot())
    const challengeSetup = {
      ...DEFAULT_CHALLENGE_SETUP,
      variant: "standard",
      playerColor: "black",
      chess960PositionId: null,
    } as const
    const policy = await resolveWebChallengePolicy(
      "chicken-stockfish",
      "standard",
      100,
    )
    const engine = createRuntime(
      FIRST_MATCH_SEED,
      { variant: "standard", chess960PositionId: null },
      { mode: "challenge", playerColor: "black" },
      policy.fingerprint,
      "chicken-stockfish",
      policy.targetElo,
    )
    const controller = new AbortController()
    const openRuntime = vi.fn(async () => {
      controller.abort()
      return engine.runtime
    })
    await expect(
      openFreshWebMatchSession({
        mode: "challenge",
        challengeSetup,
        previousSession: null,
        openRuntime,
        profileActor: profile.actor,
        signal: controller.signal,
      }),
    ).rejects.toThrow("aborted")
    expect(engine.close).toHaveBeenCalledOnce()
    expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(
      initial,
    )
    await profile.close()
  })

  it("persists and resumes Chess960, then restarts the same layout with a fresh seed", async () => {
    const layout = parseChess960PositionId(0)
    if (!layout.ok) throw new Error("Invalid test layout")
    const startingPosition = {
      variant: "chess960",
      chess960PositionId: layout.positionId,
    } as const
    const profileRuntime = await openProfileRuntime(725)
    const firstRuntime = createRuntime(FIRST_MATCH_SEED, startingPosition)
    const freshOpener = runtimeOpener(firstRuntime.runtime)
    const first = await openFreshWebMatchSession({
      variant: "chess960",
      previousSession: null,
      openRuntime: freshOpener,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })
    expect(freshOpener).toHaveBeenCalledWith({
      opponentId: "chicken-stockfish",
      setup: { variant: "chess960" },
      signal: expect.any(AbortSignal),
    })
    expect(first.match.playerEloAtStart).toBe(725)
    expect(first.match.playerElosAtStart).toEqual({
      gold: 725,
      silver: 100,
      bronze: 100,
    })
    expect(Object.isFrozen(first.match.playerElosAtStart)).toBe(true)
    await first.close()
    const resumedOpener = runtimeOpener(
      createRuntime(FIRST_MATCH_SEED, startingPosition).runtime,
    )
    const resumed = await openCurrentWebMatchSession({
      openRuntime: resumedOpener,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })
    expect(resumedOpener).toHaveBeenCalledWith({
      matchSeed: FIRST_MATCH_SEED,
      setup: startingPosition,
      signal: expect.any(AbortSignal),
      opponentId: "chicken-stockfish",
      opponentPolicyFingerprint: "session-test-policy",
    })
    expect(resumed.match).toEqual(first.match)
    const restartOpener = runtimeOpener(
      createRuntime(SECOND_MATCH_SEED, startingPosition).runtime,
    )
    const restarted = await openFreshWebMatchSession({
      variant: "chess960",
      previousSession: resumed,
      openRuntime: restartOpener,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })
    expect(restartOpener).toHaveBeenCalledWith({
      setup: startingPosition,
      signal: expect.any(AbortSignal),
      opponentId: "chicken-stockfish",
      opponentPolicyFingerprint: "session-test-policy",
    })
    expect(restarted.match.startingPosition).toEqual(
      first.match.startingPosition,
    )
    expect(restarted.match.matchSeed).toBe(SECOND_MATCH_SEED)
    expect(restarted.match.matchId).not.toBe(first.match.matchId)
    expect(
      selectCurrentPlayerData(profileRuntime.actor.getSnapshot())?.activeMatch,
    ).toEqual(restarted.match)
    await restarted.close()
    await profileRuntime.close()
  })

  it("persists a fresh session and closes every owned resource once", async () => {
    const profileRuntime = await openProfileRuntime()
    const engineRuntime = createRuntime(FIRST_MATCH_SEED)
    const session = await openFreshWebMatchSession({
      variant: "standard",
      openRuntime: runtimeOpener(engineRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    expect(
      selectCurrentPlayerData(profileRuntime.actor.getSnapshot())?.activeMatch,
    ).toEqual(session.match)

    const firstClose = session.close()
    const repeatedClose = session.close()
    expect(repeatedClose).toBe(firstClose)
    await firstClose
    expect(engineRuntime.close).toHaveBeenCalledOnce()
    expect(session.actor.getSnapshot().status).toBe("stopped")
    expect(session.evaluationActor.getSnapshot().status).toBe("stopped")
    await profileRuntime.close()
  })

  it("replaces the saved match only after closing the prior session", async () => {
    const profileRuntime = await openProfileRuntime()
    const firstRuntime = createRuntime(FIRST_MATCH_SEED)
    const secondRuntime = createRuntime(SECOND_MATCH_SEED)
    const firstSession = await openFreshWebMatchSession({
      variant: "standard",
      openRuntime: runtimeOpener(firstRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    const secondSession = await openFreshWebMatchSession({
      variant: "standard",
      openRuntime: runtimeOpener(secondRuntime.runtime),
      previousSession: firstSession,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    expect(firstRuntime.close).toHaveBeenCalledOnce()
    expect(secondSession.match.matchId).toBe(
      `standard-story-chicken/${SECOND_MATCH_SEED}`,
    )
    expect(
      selectCurrentPlayerData(profileRuntime.actor.getSnapshot())?.activeMatch,
    ).toEqual(secondSession.match)
    await secondSession.close()
    await profileRuntime.close()
  })

  it("resumes the exact saved seed without replacing the active match", async () => {
    const profileRuntime = await openProfileRuntime()
    const initialRuntime = createRuntime(FIRST_MATCH_SEED)
    const initialSession = await openFreshWebMatchSession({
      variant: "standard",
      openRuntime: runtimeOpener(initialRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })
    await initialSession.close()
    const resumedRuntime = createRuntime(FIRST_MATCH_SEED)
    const openRuntime = runtimeOpener(resumedRuntime.runtime)

    const resumedSession = await openCurrentWebMatchSession({
      openRuntime,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    expect(openRuntime).toHaveBeenCalledWith({
      matchSeed: FIRST_MATCH_SEED,
      signal: expect.any(AbortSignal),
      setup: { variant: "standard", chess960PositionId: null },
      opponentId: "chicken-stockfish",
      opponentPolicyFingerprint: "session-test-policy",
    })
    expect(resumedSession.match).toEqual(initialSession.match)
    await resumedSession.close()
    await profileRuntime.close()
  })

  it.each([
    ["the same match", FIRST_MATCH_SEED],
    ["a replacement match", SECOND_MATCH_SEED],
  ])(
    "preserves ownership when returning to the menu during a save for %s",
    async (_name, pendingSeed) => {
      const profile = await openProfileRuntime()
      const engine = createRuntime(FIRST_MATCH_SEED)
      const signal = new AbortController().signal
      const session = await openFreshWebMatchSession({
        variant: "standard",
        openRuntime: runtimeOpener(engine.runtime),
        previousSession: null,
        profileActor: profile.actor,
        signal,
      })
      try {
        const pending = {
          ...session.match,
          matchId: createRuntime(pendingSeed).runtime.matchId,
          matchSeed: pendingSeed,
          pieceHintsUsed: true,
        }
        profile.actor.send({
          type: "PROFILE.ACTIVE_MATCH_SAVE_REQUESTED",
          activeMatch: pending,
        })
        expect(profile.actor.getSnapshot().matches("persisting")).toBe(true)
        const leaving = returnWebMatchSessionToMenu({
          profileActor: profile.actor,
          session,
          signal,
        })
        if (pendingSeed === FIRST_MATCH_SEED) {
          await leaving
          expect(
            selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch,
          ).toBeNull()
        } else {
          await expect(leaving).rejects.toThrow("A different active match")
          expect(
            selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch,
          ).toEqual(pending)
        }
      } finally {
        await profile.close()
      }
    },
  )

  it("closes the session before clearing its verified active match", async () => {
    const profileRuntime = await openProfileRuntime()
    const engineRuntime = createRuntime(FIRST_MATCH_SEED)
    const session = await openFreshWebMatchSession({
      variant: "standard",
      openRuntime: runtimeOpener(engineRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    await returnWebMatchSessionToMenu({
      profileActor: profileRuntime.actor,
      session,
      signal: new AbortController().signal,
    })

    expect(engineRuntime.close).toHaveBeenCalledOnce()
    expect(
      selectCurrentPlayerData(profileRuntime.actor.getSnapshot())?.activeMatch,
    ).toBeNull()
    await profileRuntime.close()
  })

  it("resumes a replacement already accepted during a restart retry", async () => {
    const profileRuntime = await openProfileRuntime()
    const firstRuntime = createRuntime(FIRST_MATCH_SEED)
    const firstSession = await openFreshWebMatchSession({
      variant: "standard",
      openRuntime: runtimeOpener(firstRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })
    await firstSession.close()

    const acceptedRuntime = createRuntime(SECOND_MATCH_SEED)
    const acceptedMatch = buildFreshWebMatch({
      autoHintMode: firstSession.match.autoHintMode,
      playerEloAtStart: firstSession.match.playerEloAtStart,
      runtime: acceptedRuntime.runtime,
    })
    await persistProfileActiveMatch({
      actor: profileRuntime.actor,
      candidate: acceptedMatch,
      expectedActiveMatch: firstSession.match,
      signal: new AbortController().signal,
    })
    const resumedRuntime = createRuntime(SECOND_MATCH_SEED)
    const openRuntime = runtimeOpener(resumedRuntime.runtime)

    const resumedSession = await openFreshWebMatchSession({
      variant: "standard",
      openRuntime,
      previousSession: firstSession,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    expect(openRuntime).toHaveBeenCalledWith({
      matchSeed: SECOND_MATCH_SEED,
      signal: expect.any(AbortSignal),
      setup: { variant: "standard", chess960PositionId: null },
      opponentId: "chicken-stockfish",
      opponentPolicyFingerprint: "session-test-policy",
    })
    expect(resumedSession.match).toEqual(acceptedMatch)
    await resumedSession.close()
    await profileRuntime.close()
  })
})
