import { describe, expect, it } from "vitest"
import { StockfishOperationAbortedError } from "./engineSession"
import {
  assertStableText,
  assertStockfishOperationNotAborted,
  validateStockfishEngineConfiguration,
  validateStockfishSearchRequest,
} from "./engineValidation"

const STANDARD_CONFIGURATION = {
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
  strength: { elo: 1320, kind: "uci-elo" },
  threads: 1,
  variant: "standard",
} as const

const STANDARD_SEARCH = {
  nodeLimit: 200,
  position: {
    fen: "8/8/8/8/8/4k3/8/4K3 w - - 0 1",
    moves: ["e1e2"],
  },
  requestId: "game-1/ply-1/white",
} as const

describe("engine validation", () => {
  it("accepts canonical engine inputs", () => {
    expect(() =>
      validateStockfishEngineConfiguration(STANDARD_CONFIGURATION),
    ).not.toThrow()
    expect(() => validateStockfishSearchRequest(STANDARD_SEARCH)).not.toThrow()
  })

  it.each([
    ["threads", { ...STANDARD_CONFIGURATION, threads: 0 }],
    ["hashMegabytes", { ...STANDARD_CONFIGURATION, hashMegabytes: 1.5 }],
    ["multiPv", { ...STANDARD_CONFIGURATION, multiPv: Number.NaN }],
  ] as const)("rejects invalid %s configuration", (_label, configuration) => {
    expect(() => validateStockfishEngineConfiguration(configuration)).toThrow(
      "must be a positive safe integer",
    )
  })

  it("rejects malformed strength, variant, and ponder values", () => {
    expect(() =>
      validateStockfishEngineConfiguration({
        ...STANDARD_CONFIGURATION,
        strength: { elo: 0, kind: "uci-elo" },
      }),
    ).toThrow("strength.elo must be a positive safe integer")
    expect(() =>
      validateStockfishEngineConfiguration({
        ...STANDARD_CONFIGURATION,
        variant: "bughouse",
      } as never),
    ).toThrow('variant must be "standard" or "chess960"')
    expect(() =>
      validateStockfishEngineConfiguration({
        ...STANDARD_CONFIGURATION,
        ponder: "false",
      } as never),
    ).toThrow("ponder must be a boolean")
  })

  it("rejects unstable request text and malformed moves", () => {
    expect(() => assertStableText(" request", "fixture")).toThrow(
      "must be nonempty, trimmed, and free of control characters",
    )
    expect(() =>
      validateStockfishSearchRequest({
        ...STANDARD_SEARCH,
        position: { ...STANDARD_SEARCH.position, moves: ["E1E2"] },
      }),
    ).toThrow("must be a lowercase UCI move")
  })

  it("maps an already-aborted signal to the shared error", () => {
    const controller = new AbortController()
    controller.abort()

    expect(() =>
      assertStockfishOperationNotAborted(controller.signal, "fixture"),
    ).toThrow(StockfishOperationAbortedError)
  })
})
