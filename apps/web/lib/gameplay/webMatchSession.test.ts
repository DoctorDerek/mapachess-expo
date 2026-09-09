import { webcrypto } from "node:crypto"
import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"
import { waitFor } from "xstate"
import type { ChallengeSetup } from "@mapachess/match/challenge-setup"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import type { MatchStartingPosition } from "@mapachess/match/match-position"
import SerializedPlayerDataStore from "@mapachess/profile/durable-store"
import createInitialMapachessPlayerData from "@mapachess/profile/player-data"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import { persistProfileActiveMatch } from "@mapachess/profile/profile-match-persistence"
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
  legacyChickenWebPolicy,
} from "./webOpponentPolicy"

const FIRST_MATCH_SEED = "00000001000000020000000300000004"
const SECOND_MATCH_SEED = "00000005000000060000000700000008"

const openProfileRuntime = async (
  chess960StoryElo?: number,
  indexedDb = new IDBFactory(),
) => {
  if (chess960StoryElo !== undefined) {
    const adapter = new IndexedDbDurableStore(indexedDb)
    const store = new SerializedPlayerDataStore(adapter, (value) =>
      webSha256(value, webcrypto.subtle),
    )
    const initial = createInitialMapachessPlayerData()
    const saved = await store.commitCurrent(await store.load(), {
      ...initial,
      ratings: {
        ...initial.ratings,
        standardStory: 450,
        chess960Story: chess960StoryElo,
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
  policyFingerprint = legacyChickenWebPolicy(startingPosition.variant)
    .fingerprint,
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
    matchId: webMatchId(matchSeed, startingPosition, selection),
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
    opponentId: "chicken-stockfish",
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
  it.each([
    ["standard", "legacy"],
    ["standard", "measured"],
    ["chess960", "legacy"],
    ["chess960", "measured"],
  ] as const)(
    "retains the exact %s %s policy through durable reload and restart",
    async (variant, generation) => {
      const parsed = parseChess960PositionId(959)
      if (!parsed.ok) throw new Error("Invalid test layout")
      const startingPosition: MatchStartingPosition =
        variant === "standard"
          ? { variant, chess960PositionId: null }
          : { variant, chess960PositionId: parsed.positionId }
      const policy =
        generation === "legacy"
          ? legacyChickenWebPolicy(variant)
          : await resolveWebOpponentPolicy("chicken-stockfish", variant)
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

  it("preserves a save with an unsupported policy without opening workers or replacing player data", async () => {
    const profile = await openProfileRuntime()
    const engine = createRuntime(FIRST_MATCH_SEED)
    const candidate = buildFreshWebMatch({
      autoHintMode: "no-auto-hints",
      playerEloAtStart: 100,
      runtime: {
        ...engine.runtime,
        opponentPolicyFingerprint: "unsupported-policy",
      },
    })
    await persistProfileActiveMatch({
      actor: profile.actor,
      candidate,
      expectedActiveMatch: null,
      signal: new AbortController().signal,
    })
    const before = selectCurrentPlayerData(profile.actor.getSnapshot())
    const openRuntime = runtimeOpener(engine.runtime)
    await expect(
      openCurrentWebMatchSession({
        openRuntime,
        profileActor: profile.actor,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("Saved opponent policy")
    expect(openRuntime).not.toHaveBeenCalled()
    expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(before)
    await profile.close()
  })

  it.each(["standard", "chess960"] as const)(
    "persists and reloads %s Challenge with chosen Black and its independent rating",
    async (variant) => {
      const layout = parseChess960PositionId(959)
      if (!layout.ok) throw new Error("Invalid test layout")
      const startingPosition: MatchStartingPosition =
        variant === "standard"
          ? { variant, chess960PositionId: null }
          : { variant, chess960PositionId: layout.positionId }
      const challengeSetup: ChallengeSetup = {
        ...startingPosition,
        playerColor: "black",
      }
      const selection = { mode: "challenge", playerColor: "black" } as const
      const indexedDb = new IDBFactory()
      const profile = await openProfileRuntime(725, indexedDb)
      const engine = createRuntime(
        FIRST_MATCH_SEED,
        startingPosition,
        selection,
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
        setup: startingPosition,
        signal: expect.any(AbortSignal),
      })
      expect(first.match).toMatchObject({
        mode: "challenge",
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
        createRuntime(FIRST_MATCH_SEED, startingPosition, selection).runtime,
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
        opponentId: "chicken-stockfish",
        opponentPolicyFingerprint: legacyChickenWebPolicy(
          startingPosition.variant,
        ).fingerprint,
      })
      expect(resumed.match).toEqual(saved?.activeMatch)
      const restartOpener = runtimeOpener(
        createRuntime(SECOND_MATCH_SEED, startingPosition, selection).runtime,
      )
      const restarted = await openFreshWebMatchSession({
        mode: "challenge",
        challengeSetup,
        previousSession: resumed,
        openRuntime: restartOpener,
        profileActor: reloaded.actor,
        signal: new AbortController().signal,
      })
      expect(restartOpener).toHaveBeenCalledWith({
        ...selection,
        setup: startingPosition,
        signal: expect.any(AbortSignal),
        opponentId: "chicken-stockfish",
        opponentPolicyFingerprint: legacyChickenWebPolicy(
          startingPosition.variant,
        ).fingerprint,
      })
      expect(restarted.match).toMatchObject({
        mode: "challenge",
        playerColor: "black",
        matchSeed: SECOND_MATCH_SEED,
        startingPosition,
      })
      expect(
        selectCurrentPlayerData(reloaded.actor.getSnapshot())?.ratings,
      ).toEqual(saved?.ratings)
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
      variant: "chess960",
      chess960PositionId: null,
      playerColor: "white",
    }
    const selection = { mode: "challenge", playerColor: "white" } as const
    const profile = await openProfileRuntime()
    const opener = runtimeOpener(
      createRuntime(FIRST_MATCH_SEED, startingPosition, selection).runtime,
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
      setup: { variant: "chess960" },
      signal: expect.any(AbortSignal),
    })
    const restarted = await openFreshWebMatchSession({
      mode: "challenge",
      challengeSetup,
      previousSession: first,
      openRuntime: runtimeOpener(
        createRuntime(SECOND_MATCH_SEED, startingPosition, selection).runtime,
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
        createRuntime(SECOND_MATCH_SEED, startingPosition, selection).runtime,
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
      variant: "standard",
      playerColor: "black",
      chess960PositionId: null,
    } as const
    const engine = createRuntime(
      FIRST_MATCH_SEED,
      { variant: "standard", chess960PositionId: null },
      { mode: "challenge", playerColor: "black" },
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
      opponentPolicyFingerprint: legacyChickenWebPolicy(
        startingPosition.variant,
      ).fingerprint,
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
      opponentPolicyFingerprint: legacyChickenWebPolicy(
        startingPosition.variant,
      ).fingerprint,
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
      opponentPolicyFingerprint: legacyChickenWebPolicy("standard").fingerprint,
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
      opponentPolicyFingerprint: legacyChickenWebPolicy("standard").fingerprint,
    })
    expect(resumedSession.match).toEqual(acceptedMatch)
    await resumedSession.close()
    await profileRuntime.close()
  })
})
