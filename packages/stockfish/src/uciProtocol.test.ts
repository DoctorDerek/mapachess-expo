import { describe, expect, it } from "vitest"
import type { StockfishEngineConfiguration } from "./engineSession"
import {
  createConfigurationCommands,
  parseBestMove,
  parseInformation,
  parseUciOption,
  validateHandshake,
  type UciOption,
} from "./uciProtocol"
import { STOCKFISH_18_WEB_UCI_EXPECTATION } from "./webRuntimeIdentity"

const configuration: StockfishEngineConfiguration = {
  variant: "standard",
  strength: { kind: "full-strength" },
  threads: 1,
  hashMegabytes: 16,
  multiPv: 3,
  ponder: false,
}
function options() {
  const lines = [
    "option name Clear Hash type button",
    "option name Threads type spin default 1 min 1 max 16",
    "option name Hash type spin default 16 min 1 max 1024",
    "option name MultiPV type spin default 1 min 1 max 256",
    "option name Ponder type check default false",
    "option name UCI_Chess960 type check default false",
    "option name UCI_LimitStrength type check default false",
    "option name UCI_Elo type spin default 1320 min 1320 max 3190",
    "option name EvalFile type string default nn-9067e33176e8.nnue",
    "option name EvalFileSmall type string default <empty>",
  ]
  return new Map(
    lines.map((line) => {
      const option = parseUciOption(line)
      if (option === undefined)
        throw new Error("The fixture must contain a valid UCI option.")
      return [option.name, option]
    }),
  )
}
function handshake(advertised = options()) {
  return {
    name: STOCKFISH_18_WEB_UCI_EXPECTATION.name,
    author: "Stockfish developers",
    options: advertised,
  }
}

describe("UCI protocol validation at the untrusted process boundary", () => {
  it("accepts the pinned handshake and emits variant/strength configuration without tablebase assumptions", () => {
    const advertised = options()
    expect(() =>
      validateHandshake(
        handshake(advertised),
        STOCKFISH_18_WEB_UCI_EXPECTATION,
        configuration,
      ),
    ).not.toThrow()
    expect(createConfigurationCommands(configuration, advertised)).toContain(
      "setoption name UCI_LimitStrength value false",
    )
    advertised.set("SyzygyPath", { name: "SyzygyPath", type: "string" })
    const rated: StockfishEngineConfiguration = {
      ...configuration,
      variant: "chess960",
      strength: { kind: "uci-elo", elo: 1320 },
    }
    expect(() =>
      validateHandshake(
        handshake(advertised),
        { ...STOCKFISH_18_WEB_UCI_EXPECTATION, requiresSyzygyPath: true },
        rated,
      ),
    ).not.toThrow()
    expect(createConfigurationCommands(rated, advertised)).toEqual(
      expect.arrayContaining([
        "setoption name UCI_Chess960 value true",
        "setoption name UCI_Elo value 1320",
        "setoption name SyzygyPath value <empty>",
      ]),
    )
  })

  it.each(["Threads", "Hash", "MultiPV", "EvalFile", "UCI_Chess960"])(
    "rejects a missing or wrongly typed %s option",
    (name) => {
      const advertised = options()
      advertised.delete(name)
      expect(() =>
        validateHandshake(
          handshake(advertised),
          STOCKFISH_18_WEB_UCI_EXPECTATION,
          configuration,
        ),
      ).toThrow("required UCI option")
      advertised.set(name, { name, type: "combo" })
      expect(() =>
        validateHandshake(
          handshake(advertised),
          STOCKFISH_18_WEB_UCI_EXPECTATION,
          configuration,
        ),
      ).toThrow("must have type")
    },
  )

  it.each([
    { minimum: undefined, maximum: 16 },
    { minimum: 2, maximum: 16 },
    { minimum: 1, maximum: undefined },
    { minimum: 1, maximum: 0 },
  ])(
    "rejects an unavailable advertised thread range (%#)",
    ({ minimum, maximum }) => {
      const advertised = options()
      const option: UciOption = {
        name: "Threads",
        type: "spin",
        ...(minimum === undefined ? {} : { minimum }),
        ...(maximum === undefined ? {} : { maximum }),
      }
      advertised.set("Threads", option)
      expect(() =>
        validateHandshake(
          handshake(advertised),
          STOCKFISH_18_WEB_UCI_EXPECTATION,
          configuration,
        ),
      ).toThrow("outside the advertised range")
    },
  )

  it("rejects unknown identities, missing network defaults, and an absent required tablebase option", () => {
    expect(() =>
      validateHandshake(
        { ...handshake(), name: "" },
        STOCKFISH_18_WEB_UCI_EXPECTATION,
        configuration,
      ),
    ).toThrow("<missing>")
    const advertised = options()
    advertised.set("EvalFile", { name: "EvalFile", type: "string" })
    expect(() =>
      validateHandshake(
        handshake(advertised),
        STOCKFISH_18_WEB_UCI_EXPECTATION,
        configuration,
      ),
    ).toThrow("Expected EvalFile")
    advertised.set("EvalFile", {
      name: "EvalFile",
      type: "string",
      defaultValue: STOCKFISH_18_WEB_UCI_EXPECTATION.networkDefaults.big,
    })
    advertised.set("EvalFileSmall", { name: "EvalFileSmall", type: "string" })
    expect(() =>
      validateHandshake(
        handshake(advertised),
        STOCKFISH_18_WEB_UCI_EXPECTATION,
        configuration,
      ),
    ).toThrow("Expected EvalFileSmall")
    expect(() =>
      validateHandshake(
        handshake(),
        { ...STOCKFISH_18_WEB_UCI_EXPECTATION, requiresSyzygyPath: true },
        configuration,
      ),
    ).toThrow("SyzygyPath")
  })

  it.each([
    "info multipv 0",
    "info multipv -1",
    "info multipv",
    "info multipv nan",
    "info pv",
    "info pv e2e4 invalid",
  ])("rejects malformed ranked information: %s", (line) =>
    expect(() => parseInformation(line)).toThrow(),
  )

  it("parses exact, bounded, mate, promotion and ponder output without treating arbitrary info strings as scores", () => {
    expect(parseInformation("info string score cp 999 pv invalid")).toEqual({
      line: "info string score cp 999 pv invalid",
    })
    expect(
      parseInformation(
        "info depth 9 seldepth 12 nodes 100 multipv 2 score cp -5 lowerbound pv a7a8q",
      ),
    ).toMatchObject({
      depth: 9,
      selectiveDepth: 12,
      nodes: 100,
      multiPv: 2,
      score: { kind: "centipawns", value: -5, bound: "lower" },
      principalVariation: ["a7a8q"],
    })
    expect(parseInformation("info score mate -2 upperbound").score).toEqual({
      kind: "mate",
      value: -2,
      bound: "upper",
    })
    for (const line of [
      "info",
      "info score cp",
      "info score wat 3",
      "info score cp 9007199254740992",
      "info depth 1.5",
    ])
      expect(parseInformation(line)).toEqual({ line })
    expect(parseBestMove("bestmove 0000")).toEqual({ bestMove: null })
    expect(parseBestMove("bestmove (none)")).toEqual({ bestMove: null })
    expect(parseBestMove("bestmove a7a8q ponder h8g8")).toEqual({
      bestMove: "a7a8q",
      ponderMove: "h8g8",
    })
    expect(parseUciOption("irrelevant line")).toBeUndefined()
    expect(
      parseUciOption(
        "option name Skill type spin min invalid max 9007199254740992",
      ),
    ).toEqual({ name: "Skill", type: "spin" })
  })

  it.each([
    "bestmove",
    "bestmove invalid",
    "bestmove a0a1",
    "bestmove e2e4 ponder invalid",
  ])("rejects invalid final move syntax: %s", (line) =>
    expect(() => parseBestMove(line)).toThrow(),
  )
})
