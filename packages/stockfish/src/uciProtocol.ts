import {
  StockfishOperationAbortedError,
  StockfishProtocolError,
  type StockfishScore,
  type StockfishSearchInformation,
  type StockfishSearchRequest,
  type StockfishUciConfiguration,
  type StockfishUciExpectation,
} from "./uciTypes.js"

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/
const UCI_MOVE_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/
const UCI_OPTION_PATTERN =
  /^option name (.+?) type (button|check|combo|spin|string)(?: (.*))?$/
const INTEGER_PATTERN = /^-?\d+$/

type UciOptionType = "button" | "check" | "combo" | "spin" | "string"

export type UciOption = Readonly<{
  defaultValue?: string
  maximum?: number
  minimum?: number
  name: string
  type: UciOptionType
}>

export type UciHandshake = Readonly<{
  author: string
  name: string
  options: ReadonlyMap<string, UciOption>
}>

const REQUIRED_OPTIONS: Readonly<Record<string, UciOptionType>> = {
  "Clear Hash": "button",
  EvalFile: "string",
  EvalFileSmall: "string",
  Hash: "spin",
  MultiPV: "spin",
  Ponder: "check",
  Threads: "spin",
  UCI_Chess960: "check",
  UCI_Elo: "spin",
  UCI_LimitStrength: "check",
}

export function assertStableText(value: string, label: string): void {
  if (
    value.length === 0 ||
    value !== value.trim() ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new TypeError(
      `${label} must be nonempty, trimmed, and free of control characters.`,
    )
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
}

export function assertNotAborted(
  signal: AbortSignal | undefined,
  operation: string,
): void {
  if (signal?.aborted === true) {
    throw new StockfishOperationAbortedError(operation)
  }
}

function parseInteger(value: string | undefined): number | undefined {
  if (value === undefined || !INTEGER_PATTERN.test(value)) return undefined

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

function captureOptionField(
  tail: string,
  field: "default" | "max" | "min",
): string | undefined {
  const match = tail.match(
    new RegExp(`(?:^| )${field} (.*?)(?= (?:default|min|max|var) |$)`),
  )
  return match?.[1]
}

export function parseUciOption(line: string): UciOption | undefined {
  const match = line.match(UCI_OPTION_PATTERN)
  if (match === null) return undefined

  const [, name, type, tail = ""] = match
  if (name === undefined || type === undefined) return undefined

  const minimum = parseInteger(captureOptionField(tail, "min"))
  const maximum = parseInteger(captureOptionField(tail, "max"))
  const defaultValue = captureOptionField(tail, "default")

  return {
    name,
    type: type as UciOptionType,
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
  }
}

function requireOption(
  options: ReadonlyMap<string, UciOption>,
  name: string,
  expectedType: UciOptionType,
): UciOption {
  const option = options.get(name)

  if (option === undefined) {
    throw new StockfishProtocolError(
      `Stockfish did not advertise required UCI option ${name}.`,
    )
  }

  if (option.type !== expectedType) {
    throw new StockfishProtocolError(
      `Stockfish UCI option ${name} must have type ${expectedType}, received ${option.type}.`,
    )
  }

  return option
}

function assertSpinValue(option: UciOption, value: number): void {
  assertPositiveSafeInteger(value, `UCI option ${option.name}`)

  if (
    option.minimum === undefined ||
    option.maximum === undefined ||
    value < option.minimum ||
    value > option.maximum
  ) {
    throw new StockfishProtocolError(
      `UCI option ${option.name} value ${value} is outside the advertised range.`,
    )
  }
}

function validateConfiguration(
  configuration: StockfishUciConfiguration,
  options: ReadonlyMap<string, UciOption>,
): void {
  assertSpinValue(
    requireOption(options, "Threads", "spin"),
    configuration.threads,
  )
  assertSpinValue(
    requireOption(options, "Hash", "spin"),
    configuration.hashMegabytes,
  )
  assertSpinValue(
    requireOption(options, "MultiPV", "spin"),
    configuration.multiPv,
  )

  if (typeof configuration.ponder !== "boolean") {
    throw new TypeError("ponder must be a boolean.")
  }

  if (
    configuration.variant !== "standard" &&
    configuration.variant !== "chess960"
  ) {
    throw new TypeError('variant must be "standard" or "chess960".')
  }

  if (configuration.strength.kind === "uci-elo") {
    assertSpinValue(
      requireOption(options, "UCI_Elo", "spin"),
      configuration.strength.elo,
    )
  } else if (configuration.strength.kind !== "full-strength") {
    throw new TypeError('strength.kind must be "full-strength" or "uci-elo".')
  }
}

export function validateHandshake(
  handshake: UciHandshake,
  expectedIdentity: StockfishUciExpectation,
  configuration: StockfishUciConfiguration,
): void {
  if (handshake.name !== expectedIdentity.name) {
    throw new StockfishProtocolError(
      `Expected UCI engine name ${expectedIdentity.name}, received ${handshake.name || "<missing>"}.`,
    )
  }

  assertStableText(handshake.author, "UCI engine author")

  for (const [name, type] of Object.entries(REQUIRED_OPTIONS)) {
    requireOption(handshake.options, name, type)
  }
  if (expectedIdentity.requiresSyzygyPath) {
    requireOption(handshake.options, "SyzygyPath", "string")
  }

  const bigNetwork = requireOption(handshake.options, "EvalFile", "string")
  const smallNetwork = requireOption(
    handshake.options,
    "EvalFileSmall",
    "string",
  )

  if (bigNetwork.defaultValue !== expectedIdentity.networkDefaults.big) {
    throw new StockfishProtocolError(
      `Expected EvalFile ${expectedIdentity.networkDefaults.big}, received ${bigNetwork.defaultValue ?? "<missing>"}.`,
    )
  }

  if (smallNetwork.defaultValue !== expectedIdentity.networkDefaults.small) {
    throw new StockfishProtocolError(
      `Expected EvalFileSmall ${expectedIdentity.networkDefaults.small}, received ${smallNetwork.defaultValue ?? "<missing>"}.`,
    )
  }

  validateConfiguration(configuration, handshake.options)
}

export function validateSearchRequest(request: StockfishSearchRequest): void {
  assertStableText(request.requestId, "requestId")
  assertStableText(request.position.fen, "position.fen")
  assertPositiveSafeInteger(request.nodeLimit, "nodeLimit")

  for (const [index, move] of request.position.moves.entries()) {
    if (!UCI_MOVE_PATTERN.test(move)) {
      throw new TypeError(
        `position.moves[${index}] must be a lowercase UCI move.`,
      )
    }
  }
}

export function parseInformation(line: string): StockfishSearchInformation {
  const tokens = line.split(" ")
  const valueAfter = (name: string): number | undefined => {
    const index = tokens.indexOf(name)
    return parseInteger(index === -1 ? undefined : tokens[index + 1])
  }
  const depth = valueAfter("depth")
  const selectiveDepth = valueAfter("seldepth")
  const nodes = valueAfter("nodes")
  const scoreIndex = tokens.indexOf("score")
  let score: StockfishScore | undefined

  if (scoreIndex !== -1) {
    const scoreKind = tokens[scoreIndex + 1]
    const scoreValue = parseInteger(tokens[scoreIndex + 2])

    if (
      scoreValue !== undefined &&
      (scoreKind === "cp" || scoreKind === "mate")
    ) {
      score = {
        kind: scoreKind === "cp" ? "centipawns" : "mate",
        value: scoreValue,
        bound: tokens.includes("lowerbound")
          ? "lower"
          : tokens.includes("upperbound")
            ? "upper"
            : "exact",
      }
    }
  }

  return {
    line,
    ...(depth === undefined ? {} : { depth }),
    ...(selectiveDepth === undefined ? {} : { selectiveDepth }),
    ...(nodes === undefined ? {} : { nodes }),
    ...(score === undefined ? {} : { score }),
  }
}

export function parseBestMove(line: string): {
  bestMove: string | null
  ponderMove?: string
} {
  const tokens = line.split(" ")
  const bestMoveToken = tokens[1]

  if (bestMoveToken === undefined) {
    throw new StockfishProtocolError("Stockfish emitted malformed bestmove.")
  }

  const bestMove =
    bestMoveToken === "(none)" || bestMoveToken === "0000"
      ? null
      : bestMoveToken
  if (bestMove !== null && !UCI_MOVE_PATTERN.test(bestMove)) {
    throw new StockfishProtocolError(
      `Stockfish emitted invalid bestmove ${bestMove}.`,
    )
  }

  const ponderMove = tokens[2] === "ponder" ? tokens[3] : undefined
  if (ponderMove !== undefined && !UCI_MOVE_PATTERN.test(ponderMove)) {
    throw new StockfishProtocolError(
      `Stockfish emitted invalid ponder move ${ponderMove}.`,
    )
  }

  return {
    bestMove,
    ...(ponderMove === undefined ? {} : { ponderMove }),
  }
}

export function createConfigurationCommands(
  configuration: StockfishUciConfiguration,
  options: ReadonlyMap<string, UciOption>,
): readonly string[] {
  return [
    `setoption name Threads value ${configuration.threads}`,
    `setoption name Hash value ${configuration.hashMegabytes}`,
    `setoption name MultiPV value ${configuration.multiPv}`,
    `setoption name Ponder value ${String(configuration.ponder)}`,
    `setoption name UCI_Chess960 value ${String(configuration.variant === "chess960")}`,
    ...(options.has("SyzygyPath")
      ? ["setoption name SyzygyPath value <empty>"]
      : []),
    `setoption name UCI_LimitStrength value ${String(configuration.strength.kind === "uci-elo")}`,
    ...(configuration.strength.kind === "uci-elo"
      ? [`setoption name UCI_Elo value ${configuration.strength.elo}`]
      : []),
    "setoption name Clear Hash",
  ]
}
