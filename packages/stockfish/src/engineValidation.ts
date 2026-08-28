import {
  StockfishOperationAbortedError,
  type StockfishEngineConfiguration,
  type StockfishSearchRequest,
} from "./engineSession.js"

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/
const UCI_MOVE_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
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

export function assertStockfishUciMove(value: string, label: string): void {
  if (!UCI_MOVE_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a lowercase UCI move.`)
  }
}

export function assertStockfishOperationNotAborted(
  signal: AbortSignal | undefined,
  operation: string,
): void {
  if (signal?.aborted === true) {
    throw new StockfishOperationAbortedError(operation)
  }
}

export function validateStockfishEngineConfiguration(
  configuration: StockfishEngineConfiguration,
): void {
  assertPositiveSafeInteger(configuration.threads, "threads")
  assertPositiveSafeInteger(configuration.hashMegabytes, "hashMegabytes")
  assertPositiveSafeInteger(configuration.multiPv, "multiPv")

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
    assertPositiveSafeInteger(configuration.strength.elo, "strength.elo")
  } else if (configuration.strength.kind !== "full-strength") {
    throw new TypeError('strength.kind must be "full-strength" or "uci-elo".')
  }
}

export function validateStockfishSearchRequest(
  request: StockfishSearchRequest,
): void {
  assertStableText(request.requestId, "requestId")
  assertStableText(request.position.fen, "position.fen")
  assertPositiveSafeInteger(request.nodeLimit, "nodeLimit")

  for (const [index, move] of request.position.moves.entries()) {
    assertStockfishUciMove(move, `position.moves[${index}]`)
  }
}
