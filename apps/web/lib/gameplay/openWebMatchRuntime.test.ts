import { describe, expect, it, vi } from "vitest"
import { POSITION_EVALUATION_NODE_LIMIT } from "@mapachess/evaluation/position-evaluator"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import type {
  StockfishEngineConfiguration,
  StockfishSearchRequest,
} from "@mapachess/stockfish/engine-session"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import type {
  StockfishUciIdentity,
  StockfishUciSession,
} from "@mapachess/stockfish/uci-session"
import type { CreateWebStockfishSessionOptions } from "../stockfish/createWebStockfishSession"
import openWebMatchRuntime from "./openWebMatchRuntime"
import type { WebOpponentCryptography } from "./webOpponent"
import { webMatchId } from "./webOpponent"
import resolveWebOpponentPolicy, {
  resolveWebChallengePolicy,
} from "./webOpponentPolicy"

const ENGINE_IDENTITY: StockfishUciIdentity = Object.freeze({
  author: "the Stockfish developers",
  name: "Stockfish 18 Lite WASM",
  optionNames: Object.freeze([]),
})

const OPPONENT_CONFIGURATION: StockfishEngineConfiguration = Object.freeze({
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
  strength: Object.freeze({ kind: "full-strength" }),
  threads: 1,
  variant: "standard",
})

const HINT_CONFIGURATION: StockfishEngineConfiguration = Object.freeze({
  hashMegabytes: 16,
  multiPv: 256,
  ponder: false,
  strength: Object.freeze({ kind: "full-strength" }),
  threads: 1,
  variant: "standard",
})

const createCryptography = (): WebOpponentCryptography => {
  const getRandomValues = <Value extends ArrayBufferView<ArrayBuffer> | null>(
    array: Value,
  ): Value => {
    if (!(array instanceof Uint32Array) || array.length !== 4) {
      throw new TypeError("Test cryptography expects four Uint32 words.")
    }
    array.set([1, 2, 3, 4])
    return array
  }

  return { getRandomValues, subtle: globalThis.crypto.subtle }
}

const createSession = (
  bootBehavior: (signal?: AbortSignal) => Promise<StockfishUciIdentity>,
  closeBehavior: () => Promise<void> = async () => undefined,
) => {
  const boot = vi.fn(bootBehavior)
  const close = vi.fn(closeBehavior)
  const search = vi.fn(async (request: StockfishSearchRequest) => ({
    bestMove: "e2e4",
    informationLineCount: 1,
    latestInformation: {
      line: "info depth 1 score cp 25 pv e2e4",
      score: {
        bound: "exact" as const,
        kind: "centipawns" as const,
        value: 25,
      },
    },
    requestId: request.requestId,
  }))
  const session = {
    boot,
    close,
    search,
    state: () => "ready" as const,
  } satisfies StockfishUciSession

  return { boot, close, search, session }
}

const createSessionQueue = (sessions: readonly StockfishUciSession[]) => {
  let index = 0
  return vi.fn(
    (
      _configuration: StockfishEngineConfiguration,
      _options?: CreateWebStockfishSessionOptions,
    ): StockfishUciSession => {
      const session = sessions[index]
      index += 1
      if (session === undefined) {
        throw new Error("Test session queue is exhausted.")
      }
      return session
    },
  )
}

const openFixture = async (
  input: Parameters<typeof openWebMatchRuntime>[0],
) => {
  const sessions = [0, 1, 2].map(() =>
    createSession(async () => ENGINE_IDENTITY),
  )
  const openSession = createSessionQueue(sessions.map((entry) => entry.session))
  const runtime = await openWebMatchRuntime({
    ...input,
    cryptography: createCryptography(),
    openSession,
  })
  return { runtime, openSession }
}
describe("web match runtime ownership", () => {
  it("boots independent engine sessions together and waits for all three", async () => {
    const gates = [0, 1, 2].map(() =>
      Promise.withResolvers<StockfishUciIdentity>(),
    )
    const sessions = gates.map((gate) => createSession(() => gate.promise))
    const opened = vi.fn()
    const opening = openWebMatchRuntime({
      setup: { variant: "standard", chess960PositionId: null },
      cryptography: createCryptography(),
      openSession: createSessionQueue(sessions.map(({ session }) => session)),
    }).then((runtime) => {
      opened()
      return runtime
    })
    try {
      await vi.waitFor(() => {
        for (const session of sessions)
          expect(session.boot).toHaveBeenCalledOnce()
      })
      expect(opened).not.toHaveBeenCalled()
      gates[0]?.resolve(ENGINE_IDENTITY)
      gates[1]?.resolve(ENGINE_IDENTITY)
      await Promise.resolve()
      expect(opened).not.toHaveBeenCalled()
    } finally {
      for (const gate of gates) gate.resolve(ENGINE_IDENTITY)
    }
    const runtime = await opening
    expect(opened).toHaveBeenCalledOnce()
    await runtime.close()
    for (const session of sessions) expect(session.close).toHaveBeenCalledOnce()
  })

  it.each(["standard", "chess960"] as const)(
    "opens independent %s Challenge strength without changing analysis worker configuration",
    async (variant) => {
      const input = {
        mode: "challenge" as const,
        playerColor: "black" as const,
        opponentId: "bunny-stockfish" as const,
        difficultyTargetElo: 1000,
        setup:
          variant === "standard"
            ? { variant, chess960PositionId: null }
            : { variant },
      }
      const fixture = await openFixture(input)
      try {
        const policy = await resolveWebChallengePolicy(
          "bunny-stockfish",
          variant,
          1000,
        )
        expect(fixture.runtime).toMatchObject({
          opponentId: "bunny-stockfish",
          opponentTargetElo: 1000,
          opponentPolicyFingerprint: policy.fingerprint,
          playerColor: "black",
        })
        expect(fixture.openSession).toHaveBeenNthCalledWith(
          1,
          { ...OPPONENT_CONFIGURATION, variant },
          expect.objectContaining({
            workerName: "mapachess-stockfish-18-opponent",
          }),
        )
        expect(fixture.openSession).toHaveBeenNthCalledWith(
          2,
          { ...HINT_CONFIGURATION, variant },
          expect.objectContaining({
            workerName: "mapachess-stockfish-18-better-hints",
          }),
        )
        expect(fixture.openSession).toHaveBeenNthCalledWith(
          3,
          { ...OPPONENT_CONFIGURATION, variant },
          expect.objectContaining({
            workerName: "mapachess-stockfish-18-evaluation",
          }),
        )
      } finally {
        await fixture.runtime.close()
      }
      const openSession = createSessionQueue([])
      await expect(
        openWebMatchRuntime({
          ...input,
          difficultyTargetElo: 1100,
          openSession,
        }),
      ).rejects.toThrow("no supported web preset")
      expect(openSession).not.toHaveBeenCalled()
    },
  )
  it.each(["standard", "chess960"] as const)(
    "uses current %s settings when reopening an obsolete difficulty policy",
    async (variant) => {
      const parsed = parseChess960PositionId(959)
      if (!parsed.ok) throw new Error("Invalid test layout")
      const setup =
        variant === "standard"
          ? ({ variant, chess960PositionId: null } as const)
          : ({ variant, chess960PositionId: parsed.positionId } as const)
      const fresh = await openFixture({ setup })
      try {
        const resumed = await openFixture({
          setup,
          matchSeed: fresh.runtime.matchSeed,
          opponentId: "chicken-stockfish",
          opponentPolicyFingerprint: "obsolete-policy",
        })
        try {
          expect(fresh.runtime.opponentPolicyFingerprint).toBe(
            (await resolveWebOpponentPolicy("chicken-stockfish", variant))
              .fingerprint,
          )
          expect(resumed.runtime.opponentPolicyFingerprint).toBe(
            fresh.runtime.opponentPolicyFingerprint,
          )
          expect(resumed.runtime.matchId).toBe(fresh.runtime.matchId)
          expect(resumed.runtime.playerColor).toBe(fresh.runtime.playerColor)
          expect(resumed.runtime.startingPosition).toEqual(setup)
        } finally {
          await resumed.runtime.close()
        }
      } finally {
        await fresh.runtime.close()
      }
    },
  )

  it.each(["white", "black"] as const)(
    "honors chosen %s with an explicit Chess960 Challenge layout in all three engine sessions",
    async (playerColor) => {
      const parsed = parseChess960PositionId(959)
      if (!parsed.ok) throw new Error("Invalid test layout")
      const startingPosition = {
        variant: "chess960",
        chess960PositionId: parsed.positionId,
      } as const
      const selection = { mode: "challenge", playerColor } as const
      const opened = await openFixture({
        ...selection,
        setup: startingPosition,
      })
      try {
        expect(opened.runtime.playerColor).toBe(playerColor)
        expect(opened.runtime.startingPosition).toEqual(startingPosition)
        expect(opened.runtime.matchId).toBe(
          webMatchId(opened.runtime.matchSeed, startingPosition, selection),
        )
        expect(opened.runtime.matchId).not.toBe(
          webMatchId(opened.runtime.matchSeed, startingPosition),
        )
        expect(
          opened.openSession.mock.calls.map(
            ([configuration]) => configuration.variant,
          ),
        ).toEqual(["chess960", "chess960", "chess960"])
      } finally {
        await opened.runtime.close()
      }
    },
  )

  it("configures all three Chess960 workers and retains an explicit restart layout", async () => {
    const first = await openFixture({ setup: { variant: "chess960" } })
    const secondSeed = parseDeterministicRandomSeed(
      "ffffffffffffffffffffffffffffffff",
    )
    const restarted = await openFixture({
      setup: first.runtime.startingPosition,
      matchSeed: secondSeed,
    })
    const fresh = await openFixture({
      setup: { variant: "chess960" },
      matchSeed: secondSeed,
    })
    const resumed = await openFixture({
      setup: first.runtime.startingPosition,
      matchSeed: first.runtime.matchSeed,
    })
    try {
      expect(
        first.openSession.mock.calls.map(([configuration]) => configuration),
      ).toEqual([
        { ...OPPONENT_CONFIGURATION, variant: "chess960" },
        { ...HINT_CONFIGURATION, variant: "chess960" },
        { ...OPPONENT_CONFIGURATION, variant: "chess960" },
      ])
      expect(first.runtime.startingPosition.variant).toBe("chess960")
      expect(first.runtime.startingPosition.chess960PositionId).toBe(0)
      expect(
        first.runtime.startingPosition.chess960PositionId,
      ).toBeGreaterThanOrEqual(0)
      expect(first.runtime.startingPosition.chess960PositionId).toBeLessThan(
        960,
      )
      expect(restarted.runtime.startingPosition).toEqual(
        first.runtime.startingPosition,
      )
      expect(restarted.runtime.matchId).not.toBe(first.runtime.matchId)
      expect(fresh.runtime.startingPosition).not.toEqual(
        first.runtime.startingPosition,
      )
      expect(fresh.runtime.startingPosition.chess960PositionId).toBe(439)
      expect(restarted.runtime.playerColor).not.toBe(first.runtime.playerColor)
      expect(resumed.runtime.matchId).toBe(first.runtime.matchId)
      expect(resumed.runtime.playerColor).toBe(first.runtime.playerColor)
      expect(first.runtime.opponentPolicyFingerprint).not.toBe(
        (await resolveWebOpponentPolicy("chicken-stockfish", "standard"))
          .fingerprint,
      )
    } finally {
      await Promise.all(
        [first, restarted, fresh, resumed].map(({ runtime }) =>
          runtime.close(),
        ),
      )
    }
  })

  it("boots isolated opponent, Better Hints, and evaluation sessions", async () => {
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const hints = createSession(async () => ENGINE_IDENTITY)
    const evaluation = createSession(async () => ENGINE_IDENTITY)
    const openSession = createSessionQueue([
      opponent.session,
      hints.session,
      evaluation.session,
    ])

    const runtime = await openWebMatchRuntime({
      cryptography: createCryptography(),
      openSession,
    })

    expect(openSession).toHaveBeenNthCalledWith(1, OPPONENT_CONFIGURATION, {
      workerName: "mapachess-stockfish-18-opponent",
    })
    expect(openSession).toHaveBeenNthCalledWith(2, HINT_CONFIGURATION, {
      workerName: "mapachess-stockfish-18-better-hints",
    })
    expect(openSession).toHaveBeenNthCalledWith(3, OPPONENT_CONFIGURATION, {
      workerName: "mapachess-stockfish-18-evaluation",
    })
    expect(opponent.boot).toHaveBeenCalledWith(undefined)
    expect(hints.boot).toHaveBeenCalledWith(undefined)
    expect(evaluation.boot).toHaveBeenCalledWith(undefined)
    expect(runtime).toMatchObject({
      engineIdentity: ENGINE_IDENTITY,
      matchId: "standard-story-chicken/00000001000000020000000300000004",
      matchSeed: "00000001000000020000000300000004",
      opponentId: "chicken-stockfish",
      opponentPolicyFingerprint: (
        await resolveWebOpponentPolicy("chicken-stockfish", "standard")
      ).fingerprint,
      playerColor: "white",
    })
    expect(runtime.hintAnalyst.analyze).toEqual(expect.any(Function))

    await runtime.close()
    expect(opponent.close).toHaveBeenCalledTimes(1)
    expect(hints.close).toHaveBeenCalledTimes(1)
    expect(evaluation.close).toHaveBeenCalledTimes(1)
  })

  it("reopens the same deterministic match identity from a saved seed", async () => {
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const hints = createSession(async () => ENGINE_IDENTITY)
    const evaluation = createSession(async () => ENGINE_IDENTITY)
    const matchSeed = parseDeterministicRandomSeed(
      "00000005000000060000000700000008",
      "reopened Chicken test seed",
    )

    const runtime = await openWebMatchRuntime({
      cryptography: createCryptography(),
      matchSeed,
      openSession: createSessionQueue([
        opponent.session,
        hints.session,
        evaluation.session,
      ]),
    })

    expect(runtime).toMatchObject({
      matchId: `standard-story-chicken/${matchSeed}`,
      matchSeed,
      opponentId: "chicken-stockfish",
    })
    await runtime.close()
  })

  it("routes evaluation searches only through the evaluation session", async () => {
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const hints = createSession(async () => ENGINE_IDENTITY)
    const evaluation = createSession(async () => ENGINE_IDENTITY)
    const runtime = await openWebMatchRuntime({
      cryptography: createCryptography(),
      openSession: createSessionQueue([
        opponent.session,
        hints.session,
        evaluation.session,
      ]),
    })
    const position = createInitialMatchPosition({
      chess960PositionId: null,
      variant: "standard",
    })
    const signal = new AbortController().signal

    await expect(
      runtime.positionEvaluator(
        { position, requestId: "evaluation/runtime-isolation" },
        signal,
      ),
    ).resolves.toMatchObject({
      evaluation: { kind: "centipawns", whiteCentipawns: 25 },
    })
    expect(evaluation.search).toHaveBeenCalledWith(
      {
        nodeLimit: POSITION_EVALUATION_NODE_LIMIT,
        position: { fen: position.fen, moves: [] },
        requestId: "evaluation/runtime-isolation",
      },
      signal,
    )
    expect(opponent.search).not.toHaveBeenCalled()
    expect(hints.search).not.toHaveBeenCalled()
    await runtime.close()
  })

  it("closes every session when cancellation arrives after boot", async () => {
    const controller = new AbortController()
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const hints = createSession(async () => {
      controller.abort()
      return ENGINE_IDENTITY
    })
    const evaluation = createSession(async () => ENGINE_IDENTITY)

    await expect(
      openWebMatchRuntime({
        cryptography: createCryptography(),
        openSession: createSessionQueue([
          opponent.session,
          hints.session,
          evaluation.session,
        ]),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(opponent.close).toHaveBeenCalledTimes(1)
    expect(hints.close).toHaveBeenCalledTimes(1)
    expect(evaluation.close).toHaveBeenCalledTimes(1)
  })

  it("closes every session when opponent boot fails", async () => {
    const bootError = new Error("opponent boot failed")
    const opponent = createSession(async () => {
      throw bootError
    })
    const hints = createSession(async () => ENGINE_IDENTITY)
    const evaluation = createSession(async () => ENGINE_IDENTITY)

    await expect(
      openWebMatchRuntime({
        cryptography: createCryptography(),
        openSession: createSessionQueue([
          opponent.session,
          hints.session,
          evaluation.session,
        ]),
      }),
    ).rejects.toBe(bootError)
    expect(opponent.close).toHaveBeenCalledTimes(1)
    expect(hints.boot).toHaveBeenCalledOnce()
    expect(hints.close).toHaveBeenCalledTimes(1)
    expect(evaluation.boot).toHaveBeenCalledOnce()
    expect(evaluation.close).toHaveBeenCalledTimes(1)
  })

  it("closes every session when Better Hints boot fails", async () => {
    const bootError = new Error("hint boot failed")
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const hints = createSession(async () => {
      throw bootError
    })
    const evaluation = createSession(async () => ENGINE_IDENTITY)

    await expect(
      openWebMatchRuntime({
        cryptography: createCryptography(),
        openSession: createSessionQueue([
          opponent.session,
          hints.session,
          evaluation.session,
        ]),
      }),
    ).rejects.toBe(bootError)
    expect(opponent.close).toHaveBeenCalledTimes(1)
    expect(hints.close).toHaveBeenCalledTimes(1)
    expect(evaluation.boot).toHaveBeenCalledOnce()
    expect(evaluation.close).toHaveBeenCalledTimes(1)
  })

  it("closes the opponent session when hint construction fails", async () => {
    const constructionError = new Error("hint construction failed")
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const openSession = vi
      .fn<
        (
          configuration: StockfishEngineConfiguration,
          options?: CreateWebStockfishSessionOptions,
        ) => StockfishUciSession
      >()
      .mockReturnValueOnce(opponent.session)
      .mockImplementationOnce(() => {
        throw constructionError
      })

    await expect(
      openWebMatchRuntime({
        cryptography: createCryptography(),
        openSession,
      }),
    ).rejects.toBe(constructionError)
    expect(opponent.boot).not.toHaveBeenCalled()
    expect(opponent.close).toHaveBeenCalledTimes(1)
  })

  it("closes constructed sessions when evaluation construction fails", async () => {
    const constructionError = new Error("evaluation construction failed")
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const hints = createSession(async () => ENGINE_IDENTITY)
    const openSession = vi
      .fn<
        (
          configuration: StockfishEngineConfiguration,
          options?: CreateWebStockfishSessionOptions,
        ) => StockfishUciSession
      >()
      .mockReturnValueOnce(opponent.session)
      .mockReturnValueOnce(hints.session)
      .mockImplementationOnce(() => {
        throw constructionError
      })

    await expect(
      openWebMatchRuntime({
        cryptography: createCryptography(),
        openSession,
      }),
    ).rejects.toBe(constructionError)
    expect(opponent.boot).not.toHaveBeenCalled()
    expect(hints.boot).not.toHaveBeenCalled()
    expect(opponent.close).toHaveBeenCalledTimes(1)
    expect(hints.close).toHaveBeenCalledTimes(1)
  })

  it("closes every session when evaluation boot fails", async () => {
    const bootError = new Error("evaluation boot failed")
    const opponent = createSession(async () => ENGINE_IDENTITY)
    const hints = createSession(async () => ENGINE_IDENTITY)
    const evaluation = createSession(async () => {
      throw bootError
    })

    await expect(
      openWebMatchRuntime({
        cryptography: createCryptography(),
        openSession: createSessionQueue([
          opponent.session,
          hints.session,
          evaluation.session,
        ]),
      }),
    ).rejects.toBe(bootError)
    expect(opponent.close).toHaveBeenCalledTimes(1)
    expect(hints.close).toHaveBeenCalledTimes(1)
    expect(evaluation.close).toHaveBeenCalledTimes(1)
  })

  it("reports boot and every cleanup failure together", async () => {
    const bootError = new Error("boot failed")
    const opponentCloseError = new Error("opponent close failed")
    const hintCloseError = new Error("hint close failed")
    const opponent = createSession(
      async () => {
        throw bootError
      },
      async () => {
        throw opponentCloseError
      },
    )
    const hints = createSession(
      async () => ENGINE_IDENTITY,
      async () => {
        throw hintCloseError
      },
    )
    const evaluation = createSession(async () => ENGINE_IDENTITY)

    await expect(
      openWebMatchRuntime({
        cryptography: createCryptography(),
        openSession: createSessionQueue([
          opponent.session,
          hints.session,
          evaluation.session,
        ]),
      }),
    ).rejects.toEqual(
      new AggregateError(
        [bootError, opponentCloseError, hintCloseError],
        "Web match failed to open and close cleanly.",
      ),
    )
  })

  it("reports every runtime close failure together", async () => {
    const opponentCloseError = new Error("opponent close failed")
    const hintCloseError = new Error("hint close failed")
    const opponent = createSession(
      async () => ENGINE_IDENTITY,
      async () => {
        throw opponentCloseError
      },
    )
    const hints = createSession(
      async () => ENGINE_IDENTITY,
      async () => {
        throw hintCloseError
      },
    )
    const evaluation = createSession(async () => ENGINE_IDENTITY)
    const runtime = await openWebMatchRuntime({
      cryptography: createCryptography(),
      openSession: createSessionQueue([
        opponent.session,
        hints.session,
        evaluation.session,
      ]),
    })

    await expect(runtime.close()).rejects.toEqual(
      new AggregateError(
        [opponentCloseError, hintCloseError],
        "Web match sessions failed to close cleanly.",
      ),
    )
  })
})
