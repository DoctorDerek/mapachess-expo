import { describe, expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import { DEFAULT_CHALLENGE_SETUP } from "@mapachess/match/challenge-setup"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import type { MatchMode } from "@mapachess/match/durable-match-record"
import matchMachine from "@mapachess/match/match-machine"
import {
  createInitialMatchPosition,
  type MatchColor,
  type MatchStartingPosition,
} from "@mapachess/match/match-position"
import createMatchSetupForMode, {
  MATCH_MODE_CHOICES,
  type MatchSetup,
} from "@mapachess/match/match-setup"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import { chickenMatchId } from "../chicken/chickenOpponent"
import { buildFreshWebMatch } from "./webDurableMatch"
import type { WebMatchRuntime } from "./webMatchRuntime"
import webMatchSessionMachine, {
  selectWebMatchSession,
  selectWebMatchSessionFailure,
  type WebMatchSession,
  type WebMatchSessionOperations,
} from "./webMatchSessionMachine"

const createSession = (
  seed: string,
  startingPosition: MatchStartingPosition = {
    variant: "standard",
    chess960PositionId: null,
  },
  mode: MatchMode = "story",
  playerColor: MatchColor = "white",
): WebMatchSession => {
  const matchSeed = parseDeterministicRandomSeed(seed, "web session test seed")
  const runtime = Object.freeze({
    close: vi.fn(async () => undefined),
    engineIdentity: Object.freeze({
      author: "Web session test",
      name: "Web session test engine",
      optionNames: Object.freeze([]),
    }),
    hintAnalyst: Object.freeze({
      analyze: vi.fn(async () => {
        throw new Error("Web session test does not request hints.")
      }),
    }),
    matchId: chickenMatchId(matchSeed, startingPosition, { mode, playerColor }),
    matchSeed,
    opponent: Object.freeze({
      selectMove: vi.fn(async () => {
        throw new Error("Web session test does not request opponent moves.")
      }),
    }),
    opponentPolicyFingerprint: "web-session-test-policy",
    opponentId: "chicken-stockfish",
    playerColor,
    startingPosition,
    positionEvaluator: vi.fn(async () => {
      throw new Error("Web session test does not request evaluation.")
    }),
  }) satisfies WebMatchRuntime
  const match = buildFreshWebMatch({
    autoHintMode: "auto-move-hints",
    mode,
    playerEloAtStart: 100,
    runtime,
  })

  return Object.freeze({
    actor: createActor(matchMachine, {
      input: {
        autoHintMode: "no-auto-hints",
        durability: { type: "ephemeral" },
        initialPosition: createInitialMatchPosition(startingPosition),
        matchId: match.matchId,
        opponent: runtime.opponent,
        playerColor: runtime.playerColor,
      },
    }),
    close: vi.fn(async () => undefined),
    evaluationActor: createActor(positionEvaluationMachine, {
      input: { evaluator: runtime.positionEvaluator },
    }),
    match,
    runtime,
  })
}

const operations = (
  overrides: Partial<WebMatchSessionOperations> = {},
): WebMatchSessionOperations => ({
  openCurrentMatch: vi.fn(async () =>
    createSession("00000001000000020000000300000004"),
  ),
  openFreshMatch: vi.fn(async () =>
    createSession("00000005000000060000000700000008"),
  ),
  returnToMenu: vi.fn(async () => undefined),
  ...overrides,
})

describe("web match session machine", () => {
  it.each([0, 959])(
    "retains Challenge color and position %i through opening retry and restart",
    async (positionId) => {
      const layout = parseChess960PositionId(positionId)
      if (!layout.ok) throw new Error("Invalid test layout")
      const startingPosition = {
        variant: "chess960",
        chess960PositionId: layout.positionId,
      } as const
      const setup: MatchSetup = {
        mode: "challenge",
        challengeSetup: { ...startingPosition, playerColor: "black" },
      }
      const fresh = createSession(
        "00000001000000020000000300000004",
        startingPosition,
        "challenge",
        "black",
      )
      const replacement = createSession(
        "00000005000000060000000700000008",
        startingPosition,
        "challenge",
        "black",
      )
      const openFreshMatch = vi
        .fn<WebMatchSessionOperations["openFreshMatch"]>()
        .mockRejectedValueOnce(new Error("opening interrupted"))
        .mockResolvedValueOnce(fresh)
        .mockResolvedValueOnce(replacement)
      const actor = createActor(webMatchSessionMachine, {
        input: {
          activeMatchExists: false,
          operations: operations({ openFreshMatch }),
        },
      }).start()
      actor.send({ type: "WEB_MATCH_SESSION.SETUP_REQUESTED", setup })
      actor.send({
        type: "WEB_MATCH_SESSION.MATCH_REQUESTED",
        setup,
      })
      await waitFor(actor, (snapshot) => snapshot.matches("failed"))
      actor.send({ type: "WEB_MATCH_SESSION.RETRY_REQUESTED" })
      await waitFor(actor, (snapshot) => snapshot.matches("active"))
      expect(openFreshMatch).toHaveBeenNthCalledWith(
        1,
        null,
        setup,
        expect.any(AbortSignal),
      )
      expect(openFreshMatch).toHaveBeenNthCalledWith(
        2,
        null,
        setup,
        expect.any(AbortSignal),
      )
      actor.send({ type: "WEB_MATCH_SESSION.RESTART_REQUESTED" })
      await waitFor(
        actor,
        (snapshot) =>
          snapshot.matches("active") &&
          snapshot.context.session === replacement,
      )
      expect(openFreshMatch).toHaveBeenNthCalledWith(
        3,
        fresh,
        setup,
        expect.any(AbortSignal),
      )
      actor.stop()
    },
  )

  it("routes a profile without an active match to the four-mode menu", () => {
    const actor = createActor(webMatchSessionMachine, {
      input: { activeMatchExists: false, operations: operations() },
    }).start()

    expect(actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(true)
    expect(selectWebMatchSession(actor.getSnapshot())).toBeNull()
    actor.stop()
  })

  it.each(MATCH_MODE_CHOICES)(
    "opens $title only after confirming its setup",
    async (selection) => {
      const setup = createMatchSetupForMode(selection, DEFAULT_CHALLENGE_SETUP)
      const layout = parseChess960PositionId(518)
      if (!layout.ok) throw new Error("Invalid test layout")
      const freshSession = createSession(
        "00000005000000060000000700000008",
        selection.variant === "standard"
          ? { variant: "standard", chess960PositionId: null }
          : { variant: "chess960", chess960PositionId: layout.positionId },
        selection.mode,
      )
      const openFreshMatch = vi
        .fn<WebMatchSessionOperations["openFreshMatch"]>()
        .mockResolvedValue(freshSession)
      const actor = createActor(webMatchSessionMachine, {
        input: {
          activeMatchExists: false,
          operations: operations({ openFreshMatch }),
        },
      }).start()

      actor.send({ type: "WEB_MATCH_SESSION.MATCH_REQUESTED", setup })
      expect(actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(true)
      expect(openFreshMatch).not.toHaveBeenCalled()
      actor.send({ type: "WEB_MATCH_SESSION.SETUP_REQUESTED", setup })
      expect(actor.getSnapshot().matches({ menu: "setup" })).toBe(true)
      expect(openFreshMatch).not.toHaveBeenCalled()
      actor.send({ type: "WEB_MATCH_SESSION.MAIN_MENU_REQUESTED" })
      expect(actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(true)
      actor.send({ type: "WEB_MATCH_SESSION.SETUP_REQUESTED", setup })
      actor.send({
        type: "WEB_MATCH_SESSION.MATCH_REQUESTED",
        setup,
      })
      await waitFor(actor, (snapshot) => snapshot.matches("active"))

      expect(openFreshMatch).toHaveBeenCalledOnce()
      expect(openFreshMatch).toHaveBeenCalledWith(
        null,
        setup,
        expect.any(AbortSignal),
      )
      expect(selectWebMatchSession(actor.getSnapshot())).toBe(freshSession)
      actor.stop()
    },
  )

  it("resumes a verified active match during initial routing", async () => {
    const currentSession = createSession("00000001000000020000000300000004")
    const openCurrentMatch = vi.fn(async () => currentSession)
    const actor = createActor(webMatchSessionMachine, {
      input: {
        activeMatchExists: true,
        operations: operations({ openCurrentMatch }),
      },
    }).start()

    await waitFor(actor, (snapshot) => snapshot.matches("active"))

    expect(openCurrentMatch).toHaveBeenCalledOnce()
    expect(selectWebMatchSession(actor.getSnapshot())).toBe(currentSession)
    actor.stop()
  })

  it("replaces the active session during restart", async () => {
    const currentSession = createSession("00000001000000020000000300000004")
    const replacementSession = createSession("00000005000000060000000700000008")
    const openFreshMatch = vi.fn(
      async (previousSession: WebMatchSession | null) => {
        await previousSession?.close()
        return replacementSession
      },
    )
    const actor = createActor(webMatchSessionMachine, {
      input: {
        activeMatchExists: true,
        operations: operations({
          openCurrentMatch: vi.fn(async () => currentSession),
          openFreshMatch,
        }),
      },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("active"))

    actor.send({ type: "WEB_MATCH_SESSION.RESTART_REQUESTED" })
    await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches("active") &&
        selectWebMatchSession(snapshot) === replacementSession,
    )

    expect(openFreshMatch.mock.calls[0]?.[0]).toBe(currentSession)
    expect(currentSession.close).toHaveBeenCalledOnce()
    actor.stop()
  })

  it("closes the active session and returns to its setup without opening another match", async () => {
    const currentSession = createSession("00000001000000020000000300000004")
    const returnToMenu = vi.fn(async (session: WebMatchSession) => {
      await session.close()
    })
    const actor = createActor(webMatchSessionMachine, {
      input: {
        activeMatchExists: true,
        operations: operations({
          openCurrentMatch: vi.fn(async () => currentSession),
          returnToMenu,
        }),
      },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("active"))

    actor.send({ type: "WEB_MATCH_SESSION.RETURN_TO_MENU_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches({ menu: "setup" }))

    expect(returnToMenu).toHaveBeenCalledWith(
      currentSession,
      expect.any(AbortSignal),
    )
    expect(currentSession.close).toHaveBeenCalledOnce()
    expect(selectWebMatchSession(actor.getSnapshot())).toBeNull()
    expect(actor.getSnapshot().context.requestedSetup).toEqual({
      mode: "story",
      variant: "standard",
    })
    actor.stop()
  })

  it("retries the exact operation that failed", async () => {
    const currentSession = createSession("00000001000000020000000300000004")
    const replacementSession = createSession("00000005000000060000000700000008")
    const restartFailure = new Error("restart failed")
    const openFreshMatch = vi
      .fn<WebMatchSessionOperations["openFreshMatch"]>()
      .mockRejectedValueOnce(restartFailure)
      .mockResolvedValueOnce(replacementSession)
    const actor = createActor(webMatchSessionMachine, {
      input: {
        activeMatchExists: true,
        operations: operations({
          openCurrentMatch: vi.fn(async () => currentSession),
          openFreshMatch,
        }),
      },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("active"))

    actor.send({ type: "WEB_MATCH_SESSION.RESTART_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("failed"))
    expect(selectWebMatchSessionFailure(actor.getSnapshot())).toEqual({
      cause: restartFailure,
      operation: "restart-match",
    })

    actor.send({ type: "WEB_MATCH_SESSION.RETRY_REQUESTED" })
    await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches("active") &&
        selectWebMatchSession(snapshot) === replacementSession,
    )
    expect(openFreshMatch).toHaveBeenCalledTimes(2)
    actor.stop()
  })
})
