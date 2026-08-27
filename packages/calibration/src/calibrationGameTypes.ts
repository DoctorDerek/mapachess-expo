import type {
  StockfishEngineConfiguration,
  StockfishEngineSearchResult,
  StockfishEngineSession,
} from "@mapachess/stockfish/engine-session"
import type {
  CalibrationGame,
  CalibrationPairId,
  CalibrationPolicyRecord,
} from "./calibrationPlan.js"
import type {
  OpponentPolicy,
  OpponentPolicyFingerprint,
} from "./opponentPolicy.js"

export type CalibrationColor = "black" | "white"
export type CalibrationMoveSource = "stockfish" | "uniform-random-legal"

export type CalibrationCompletedTermination =
  | Readonly<{ kind: "checkmate"; winner: CalibrationColor }>
  | Readonly<{
      kind:
        | "fifty-move-rule"
        | "insufficient-material"
        | "stalemate"
        | "threefold-repetition"
    }>

export type CalibrationMoveRecord = Readonly<{
  color: CalibrationColor
  fenAfter: string
  fenBefore: string
  ply: number
  policyFingerprint: OpponentPolicyFingerprint
  search?: StockfishEngineSearchResult
  source: CalibrationMoveSource
  uci: string
}>

export type CompletedCalibrationGameResult = Readonly<{
  finalFen: string
  gameId: CalibrationGame["gameId"]
  moves: readonly CalibrationMoveRecord[]
  pairId: CalibrationPairId
  status: "completed"
  termination: CalibrationCompletedTermination
}>

export type UnterminatedCalibrationGameResult = Readonly<{
  finalFen: string
  gameId: CalibrationGame["gameId"]
  maxPlies: number
  moves: readonly CalibrationMoveRecord[]
  pairId: CalibrationPairId
  status: "unterminated"
  termination: "max-plies"
}>

export type CalibrationGameResult =
  CompletedCalibrationGameResult | UnterminatedCalibrationGameResult

export type OpenCalibrationEngineInput = Readonly<{
  color: CalibrationColor
  configuration: StockfishEngineConfiguration
  game: CalibrationGame
  policy: OpponentPolicy
}>

export type OpenCalibrationEngine = (
  input: OpenCalibrationEngineInput,
) => StockfishEngineSession | Promise<StockfishEngineSession>

export type CalibrationGameExecutionInput = Readonly<{
  openEngine: OpenCalibrationEngine
  game: CalibrationGame
  maxPlies: number
  policies: readonly CalibrationPolicyRecord[]
  signal?: AbortSignal
}>

export type CalibrationPairExecutionInput = Readonly<{
  openEngine: OpenCalibrationEngine
  games: readonly CalibrationGame[]
  maxPlies: number
  policies: readonly CalibrationPolicyRecord[]
  signal?: AbortSignal
}>

export type CalibrationPairResult = Readonly<{
  games: readonly [CalibrationGameResult, CalibrationGameResult]
  pairId: CalibrationPairId
}>

export class CalibrationExecutionAbortedError extends Error {
  public constructor() {
    super("Calibration game execution was aborted.")
    this.name = "CalibrationExecutionAbortedError"
  }
}
