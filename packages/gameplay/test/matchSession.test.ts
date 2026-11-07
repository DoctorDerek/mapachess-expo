import { createHash } from "node:crypto"
import { describe, expect, it, vi, type TestContext } from "vitest"
import { createActor, waitFor, type ActorRefFrom } from "xstate"
import { DEFAULT_CHALLENGE_SETUP } from "@mapachess/match/challenge-setup"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import { selectMatchTimeline } from "@mapachess/match/match-machine"
import {
  createInitialMatchPosition,
  type MatchStartingPosition,
} from "@mapachess/match/match-position"
import { TIME_CONTROL_PRESETS } from "@mapachess/match/time-control"
import SerializedPlayerDataStore, {
  durableStoreSnapshotsEqual,
  EMPTY_DURABLE_STORE_SNAPSHOT,
  type DurableStoreAdapter,
  type DurableStoreSnapshot,
} from "@mapachess/profile/durable-store"
import createInitialMapachessPlayerData, {
  type MapachessPlayerData,
} from "@mapachess/profile/player-data"
import { decodeMapachessPortableBackup } from "@mapachess/profile/portable-backup"
import profileMachine, {
  selectCurrentPlayerData,
} from "@mapachess/profile/profile-machine"
import { persistProfileActiveMatch } from "@mapachess/profile/profile-match-persistence"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import { buildFreshMatch } from "../src/durableMatch.js"
import { createMatchId, selectStoryPlayerColor } from "../src/matchIdentity.js"
import type {
  MatchRuntime,
  OpenMatchRuntimeInput,
} from "../src/matchRuntime.js"
import openFreshMatchSession, {
  openCurrentMatchSession,
  returnMatchSessionToMenu,
} from "../src/matchSession.js"

const FIRST_SEED = "00000001000000020000000300000004"
const SECOND_SEED = "00000005000000060000000700000008"
const sha256 = async (value: string) =>
  createHash("sha256").update(value).digest("hex")
const signal = () => new AbortController().signal
const monotonicClock = { now: () => 1234 }
const challengeDifficultyTargets = () => [100, 137]

async function openProfile(
  test: TestContext,
  initial = createInitialMapachessPlayerData(),
) {
  let snapshot: DurableStoreSnapshot = EMPTY_DURABLE_STORE_SNAPSHOT
  const adapter: DurableStoreAdapter = {
    read: async () => snapshot,
    compareAndSwapVerified: async ({ expected, next }) => {
      if (!durableStoreSnapshotsEqual(snapshot, expected)) {
        return { actual: snapshot, ok: false, type: "PROFILE.STORAGE_CONFLICT" }
      }
      snapshot = next
      return { ok: true, snapshot }
    },
  }
  const store = new SerializedPlayerDataStore(adapter, sha256)
  const committed = await store.commitCurrent(await store.load(), {
    ...initial,
    settings: { ...initial.settings, autoHintMode: "no-auto-hints" },
  })
  if (!committed.ok) throw new Error("The profile fixture must commit.")
  const actor = createActor(profileMachine, {
    input: {
      store,
      decodePortableBackup: (raw) => decodeMapachessPortableBackup(raw, sha256),
    },
  }).start()
  test.onTestFinished(() => {
    actor.stop()
  })
  await waitFor(actor, (state) => state.matches("ready"))
  return { actor, store, read: () => snapshot }
}

function requireProfile(
  actor: ActorRefFrom<typeof profileMachine>,
): MapachessPlayerData {
  const current = selectCurrentPlayerData(actor.getSnapshot())
  if (current === null) throw new Error("The fixture requires a ready profile.")
  return current
}

function runtimeFixture({
  rawSeed = FIRST_SEED,
  position = { variant: "standard", chess960PositionId: null },
  mode = "story",
  target = 100,
}: Readonly<{
  rawSeed?: string
  position?: MatchStartingPosition
  mode?: "story" | "challenge"
  target?: number
}> = {}) {
  const matchSeed = parseDeterministicRandomSeed(rawSeed)
  const selection =
    mode === "story"
      ? ({ mode } as const)
      : ({ mode, playerColor: "white" } as const)
  const close = vi.fn(async () => undefined)
  const runtime: MatchRuntime = {
    close,
    engineIdentity: {
      author: "Capability fixture",
      name: "Platform-neutral engine",
    },
    hintAnalyst: {
      analyze: async (request) => ({
        player: [],
        opponent: [],
        positionFen: request.position.fen,
        requestId: request.requestId,
      }),
    },
    matchId: createMatchId(matchSeed, position, selection),
    matchSeed,
    opponent: {
      selectMove: async (request) => {
        const move = request.legalMoves[0]
        if (move === undefined)
          throw new Error("The opponent requires a legal move.")
        return move.id
      },
    },
    opponentId: "chicken-stockfish",
    opponentPolicyFingerprint: "capability-fixture",
    opponentTargetElo: target,
    ratedOpponentElo: target,
    playerColor: mode === "story" ? selectStoryPlayerColor(matchSeed) : "white",
    startingPosition: position,
    positionEvaluator: vi.fn(async (request) => ({
      evaluation: { kind: "draw" as const },
      positionFen: request.position.fen,
      requestId: request.requestId,
    })),
  }
  const openRuntime = vi.fn(async (_input: OpenMatchRuntimeInput) => runtime)
  return { runtime, close, openRuntime }
}

function dependencies(
  profile: Awaited<ReturnType<typeof openProfile>>,
  fixture = runtimeFixture(),
) {
  return {
    profileActor: profile.actor,
    signal: signal(),
    monotonicClock,
    openRuntime: fixture.openRuntime,
    challengeDifficultyTargets,
  }
}

describe("accepted platform-neutral match sessions", () => {
  it.for(["standard", "chess960"] as const)(
    "opens both %s modes with canonical actors and accepted data",
    async (variant, test) => {
      const parsed = parseChess960PositionId(959)
      if (!parsed.ok) throw new Error("The fixture requires position 959.")
      const position: MatchStartingPosition =
        variant === "standard"
          ? { variant, chess960PositionId: null }
          : { variant, chess960PositionId: parsed.positionId }
      for (const mode of ["story", "challenge"] as const) {
        const profile = await openProfile(test)
        const fixture = runtimeFixture({
          mode,
          position,
          target: mode === "challenge" ? 137 : 100,
        })
        const common = {
          ...dependencies(profile, fixture),
          previousSession: null,
        }
        const session = await openFreshMatchSession(
          mode === "story"
            ? { ...common, variant }
            : {
                ...common,
                mode,
                challengeSetup: {
                  ...DEFAULT_CHALLENGE_SETUP,
                  ...position,
                  difficultyTargetElo: 137,
                },
              },
        )
        test.onTestFinished(() => session.close())
        expect(requireProfile(profile.actor).activeMatch).toEqual(session.match)
        expect(session.runtime).toBe(fixture.runtime)
        expect(session.clockStartsOnArrival).toBe(true)
        expect(session.actor.getSnapshot().context.monotonicClock).toBe(
          monotonicClock,
        )
        expect(session.actor.getSnapshot().context.matchId).toBe(
          session.match.matchId,
        )
        expect(session.match.playerElosAtStart).toEqual({
          gold: 100,
          silver: 100,
          bronze: 100,
        })
        expect(session.setup).toMatchObject(
          mode === "story"
            ? { mode, variant }
            : {
                mode,
                challengeSetup: {
                  variant,
                  difficultyTargetElo: fixture.runtime.opponentTargetElo,
                },
              },
        )
        expect(fixture.openRuntime).toHaveBeenCalledWith(
          expect.objectContaining({
            setup:
              mode === "story" && variant === "chess960"
                ? { variant }
                : position,
            signal: expect.any(AbortSignal),
          }),
        )
        await session.close()
        await session.close()
        expect(fixture.close).toHaveBeenCalledOnce()
        expect(session.actor.getSnapshot().status).toBe("stopped")
        expect(session.evaluationActor.getSnapshot().status).toBe("stopped")
      }
    },
  )

  it("rejects unavailable Story and Challenge choices before opening an engine", async (test) => {
    const profile = await openProfile(test)
    const fixture = runtimeFixture()
    const common = { ...dependencies(profile, fixture), previousSession: null }
    await expect(
      openFreshMatchSession({
        ...common,
        variant: "standard",
        opponentId: "dog-stockfish",
      }),
    ).rejects.toThrow("not unlocked")
    await expect(
      openFreshMatchSession({
        ...common,
        mode: "challenge",
        challengeSetup: {
          ...DEFAULT_CHALLENGE_SETUP,
          opponentId: "dog-stockfish",
        },
      }),
    ).rejects.toThrow("earned")
    await expect(
      openFreshMatchSession({
        ...common,
        mode: "challenge",
        challengeSetup: {
          ...DEFAULT_CHALLENGE_SETUP,
          difficultyTargetElo: 150,
        },
      }),
    ).rejects.toThrow("supported")
    expect(fixture.openRuntime).not.toHaveBeenCalled()
  })

  it("does not accept a runtime whose target differs from the selected capability", async (test) => {
    const profile = await openProfile(test)
    const fixture = runtimeFixture({ mode: "challenge" })
    await expect(
      openFreshMatchSession({
        ...dependencies(profile, fixture),
        previousSession: null,
        mode: "challenge",
        challengeSetup: {
          ...DEFAULT_CHALLENGE_SETUP,
          difficultyTargetElo: 137,
        },
      }),
    ).rejects.toThrow("does not match")
    expect(fixture.close).toHaveBeenCalledOnce()
    expect(requireProfile(profile.actor).activeMatch).toBeNull()
  })

  it("uses the shown Chess960 layout rather than generating another", async (test) => {
    const profile = await openProfile(test)
    const parsed = parseChess960PositionId(959)
    if (!parsed.ok) throw new Error("The fixture requires position 959.")
    const fixture = runtimeFixture({
      mode: "challenge",
      position: { variant: "chess960", chess960PositionId: parsed.positionId },
    })
    const session = await openFreshMatchSession({
      ...dependencies(profile, fixture),
      previousSession: null,
      mode: "challenge",
      challengeSetup: {
        ...DEFAULT_CHALLENGE_SETUP,
        variant: "chess960",
        chess960PositionId: null,
      },
      displayedChess960PositionId: parsed.positionId,
    })
    test.onTestFinished(() => session.close())
    expect(fixture.openRuntime).toHaveBeenCalledWith(
      expect.objectContaining({ setup: fixture.runtime.startingPosition }),
    )
    expect(requireProfile(profile.actor).settings.challengeSetup).toMatchObject(
      { variant: "chess960", chess960PositionId: null },
    )
  })

  it("resumes the accepted identity and metadata without replacing other progress", async (test) => {
    const fixture = runtimeFixture()
    const initial = createInitialMapachessPlayerData()
    const activeMatch = buildFreshMatch({
      autoHintMode: "no-auto-hints",
      playerEloAtStart: 100,
      runtime: fixture.runtime,
    })
    const profile = await openProfile(test, { ...initial, activeMatch })
    const before = requireProfile(profile.actor)
    const session = await openCurrentMatchSession(
      dependencies(profile, fixture),
    )
    test.onTestFinished(() => session.close())
    expect(session.clockStartsOnArrival).toBe(false)
    expect(selectMatchTimeline(session.actor.getSnapshot()).cursor).toBe(
      activeMatch.cursor,
    )
    expect(fixture.openRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        matchSeed: activeMatch.matchSeed,
        opponentPolicyFingerprint: activeMatch.opponentPolicyFingerprint,
      }),
    )
    expect(requireProfile(profile.actor)).toEqual(before)
  })

  it.for([
    "opponentPolicyFingerprint",
    "opponentTargetElo",
    "ratedOpponentElo",
  ] as const)(
    "preserves the save when resumed %s disagrees",
    async (field, test) => {
      const fixture = runtimeFixture()
      const record = buildFreshMatch({
        autoHintMode: "no-auto-hints",
        playerEloAtStart: 100,
        runtime: fixture.runtime,
      })
      const profile = await openProfile(test, {
        ...createInitialMapachessPlayerData(),
        activeMatch: record,
      })
      const original = profile.read()
      const different: MatchRuntime =
        field === "opponentPolicyFingerprint"
          ? { ...fixture.runtime, opponentPolicyFingerprint: "different" }
          : { ...fixture.runtime, [field]: 200 }
      await expect(
        openCurrentMatchSession({
          ...dependencies(profile, fixture),
          openRuntime: async () => different,
        }),
      ).rejects.toThrow("original opponent policy")
      expect(fixture.close).toHaveBeenCalledOnce()
      expect(profile.read()).toEqual(original)
    },
  )

  it("backfills supported legacy metadata through accepted persistence", async (test) => {
    const fixture = runtimeFixture()
    const record = {
      ...buildFreshMatch({
        autoHintMode: "no-auto-hints",
        playerEloAtStart: 100,
        runtime: fixture.runtime,
      }),
    }
    delete record.ratedOpponentElo
    const profile = await openProfile(test, {
      ...createInitialMapachessPlayerData(),
      activeMatch: record,
    })
    const session = await openCurrentMatchSession(
      dependencies(profile, fixture),
    )
    test.onTestFinished(() => session.close())
    expect(session.match.ratedOpponentElo).toBe(100)
    expect(requireProfile(profile.actor).activeMatch).toEqual(session.match)
  })

  it("closes an aborted late runtime without accepting or clearing another match", async (test) => {
    const fixture = runtimeFixture()
    const record = buildFreshMatch({
      autoHintMode: "no-auto-hints",
      playerEloAtStart: 100,
      runtime: fixture.runtime,
    })
    const profile = await openProfile(test, {
      ...createInitialMapachessPlayerData(),
      activeMatch: record,
    })
    const controller = new AbortController()
    await expect(
      openCurrentMatchSession({
        ...dependencies(profile, fixture),
        signal: controller.signal,
        openRuntime: async () => {
          controller.abort()
          return fixture.runtime
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(fixture.close).toHaveBeenCalledOnce()
    expect(requireProfile(profile.actor).activeMatch).toEqual(record)
  })

  it("retains both the opening and cleanup failures", async (test) => {
    const fixture = runtimeFixture()
    const record = buildFreshMatch({
      autoHintMode: "no-auto-hints",
      playerEloAtStart: 100,
      runtime: fixture.runtime,
    })
    const profile = await openProfile(test, {
      ...createInitialMapachessPlayerData(),
      activeMatch: record,
    })
    const closing = new Error("Closing failed")
    fixture.close.mockRejectedValueOnce(closing)
    const failure = await openCurrentMatchSession({
      ...dependencies(profile, fixture),
      openRuntime: async () => ({
        ...fixture.runtime,
        opponentPolicyFingerprint: "changed",
      }),
    }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(AggregateError)
    if (!(failure instanceof AggregateError))
      throw new Error("Expected aggregated failures.")
    expect(failure.errors).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("original opponent policy"),
      }),
      closing,
    ])
  })

  it("restarts the same setup while accepting a fresh identity", async (test) => {
    const profile = await openProfile(test)
    const original = runtimeFixture()
    const session = await openFreshMatchSession({
      ...dependencies(profile, original),
      previousSession: null,
      variant: "standard",
    })
    const replacement = runtimeFixture({ rawSeed: SECOND_SEED })
    const restarted = await openFreshMatchSession({
      ...dependencies(profile, replacement),
      previousSession: session,
      variant: "standard",
    })
    test.onTestFinished(() => restarted.close())
    expect(original.close).toHaveBeenCalledOnce()
    expect(replacement.openRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        setup: session.match.startingPosition,
        opponentPolicyFingerprint: session.match.opponentPolicyFingerprint,
      }),
    )
    expect(restarted.match.matchId).not.toBe(session.match.matchId)
    expect(requireProfile(profile.actor).activeMatch).toEqual(restarted.match)
  })

  it("resumes an existing owned record rather than overwrite it with a new request", async (test) => {
    const fixture = runtimeFixture()
    const record = buildFreshMatch({
      autoHintMode: "no-auto-hints",
      playerEloAtStart: 100,
      runtime: fixture.runtime,
    })
    const profile = await openProfile(test, {
      ...createInitialMapachessPlayerData(),
      activeMatch: record,
    })
    const session = await openFreshMatchSession({
      ...dependencies(profile, fixture),
      previousSession: null,
      variant: "chess960",
    })
    test.onTestFinished(() => session.close())
    expect(session.clockStartsOnArrival).toBe(false)
    expect(requireProfile(profile.actor).activeMatch).toEqual(record)
  })

  it("waits for durable writes before clearing only its own accepted match", async (test) => {
    const profile = await openProfile(test)
    const fixture = runtimeFixture()
    const session = await openFreshMatchSession({
      ...dependencies(profile, fixture),
      previousSession: null,
      variant: "standard",
    })
    const gate = Promise.withResolvers<void>()
    const commit = profile.store.commitCurrent.bind(profile.store)
    vi.spyOn(profile.store, "commitCurrent").mockImplementationOnce(
      async (...args) => {
        await gate.promise
        return commit(...args)
      },
    )
    profile.actor.send({
      type: "PROFILE.MOVE_REACTION_PLACEMENT_CHANGED",
      placement: "bottom",
    })
    const leaving = returnMatchSessionToMenu({
      profileActor: profile.actor,
      session,
      signal: signal(),
    })
    try {
      await vi.waitFor(() => expect(fixture.close).toHaveBeenCalledOnce())
      expect(requireProfile(profile.actor).activeMatch?.matchId).toBe(
        session.match.matchId,
      )
    } finally {
      gate.resolve()
    }
    await leaving
    expect(requireProfile(profile.actor).activeMatch).toBeNull()
    expect(requireProfile(profile.actor).settings.moveReactionPlacement).toBe(
      "bottom",
    )
  })

  it("does not clear a replacement accepted after this session opened", async (test) => {
    const profile = await openProfile(test)
    const fixture = runtimeFixture()
    const session = await openFreshMatchSession({
      ...dependencies(profile, fixture),
      previousSession: null,
      variant: "standard",
    })
    const replacement = runtimeFixture({ rawSeed: SECOND_SEED })
    const candidate = buildFreshMatch({
      autoHintMode: "no-auto-hints",
      playerEloAtStart: 100,
      runtime: replacement.runtime,
    })
    await persistProfileActiveMatch({
      actor: profile.actor,
      candidate,
      expectedActiveMatch: requireProfile(profile.actor).activeMatch,
      signal: signal(),
    })
    await expect(
      returnMatchSessionToMenu({
        profileActor: profile.actor,
        session,
        signal: signal(),
      }),
    ).rejects.toThrow("different active match")
    expect(requireProfile(profile.actor).activeMatch).toEqual(candidate)
    expect(replacement.close).not.toHaveBeenCalled()
  })

  it("rejects Resume when the accepted profile has no active match", async (test) => {
    const profile = await openProfile(test)
    const fixture = runtimeFixture()
    await expect(
      openCurrentMatchSession(dependencies(profile, fixture)),
    ).rejects.toThrow("no active match")
    expect(fixture.openRuntime).not.toHaveBeenCalled()
  })

  it.for(["retry", "abort"] as const)(
    "preserves failed legacy backfill until explicit %s",
    async (action, test) => {
      const fixture = runtimeFixture()
      const record = {
        ...buildFreshMatch({
          autoHintMode: "no-auto-hints",
          playerEloAtStart: 100,
          runtime: fixture.runtime,
        }),
      }
      delete record.ratedOpponentElo
      const profile = await openProfile(test, {
        ...createInitialMapachessPlayerData(),
        activeMatch: record,
      })
      const before = profile.read()
      vi.spyOn(profile.store, "commitCurrent").mockRejectedValueOnce(
        new Error("Interrupted storage"),
      )
      const controller = new AbortController()
      const opening = openCurrentMatchSession({
        ...dependencies(profile, fixture),
        signal: controller.signal,
      })
      await waitFor(profile.actor, (state) =>
        state.matches("persistenceFailure"),
      )
      expect(profile.read()).toEqual(before)
      expect(fixture.close).not.toHaveBeenCalled()
      if (action === "abort") {
        controller.abort()
        await expect(opening).rejects.toMatchObject({ name: "AbortError" })
        expect(fixture.close).toHaveBeenCalledOnce()
        expect(profile.read()).toEqual(before)
      } else {
        profile.actor.send({ type: "PROFILE.PERSISTENCE_RETRY_REQUESTED" })
        const session = await opening
        test.onTestFinished(() => session.close())
        expect(session.match.ratedOpponentElo).toBe(100)
        expect(requireProfile(profile.actor).activeMatch).toEqual(session.match)
        expect(fixture.openRuntime).toHaveBeenCalledOnce()
      }
    },
  )

  it("uses the supplied clock when pausing and persisting a Bullet session", async (test) => {
    const bullet = TIME_CONTROL_PRESETS.find(({ id }) => id === "1+0")
    if (bullet === undefined)
      throw new Error("The fixture requires Bullet 1+0.")
    const profile = await openProfile(test)
    const fixture = runtimeFixture()
    const session = await openFreshMatchSession({
      ...dependencies(profile, fixture),
      previousSession: null,
      variant: "standard",
      timeControl: bullet.control,
    })
    test.onTestFinished(() => session.close())
    expect(session.actor.getSnapshot().context.monotonicClock).toBe(
      monotonicClock,
    )
    session.actor.send({ type: "MATCH.CLOCK_RESUME_REQUESTED" })
    expect(session.actor.getSnapshot().context.clock?.startedAt).toBe(1234)
    session.actor.send({ type: "MATCH.CLOCK_PAUSE_REQUESTED" })
    await waitFor(
      profile.actor,
      (state) =>
        selectCurrentPlayerData(state)?.activeMatch?.clock?.paused === true,
    )
    expect(requireProfile(profile.actor).activeMatch?.clock).toMatchObject({
      paused: true,
    })
    expect(session.match.currentFen).toBe(
      createInitialMatchPosition(session.match.startingPosition).fen,
    )
  })
})
