import { castlingSide, Chess } from "chessops/chess"
import { makeFen, parseFen } from "chessops/fen"
import type { NormalMove } from "chessops/types"
import { kingCastlesTo, makeSquare, makeUci, squareRank } from "chessops/util"
import {
  BETTER_HINTS_PER_SIDE,
  type BetterHint,
  type BetterHintsAnalyst,
  type BetterHintsRequest,
  type BetterHintsResult,
} from "@mapachess/match/better-hints"
import {
  listLegalMatchMoves,
  MATCH_PROMOTION_ROLES,
  type LegalMatchMove,
} from "@mapachess/match/match-move"
import {
  reconstructMatchPosition,
  type MatchColor,
  type MatchPosition,
  type MatchSquare,
  type MatchStartingPosition,
} from "@mapachess/match/match-position"
import type {
  StockfishEngineSearchResult,
  StockfishEngineSession,
  StockfishScore,
} from "@mapachess/stockfish/engine-session"
import { assertStockfishOperationNotAborted } from "@mapachess/stockfish/engine-validation"

export const BETTER_HINTS_ENGINE_MULTIPV = 256 as const
export const BETTER_HINTS_NODE_LIMIT = 50_000 as const

export type BetterHintsAnalystInput = Readonly<{
  engine: StockfishEngineSession
}>

export class BetterHintsAnalysisError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = "BetterHintsAnalysisError"
  }
}

type CheckedOpponentMove = Readonly<{
  hint: BetterHint
  rulesMove: NormalMove
}>

type EvaluatedCheckedOpponentMove = Readonly<{
  candidate: CheckedOpponentMove
  playerScore: number
}>

const MATE_SCORE_MAGNITUDE = 1_000_000

const oppositeColor = (color: MatchColor): MatchColor =>
  color === "white" ? "black" : "white"

const startingPositionOf = (position: MatchPosition): MatchStartingPosition =>
  position.variant === "standard"
    ? { chess960PositionId: null, variant: "standard" }
    : {
        chess960PositionId: position.chess960PositionId,
        variant: "chess960",
      }

const requireRulesPosition = (position: MatchPosition): Chess => {
  const setupResult = parseFen(position.fen)
  if (setupResult.isErr) {
    throw new BetterHintsAnalysisError(
      "Canonical hint position contains invalid FEN.",
    )
  }

  const positionResult = Chess.fromSetup(setupResult.value)
  if (positionResult.isErr) {
    throw new BetterHintsAnalysisError(
      "Canonical hint position cannot reconstruct chess rules.",
    )
  }
  return positionResult.value
}

const createOpponentTurnPosition = (
  position: MatchPosition,
  opponentColor: MatchColor,
): MatchPosition => {
  const setupResult = parseFen(position.fen)
  if (setupResult.isErr) {
    throw new BetterHintsAnalysisError(
      "Canonical hint position contains invalid FEN.",
    )
  }

  setupResult.value.turn = opponentColor
  setupResult.value.epSquare = undefined
  const projectedFen = makeFen(setupResult.value)
  const projectedResult = reconstructMatchPosition(
    startingPositionOf(position),
    projectedFen,
  )
  if (!projectedResult.ok) {
    throw new BetterHintsAnalysisError(
      "Opponent hint position cannot be represented as a legal turn projection.",
    )
  }
  return projectedResult.position
}

const distinctSourceCount = (
  moves: readonly Readonly<{ from: MatchSquare }>[],
): number => new Set(moves.map((move) => move.from)).size

const createHintFromLegalMove = (
  color: MatchColor,
  move: LegalMatchMove,
): BetterHint =>
  Object.freeze({ color, from: move.from, to: move.to, uci: move.uci })

const requireMatchingResult = (
  result: StockfishEngineSearchResult,
  requestId: string,
): StockfishEngineSearchResult => {
  if (result.requestId !== requestId) {
    throw new BetterHintsAnalysisError(
      `Rejected stale Better Hints result for request ${requestId}.`,
    )
  }
  return result
}

const selectRankedDistinctHints = (
  position: MatchPosition,
  color: MatchColor,
  result: StockfishEngineSearchResult,
): readonly BetterHint[] => {
  const legalMoves = listLegalMatchMoves(position)
  const requiredCount = Math.min(
    BETTER_HINTS_PER_SIDE,
    distinctSourceCount(legalMoves),
  )
  if (requiredCount === 0) return Object.freeze([])

  const legalMovesByEngineUci = new Map(
    legalMoves.map((move) => [move.uci, move] as const),
  )
  const variations = result.principalVariations
  if (variations === undefined) {
    throw new BetterHintsAnalysisError(
      "Stockfish returned no ranked principal variations for Better Hints.",
    )
  }

  const selected: BetterHint[] = []
  const selectedSources = new Set<MatchSquare>()
  for (const variation of [...variations].sort(
    (left, right) => left.rank - right.rank,
  )) {
    const rootMove = variation.moves[0]
    const legalMove =
      rootMove === undefined ? undefined : legalMovesByEngineUci.get(rootMove)
    if (legalMove === undefined) {
      throw new BetterHintsAnalysisError(
        "Stockfish returned an illegal root move for Better Hints.",
      )
    }
    if (selectedSources.has(legalMove.from)) continue

    selectedSources.add(legalMove.from)
    selected.push(createHintFromLegalMove(color, legalMove))
    if (selected.length === requiredCount) return Object.freeze(selected)
  }

  throw new BetterHintsAnalysisError(
    `Stockfish returned ${String(selected.length)} distinct hint pieces; ${String(requiredCount)} are legally available.`,
  )
}

const analyzeRankedPosition = async (
  engine: StockfishEngineSession,
  position: MatchPosition,
  color: MatchColor,
  requestId: string,
  signal?: AbortSignal,
): Promise<readonly BetterHint[]> => {
  if (distinctSourceCount(listLegalMatchMoves(position)) === 0) {
    return Object.freeze([])
  }

  const result = requireMatchingResult(
    await engine.search(
      {
        nodeLimit: BETTER_HINTS_NODE_LIMIT,
        position: { fen: position.fen, moves: [] },
        requestId,
      },
      signal,
    ),
    requestId,
  )
  return selectRankedDistinctHints(position, color, result)
}

const isPromotionDestination = (rules: Chess, move: NormalMove): boolean => {
  const role = rules.board.getRole(move.from)
  const destinationRank = squareRank(move.to)
  return role === "pawn" && (destinationRank === 0 || destinationRank === 7)
}

const createCheckedOpponentMove = (
  position: MatchPosition,
  rules: Chess,
  color: MatchColor,
  move: NormalMove,
): CheckedOpponentMove => {
  const side = castlingSide(rules, move)
  const displayTo = side === undefined ? move.to : kingCastlesTo(color, side)
  const engineUci =
    side !== undefined && position.variant === "standard"
      ? `${makeSquare(move.from)}${makeSquare(displayTo)}`
      : makeUci(move)

  return Object.freeze({
    hint: Object.freeze({
      color,
      from: makeSquare(move.from) as MatchSquare,
      to: makeSquare(displayTo) as MatchSquare,
      uci: engineUci,
    }),
    rulesMove: Object.freeze(move),
  })
}

const createCheckedOpponentMoves = (
  position: MatchPosition,
  opponentColor: MatchColor,
): Readonly<{
  candidates: readonly CheckedOpponentMove[]
  projectedRules: Chess
}> => {
  const projectedRules = requireRulesPosition(position).clone()
  projectedRules.turn = opponentColor
  projectedRules.epSquare = undefined
  const candidates: CheckedOpponentMove[] = []

  for (const [from, destinations] of projectedRules.allDests()) {
    for (const to of destinations) {
      if (projectedRules.board.get(to)?.role === "king") continue

      const move: NormalMove = { from, to }
      if (isPromotionDestination(projectedRules, move)) {
        for (const promotion of MATCH_PROMOTION_ROLES) {
          candidates.push(
            createCheckedOpponentMove(position, projectedRules, opponentColor, {
              ...move,
              promotion,
            }),
          )
        }
      } else {
        candidates.push(
          createCheckedOpponentMove(
            position,
            projectedRules,
            opponentColor,
            move,
          ),
        )
      }
    }
  }

  return Object.freeze({
    candidates: Object.freeze(candidates),
    projectedRules,
  })
}

const scoreFromPlayerPerspective = (score: StockfishScore): number =>
  score.kind === "centipawns"
    ? score.value
    : Math.sign(score.value) * (MATE_SCORE_MAGNITUDE - Math.abs(score.value))

const requireSearchScore = (
  result: StockfishEngineSearchResult,
): StockfishScore => {
  const principalScore = result.principalVariations?.find(
    (variation) => variation.rank === 1,
  )?.score
  const score = principalScore ?? result.latestInformation?.score
  if (score === undefined) {
    throw new BetterHintsAnalysisError(
      "Stockfish returned no score for a checked-position hint candidate.",
    )
  }
  return score
}

const evaluateCheckedOpponentMove = async (
  engine: StockfishEngineSession,
  position: MatchPosition,
  projectedRules: Chess,
  opponentColor: MatchColor,
  candidate: CheckedOpponentMove,
  requestId: string,
  index: number,
  nodeLimit: number,
  signal?: AbortSignal,
): Promise<EvaluatedCheckedOpponentMove> => {
  assertStockfishOperationNotAborted(
    signal,
    `Better Hints request ${requestId}`,
  )
  const childRules = projectedRules.clone()
  childRules.play(candidate.rulesMove)
  const childResult = reconstructMatchPosition(
    startingPositionOf(position),
    makeFen(childRules.toSetup()),
  )
  if (!childResult.ok) {
    throw new BetterHintsAnalysisError(
      "A checked-position opponent hint produced an invalid child position.",
    )
  }

  if (childResult.position.status.type === "checkmate") {
    return Object.freeze({
      candidate,
      playerScore:
        childResult.position.status.winner === opponentColor
          ? Number.NEGATIVE_INFINITY
          : Number.POSITIVE_INFINITY,
    })
  }
  if (childResult.position.status.type !== "playing") {
    return Object.freeze({ candidate, playerScore: 0 })
  }

  const childRequestId = `${requestId}/opponent-checked/${String(index + 1)}/${candidate.hint.uci}`
  const result = requireMatchingResult(
    await engine.search(
      {
        nodeLimit,
        position: { fen: childResult.position.fen, moves: [] },
        requestId: childRequestId,
      },
      signal,
    ),
    childRequestId,
  )
  return Object.freeze({
    candidate,
    playerScore: scoreFromPlayerPerspective(requireSearchScore(result)),
  })
}

const compareEvaluatedMoves = (
  left: EvaluatedCheckedOpponentMove,
  right: EvaluatedCheckedOpponentMove,
): number => {
  if (left.playerScore < right.playerScore) return -1
  if (left.playerScore > right.playerScore) return 1
  return left.candidate.hint.uci.localeCompare(right.candidate.hint.uci)
}

const analyzeCheckedOpponent = async (
  engine: StockfishEngineSession,
  position: MatchPosition,
  opponentColor: MatchColor,
  requestId: string,
  signal?: AbortSignal,
): Promise<readonly BetterHint[]> => {
  const { candidates, projectedRules } = createCheckedOpponentMoves(
    position,
    opponentColor,
  )
  const requiredCount = Math.min(
    BETTER_HINTS_PER_SIDE,
    distinctSourceCount(candidates.map((candidate) => candidate.hint)),
  )
  if (requiredCount === 0) return Object.freeze([])

  const evaluated: EvaluatedCheckedOpponentMove[] = []
  const childNodeLimit = Math.max(
    1,
    Math.floor(BETTER_HINTS_NODE_LIMIT / candidates.length),
  )
  for (const [index, candidate] of candidates.entries()) {
    evaluated.push(
      await evaluateCheckedOpponentMove(
        engine,
        position,
        projectedRules,
        opponentColor,
        candidate,
        requestId,
        index,
        childNodeLimit,
        signal,
      ),
    )
  }

  const selected: BetterHint[] = []
  const selectedSources = new Set<MatchSquare>()
  for (const { candidate } of evaluated.sort(compareEvaluatedMoves)) {
    if (selectedSources.has(candidate.hint.from)) continue
    selectedSources.add(candidate.hint.from)
    selected.push(candidate.hint)
    if (selected.length === requiredCount) return Object.freeze(selected)
  }

  throw new BetterHintsAnalysisError(
    "Checked-position analysis could not select every legally available hint piece.",
  )
}

const validateRequest = (request: BetterHintsRequest): void => {
  if (request.position.status.type !== "playing") {
    throw new BetterHintsAnalysisError(
      "Better Hints require a playable match position.",
    )
  }
  if (request.position.turn !== request.playerColor) {
    throw new BetterHintsAnalysisError(
      "Better Hints may only begin on the player's actual turn.",
    )
  }
}

export default function createBetterHintsAnalyst(
  input: BetterHintsAnalystInput,
): BetterHintsAnalyst {
  const analyze = async (
    request: BetterHintsRequest,
    signal?: AbortSignal,
  ): Promise<BetterHintsResult> => {
    validateRequest(request)
    assertStockfishOperationNotAborted(
      signal,
      `Better Hints request ${request.requestId}`,
    )
    const opponentColor = oppositeColor(request.playerColor)
    const player = await analyzeRankedPosition(
      input.engine,
      request.position,
      request.playerColor,
      `${request.requestId}/player`,
      signal,
    )
    const opponent = request.position.inCheck
      ? await analyzeCheckedOpponent(
          input.engine,
          request.position,
          opponentColor,
          request.requestId,
          signal,
        )
      : await analyzeRankedPosition(
          input.engine,
          createOpponentTurnPosition(request.position, opponentColor),
          opponentColor,
          `${request.requestId}/opponent`,
          signal,
        )

    return Object.freeze({
      opponent,
      player,
      positionFen: request.position.fen,
      requestId: request.requestId,
    })
  }

  return Object.freeze({ analyze })
}
