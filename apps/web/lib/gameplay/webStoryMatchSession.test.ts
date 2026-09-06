import { webcrypto } from "node:crypto"
import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"
import { waitFor } from "xstate"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import type { MatchStartingPosition } from "@mapachess/match/match-position"
import SerializedPlayerDataStore from "@mapachess/profile/durable-store"
import createInitialMapachessPlayerData from "@mapachess/profile/player-data"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import { persistProfileActiveMatch } from "@mapachess/profile/profile-match-persistence"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import {
  chickenMatchId,
  chickenPolicyFingerprint,
  selectStoryPlayerColor,
} from "../chicken/chickenOpponent"
import IndexedDbDurableStore from "../profile/IndexedDbDurableStore"
import openWebProfileRuntime from "../profile/openWebProfileRuntime"
import webSha256 from "../profile/webSha256"
import type { OpenWebMatchRuntimeInput } from "./openWebMatchRuntime"
import type { WebMatchRuntime } from "./webMatchRuntime"
import { buildFreshWebStoryMatch } from "./webStoryDurableMatch"
import {
  openCurrentWebStoryMatchSession,
  openFreshWebStoryMatchSession,
  returnWebStoryMatchSessionToMenu,
} from "./webStoryMatchSession"

const FIRST_MATCH_SEED = "00000001000000020000000300000004"
const SECOND_MATCH_SEED = "00000005000000060000000700000008"

const openProfileRuntime = async (chess960StoryElo?: number) => {
  const indexedDb = new IDBFactory()
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
    matchId: chickenMatchId(matchSeed, startingPosition),
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
    opponentPolicyFingerprint: chickenPolicyFingerprint(
      startingPosition.variant,
    ),
    opponentId: "chicken-stockfish",
    playerColor: selectStoryPlayerColor(matchSeed),
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

describe("web Story match session ownership", () => {
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
    const first = await openFreshWebStoryMatchSession({
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
    const resumed = await openCurrentWebStoryMatchSession({
      openRuntime: resumedOpener,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })
    expect(resumedOpener).toHaveBeenCalledWith({
      matchSeed: FIRST_MATCH_SEED,
      setup: startingPosition,
      signal: expect.any(AbortSignal),
    })
    expect(resumed.match).toEqual(first.match)
    const restartOpener = runtimeOpener(
      createRuntime(SECOND_MATCH_SEED, startingPosition).runtime,
    )
    const restarted = await openFreshWebStoryMatchSession({
      variant: "chess960",
      previousSession: resumed,
      openRuntime: restartOpener,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })
    expect(restartOpener).toHaveBeenCalledWith({
      setup: startingPosition,
      signal: expect.any(AbortSignal),
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
    const session = await openFreshWebStoryMatchSession({
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
    const firstSession = await openFreshWebStoryMatchSession({
      variant: "standard",
      openRuntime: runtimeOpener(firstRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    const secondSession = await openFreshWebStoryMatchSession({
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
    const initialSession = await openFreshWebStoryMatchSession({
      variant: "standard",
      openRuntime: runtimeOpener(initialRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })
    await initialSession.close()
    const resumedRuntime = createRuntime(FIRST_MATCH_SEED)
    const openRuntime = runtimeOpener(resumedRuntime.runtime)

    const resumedSession = await openCurrentWebStoryMatchSession({
      openRuntime,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    expect(openRuntime).toHaveBeenCalledWith({
      matchSeed: FIRST_MATCH_SEED,
      signal: expect.any(AbortSignal),
      setup: { variant: "standard", chess960PositionId: null },
    })
    expect(resumedSession.match).toEqual(initialSession.match)
    await resumedSession.close()
    await profileRuntime.close()
  })

  it("closes the session before clearing its verified active match", async () => {
    const profileRuntime = await openProfileRuntime()
    const engineRuntime = createRuntime(FIRST_MATCH_SEED)
    const session = await openFreshWebStoryMatchSession({
      variant: "standard",
      openRuntime: runtimeOpener(engineRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    await returnWebStoryMatchSessionToMenu({
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
    const firstSession = await openFreshWebStoryMatchSession({
      variant: "standard",
      openRuntime: runtimeOpener(firstRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })
    await firstSession.close()

    const acceptedRuntime = createRuntime(SECOND_MATCH_SEED)
    const acceptedMatch = buildFreshWebStoryMatch({
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

    const resumedSession = await openFreshWebStoryMatchSession({
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
    })
    expect(resumedSession.match).toEqual(acceptedMatch)
    await resumedSession.close()
    await profileRuntime.close()
  })
})
