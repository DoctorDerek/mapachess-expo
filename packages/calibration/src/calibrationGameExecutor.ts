import { webcrypto } from "node:crypto"
import type {
  StockfishEngineSearchResult,
  StockfishEngineSession,
} from "@mapachess/stockfish/engine-session"
import {
  deriveOpponentPositionSeed,
  OPPONENT_POSITION_SEED_DERIVATION_VERSION,
  selectOpponentMoveSource,
  selectUniformRandomLegalMove,
} from "@mapachess/stockfish/opponent-move-selection"
import createCalibrationChessPosition, {
  type CalibrationChessPosition,
} from "./calibrationChessPosition.js"
import {
  CalibrationExecutionAbortedError,
  type CalibrationColor,
  type CalibrationCompletedTermination,
  type CalibrationGameExecutionInput,
  type CalibrationGameResult,
  type CalibrationMoveRecord,
  type CalibrationMoveSource,
  type CalibrationPairExecutionInput,
  type CalibrationPairResult,
  type CompletedCalibrationGameResult,
} from "./calibrationGameTypes.js"
import type { CalibrationGame } from "./calibrationPlan.js"
import {
  indexCalibrationPolicies,
  requireCalibrationPolicy,
  stockfishConfigurationFromPolicy,
  type CalibrationPolicyMap,
} from "./calibrationPolicyRegistry.js"
import createDeterministicRandom from "./deterministicRandom.js"

export { CalibrationExecutionAbortedError }
export type {
  CalibrationColor,
  CalibrationCompletedTermination,
  CalibrationGameExecutionInput,
  CalibrationGameResult,
  CalibrationMoveRecord,
  CalibrationMoveSource,
  CalibrationPairExecutionInput,
  CalibrationPairResult,
  CompletedCalibrationGameResult,
  OpenCalibrationEngine,
  OpenCalibrationEngineInput,
  UnterminatedCalibrationGameResult,
} from "./calibrationGameTypes.js"

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new CalibrationExecutionAbortedError()
  }
}

function completedResult(
  game: CalibrationGame,
  chess: CalibrationChessPosition,
  moves: readonly CalibrationMoveRecord[],
  termination: CalibrationCompletedTermination,
): CompletedCalibrationGameResult {
  return {
    status: "completed",
    gameId: game.gameId,
    pairId: game.pairId,
    finalFen: chess.fen(),
    moves,
    termination,
  }
}

async function closeEngines(
  engines: readonly StockfishEngineSession[],
): Promise<Readonly<{ failed: boolean; reason?: unknown }>> {
  const results = await Promise.allSettled(
    engines.map((engine) => engine.close()),
  )
  const failure = results.find((result) => result.status === "rejected")
  return failure?.status === "rejected"
    ? { failed: true, reason: failure.reason }
    : { failed: false }
}

async function executePlies(
  input: CalibrationGameExecutionInput,
  policies: CalibrationPolicyMap,
  chess: CalibrationChessPosition,
  whiteEngine: StockfishEngineSession,
  blackEngine: StockfishEngineSession,
): Promise<CalibrationGameResult> {
  const whitePolicy = requireCalibrationPolicy(
    policies,
    input.game.white.policyFingerprint,
    "white",
  )
  const blackPolicy = requireCalibrationPolicy(
    policies,
    input.game.black.policyFingerprint,
    "black",
  )
  const randomByColor = {
    white: createDeterministicRandom(input.game.white.randomSeed),
    black: createDeterministicRandom(input.game.black.randomSeed),
  }
  const policyByColor = { white: whitePolicy, black: blackPolicy }
  const engineByColor = { white: whiteEngine, black: blackEngine }
  const moves: CalibrationMoveRecord[] = []

  for (let ply = 1; ply <= input.maxPlies; ply++) {
    throwIfAborted(input.signal)
    const color: CalibrationColor = chess.turn()
    const policy = policyByColor[color]
    const legalMoves = chess.legalMoves()

    if (legalMoves.length === 0) {
      throw new Error(
        "A nonterminal position must have at least one legal move.",
      )
    }

    const positionSeeded =
      policy.randomness.seedDerivationVersion ===
      OPPONENT_POSITION_SEED_DERIVATION_VERSION
    const requestId = positionSeeded
      ? `${input.game.gameId}/opponent/ply/${String(ply)}/fen/${chess.fen()}`
      : `${input.game.gameId}/ply/${ply}/${color}`
    const random = positionSeeded
      ? createDeterministicRandom(
          await deriveOpponentPositionSeed(
            input.game[color].randomSeed,
            requestId,
            (bytes) => webcrypto.subtle.digest("SHA-256", bytes),
          ),
        )
      : randomByColor[color]
    throwIfAborted(input.signal)
    const moveSource = selectOpponentMoveSource(
      random,
      policy.moveSelection.randomMoveProbabilityBasisPoints,
    )
    let selectedMove: string
    let source: CalibrationMoveSource
    let search: StockfishEngineSearchResult | undefined

    if (moveSource === "uniform-random-legal") {
      selectedMove = selectUniformRandomLegalMove(random, legalMoves)
      source = "uniform-random-legal"
    } else {
      search = await engineByColor[color].search(
        {
          requestId,
          nodeLimit: policy.search.nodeLimit,
          position: {
            fen: input.game.fen,
            moves: moves.map((move) => move.uci),
          },
        },
        input.signal,
      )

      if (search.requestId !== requestId) {
        throw new Error("Stockfish returned a stale calibration response.")
      }
      if (search.bestMove === null || !legalMoves.includes(search.bestMove)) {
        throw new Error(
          `Stockfish returned an illegal move for ${input.game.gameId}: ${search.bestMove ?? "<none>"}.`,
        )
      }

      selectedMove = search.bestMove
      source = "stockfish"
    }

    throwIfAborted(input.signal)
    const fenBefore = chess.fen()
    chess.play(selectedMove)
    moves.push({
      ply,
      color,
      policyFingerprint:
        color === "white"
          ? input.game.white.policyFingerprint
          : input.game.black.policyFingerprint,
      source,
      uci: selectedMove,
      fenBefore,
      fenAfter: chess.fen(),
      ...(search === undefined ? {} : { search }),
    })

    const termination = chess.termination()
    if (termination !== undefined) {
      return completedResult(input.game, chess, moves, termination)
    }
  }

  return {
    status: "unterminated",
    termination: "max-plies",
    maxPlies: input.maxPlies,
    gameId: input.game.gameId,
    pairId: input.game.pairId,
    finalFen: chess.fen(),
    moves,
  }
}

async function playGame(
  input: CalibrationGameExecutionInput,
  policies: CalibrationPolicyMap,
  chess: CalibrationChessPosition,
): Promise<CalibrationGameResult> {
  const whitePolicy = requireCalibrationPolicy(
    policies,
    input.game.white.policyFingerprint,
    "white",
  )
  const blackPolicy = requireCalibrationPolicy(
    policies,
    input.game.black.policyFingerprint,
    "black",
  )
  const engines: StockfishEngineSession[] = []
  let executionFailed = false
  let executionError: unknown
  let result: CalibrationGameResult | undefined

  try {
    const whiteEngine = await input.openEngine({
      color: "white",
      configuration: stockfishConfigurationFromPolicy(whitePolicy),
      game: input.game,
      policy: whitePolicy,
    })
    engines.push(whiteEngine)
    const blackEngine = await input.openEngine({
      color: "black",
      configuration: stockfishConfigurationFromPolicy(blackPolicy),
      game: input.game,
      policy: blackPolicy,
    })
    engines.push(blackEngine)

    if (whiteEngine === blackEngine) {
      throw new TypeError("Each calibration seat must own a distinct engine.")
    }

    const bootResults = await Promise.allSettled([
      whiteEngine.boot(input.signal),
      blackEngine.boot(input.signal),
    ])
    const failedBoot = bootResults.find(
      (bootResult) => bootResult.status === "rejected",
    )
    if (failedBoot?.status === "rejected") throw failedBoot.reason

    result = await executePlies(
      input,
      policies,
      chess,
      whiteEngine,
      blackEngine,
    )
  } catch (error) {
    executionFailed = true
    executionError = error
  }

  const closeResult = await closeEngines(engines)
  if (executionFailed) {
    throw executionError instanceof Error
      ? executionError
      : new Error("Calibration game execution failed with a non-Error value.", {
          cause: executionError,
        })
  }
  if (closeResult.failed) {
    throw closeResult.reason instanceof Error
      ? closeResult.reason
      : new Error("Calibration engine close failed with a non-Error value.", {
          cause: closeResult.reason,
        })
  }
  if (result === undefined) {
    throw new Error("Calibration game execution produced no result.")
  }

  return result
}

export default async function executeCalibrationGame(
  input: CalibrationGameExecutionInput,
): Promise<CalibrationGameResult> {
  assertPositiveSafeInteger(input.maxPlies, "maxPlies")

  if (
    input.game.white.policyFingerprint === input.game.black.policyFingerprint
  ) {
    throw new TypeError(
      "A calibration game must compare two distinct policies.",
    )
  }

  throwIfAborted(input.signal)
  const policies = indexCalibrationPolicies(input.policies)
  for (const color of ["white", "black"] as const) {
    if (
      requireCalibrationPolicy(
        policies,
        input.game[color].policyFingerprint,
        color,
      ).variant !== input.game.variant
    ) {
      throw new TypeError(
        "Calibration game and seat policy variants must match.",
      )
    }
  }
  const whiteRules = requireCalibrationPolicy(
    policies,
    input.game.white.policyFingerprint,
    "white",
  ).moveSelection.legalMoveGeneratorVersion
  const blackRules = requireCalibrationPolicy(
    policies,
    input.game.black.policyFingerprint,
    "black",
  ).moveSelection.legalMoveGeneratorVersion
  if (whiteRules !== blackRules) {
    throw new TypeError(
      "Calibration seats must use the same canonical chess rules.",
    )
  }
  const chess = createCalibrationChessPosition(input.game, whiteRules)
  const initialTermination = chess.termination()

  if (initialTermination !== undefined) {
    return completedResult(input.game, chess, [], initialTermination)
  }

  return playGame(input, policies, chess)
}

function orderedPair(
  games: readonly CalibrationGame[],
): readonly [CalibrationGame, CalibrationGame] {
  if (games.length !== 2) {
    throw new TypeError("A calibration pair must contain exactly two games.")
  }

  const ordered = [...games].sort(
    (left, right) => left.gameInPair - right.gameInPair,
  )
  const first = ordered[0]
  const second = ordered[1]
  if (first === undefined || second === undefined) {
    throw new TypeError("A calibration pair must contain exactly two games.")
  }

  if (
    first.gameInPair !== 1 ||
    second.gameInPair !== 2 ||
    first.pairId !== second.pairId ||
    first.fen !== second.fen ||
    first.openingId !== second.openingId ||
    first.edgeId !== second.edgeId ||
    first.variant !== second.variant ||
    first.chess960PositionId !== second.chess960PositionId ||
    first.white.policyFingerprint !== second.black.policyFingerprint ||
    first.black.policyFingerprint !== second.white.policyFingerprint ||
    first.white.randomSeed !== second.black.randomSeed ||
    first.black.randomSeed !== second.white.randomSeed
  ) {
    throw new TypeError(
      "Calibration pair games must preserve the same start and reverse both policy seats.",
    )
  }

  return [first, second]
}

export async function executeCalibrationPair(
  input: CalibrationPairExecutionInput,
): Promise<CalibrationPairResult> {
  const [first, second] = orderedPair(input.games)
  const common = {
    openEngine: input.openEngine,
    maxPlies: input.maxPlies,
    policies: input.policies,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  }
  const firstResult = await executeCalibrationGame({ ...common, game: first })
  const secondResult = await executeCalibrationGame({ ...common, game: second })

  return { pairId: first.pairId, games: [firstResult, secondResult] }
}
