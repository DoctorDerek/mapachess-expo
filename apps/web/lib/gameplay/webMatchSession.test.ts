import { webcrypto } from "node:crypto"
import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"
import { waitFor } from "xstate"
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
import { deriveRetainedBranchConclusion } from "@mapachess/match/match-conclusion"
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
import SerializedPlayerDataStore from "@mapachess/profile/durable-store"
import createInitialMapachessPlayerData from "@mapachess/profile/player-data"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import { persistProfileActiveMatch } from "@mapachess/profile/profile-match-persistence"
import {
  selectDefaultStoryOpponent,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import IndexedDbDurableStore from "../profile/IndexedDbDurableStore"
import openWebProfileRuntime from "../profile/openWebProfileRuntime"
import webSha256 from "../profile/webSha256"
import type { OpenWebMatchRuntimeInput } from "./openWebMatchRuntime"
import { buildFreshWebMatch } from "./webDurableMatch"
import type { WebMatchRuntime } from "./webMatchRuntime"
import {
  openCurrentWebMatchSession,
  openFreshWebMatchSession,
  returnWebMatchSessionToMenu,
} from "./webMatchSession"
import { selectStoryPlayerColor, webMatchId } from "./webOpponent"
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
        standardStory: 450,
        chess960Story: chess960StoryElo ?? initial.ratings.chess960Story,
        standardChallenge: 600,
        chess960Challenge: 800,
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
  selection: NonNullable<Parameters<typeof webMatchId>[2]> = {
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
    matchId: webMatchId(matchSeed, startingPosition, selection, opponentId),
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

describe("web match session ownership", () => {
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
    { ...DEFAULT_CHALLENGE_SETUP, difficultyTargetElo: 1100 },
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
    "saves, reloads and restarts all ten earned %s opponents without losing medals or the other ladder",
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
        expect(reloaded?.ratings).toEqual(initialRatings)
        if (progress === undefined)
          throw new Error("Story progress must remain available")
        expect(selectDefaultStoryOpponent(progress, variant)).toBe(
          IMPLEMENTED_DURABLE_OPPONENT_IDS[Math.min(index + 1, 9)],
        )
      }
      await profile.close()
    },
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
    "resumes $variant $mode with current difficulty without clearing its board, hints or profile",
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
      const resumed = await openCurrentWebMatchSession({
        openRuntime,
        profileActor: profile.actor,
        signal: new AbortController().signal,
      })
      const currentMatch = {
        ...candidate,
        opponentPolicyFingerprint: policy.fingerprint,
      }
      expect(resumed.match).toEqual(currentMatch)
      expect(
        resumed.actor.getSnapshot().context.timeline.transitions,
      ).toHaveLength(2)
      expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual({
        ...before,
        activeMatch: currentMatch,
        revision: before.revision + 1,
      })
      expect(openRuntime).toHaveBeenCalledWith(
        expect.objectContaining({
          opponentPolicyFingerprint: "obsolete-policy",
          matchSeed: FIRST_MATCH_SEED,
          setup: startingPosition,
        }),
      )
      await resumed.close()
      await profile.close()
    },
  )

  it("closes the runtime and retains the saved match when a policy refresh is aborted", async () => {
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

  it.each(["standard", "chess960"] as const)(
    "persists and reloads %s Challenge with a globally earned Bunny, 1000 preset, chosen Black and independent rating",
    async (variant) => {
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
        playerColor: "black",
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
        previousSession: null,
        openRuntime: opener,
        profileActor: profile.actor,
        signal: new AbortController().signal,
      })
      expect(opener).toHaveBeenCalledWith({
        ...selection,
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
        playerEloAtStart: variant === "standard" ? 600 : 800,
      })
      await first.close()
      await waitFor(profile.actor, (snapshot) => snapshot.matches("ready"))
      const saved = selectCurrentPlayerData(profile.actor.getSnapshot())
      expect(saved?.settings.challengeSetup).toEqual(challengeSetup)
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
        matchSeed: FIRST_MATCH_SEED,
        setup: startingPosition,
        signal: expect.any(AbortSignal),
        opponentId: "bunny-stockfish",
        opponentPolicyFingerprint: policy.fingerprint,
      })
      expect(resumed.match).toEqual(saved?.activeMatch)
      expect(resumed.runtime.opponentTargetElo).toBe(1000)
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
