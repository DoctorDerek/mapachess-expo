import { webcrypto } from "node:crypto"
import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"
import { waitFor } from "xstate"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import { persistProfileActiveMatch } from "@mapachess/profile/profile-match-persistence"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import type { WebMatchRuntime } from "../gameplay/webMatchRuntime"
import openWebProfileRuntime from "../profile/openWebProfileRuntime"
import type { OpenStandardChickenRuntimeInput } from "./openStandardChickenRuntime"
import { buildFreshStandardChickenMatch } from "./standardChickenDurableMatch"
import {
  selectStandardStoryPlayerColor,
  STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
  standardChickenMatchId,
} from "./standardChickenOpponent"
import {
  openCurrentStandardChickenMatchSession,
  openFreshStandardChickenMatchSession,
  returnStandardChickenMatchSessionToMenu,
} from "./standardChickenWebMatchSession"

const FIRST_MATCH_SEED = "00000001000000020000000300000004"
const SECOND_MATCH_SEED = "00000005000000060000000700000008"

const openCompletedProfileRuntime = async () => {
  const runtime = openWebProfileRuntime({
    indexedDb: new IDBFactory(),
    subtleCrypto: webcrypto.subtle,
  })
  await waitFor(runtime.actor, (snapshot) => snapshot.matches("firstRun"))
  runtime.actor.send({
    enabled: false,
    type: "PROFILE.AUTO_HINTS_CHOICE_CONFIRMED",
  })
  await waitFor(runtime.actor, (snapshot) => snapshot.matches("ready"))
  return runtime
}

const createRuntime = (seed: string) => {
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
    matchId: standardChickenMatchId(matchSeed),
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
    opponentPolicyFingerprint: STANDARD_CHICKEN_WEB_POLICY_FINGERPRINT,
    playerColor: selectStandardStoryPlayerColor(matchSeed),
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
  vi.fn(async (_input?: OpenStandardChickenRuntimeInput) => runtime)

describe("Standard Chicken web match session ownership", () => {
  it("persists a fresh session and closes every owned resource once", async () => {
    const profileRuntime = await openCompletedProfileRuntime()
    const engineRuntime = createRuntime(FIRST_MATCH_SEED)
    const session = await openFreshStandardChickenMatchSession({
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
    const profileRuntime = await openCompletedProfileRuntime()
    const firstRuntime = createRuntime(FIRST_MATCH_SEED)
    const secondRuntime = createRuntime(SECOND_MATCH_SEED)
    const firstSession = await openFreshStandardChickenMatchSession({
      openRuntime: runtimeOpener(firstRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    const secondSession = await openFreshStandardChickenMatchSession({
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
    const profileRuntime = await openCompletedProfileRuntime()
    const initialRuntime = createRuntime(FIRST_MATCH_SEED)
    const initialSession = await openFreshStandardChickenMatchSession({
      openRuntime: runtimeOpener(initialRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })
    await initialSession.close()
    const resumedRuntime = createRuntime(FIRST_MATCH_SEED)
    const openRuntime = runtimeOpener(resumedRuntime.runtime)

    const resumedSession = await openCurrentStandardChickenMatchSession({
      openRuntime,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    expect(openRuntime).toHaveBeenCalledWith({
      matchSeed: FIRST_MATCH_SEED,
      signal: expect.any(AbortSignal),
    })
    expect(resumedSession.match).toEqual(initialSession.match)
    await resumedSession.close()
    await profileRuntime.close()
  })

  it("closes the session before clearing its verified active match", async () => {
    const profileRuntime = await openCompletedProfileRuntime()
    const engineRuntime = createRuntime(FIRST_MATCH_SEED)
    const session = await openFreshStandardChickenMatchSession({
      openRuntime: runtimeOpener(engineRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    await returnStandardChickenMatchSessionToMenu({
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
    const profileRuntime = await openCompletedProfileRuntime()
    const firstRuntime = createRuntime(FIRST_MATCH_SEED)
    const firstSession = await openFreshStandardChickenMatchSession({
      openRuntime: runtimeOpener(firstRuntime.runtime),
      previousSession: null,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })
    await firstSession.close()

    const acceptedRuntime = createRuntime(SECOND_MATCH_SEED)
    const acceptedMatch = buildFreshStandardChickenMatch({
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

    const resumedSession = await openFreshStandardChickenMatchSession({
      openRuntime,
      previousSession: firstSession,
      profileActor: profileRuntime.actor,
      signal: new AbortController().signal,
    })

    expect(openRuntime).toHaveBeenCalledWith({
      matchSeed: SECOND_MATCH_SEED,
      signal: expect.any(AbortSignal),
    })
    expect(resumedSession.match).toEqual(acceptedMatch)
    await resumedSession.close()
    await profileRuntime.close()
  })
})
