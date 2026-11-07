import type { PositionEvaluator } from "@mapachess/evaluation/position-evaluator"
import type { BetterHintsAnalyst } from "@mapachess/match/better-hints"
import type { ImplementedDurableOpponentId } from "@mapachess/match/durable-match-record"
import type { MatchOpponent } from "@mapachess/match/match-machine"
import type {
  MatchColor,
  MatchStartingPosition,
} from "@mapachess/match/match-position"
import type { StockfishEngineIdentity } from "@mapachess/stockfish/engine-session"
import type { DeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"

export type MatchRuntime = Readonly<{
  close: () => Promise<void>
  engineIdentity: StockfishEngineIdentity
  hintAnalyst: BetterHintsAnalyst
  matchId: string
  matchSeed: DeterministicRandomSeed
  opponent: MatchOpponent
  opponentId: ImplementedDurableOpponentId
  opponentPolicyFingerprint: string
  opponentTargetElo: number
  ratedOpponentElo: number | null
  playerColor: MatchColor
  positionEvaluator: PositionEvaluator
  startingPosition: MatchStartingPosition
}>

export type OpenMatchRuntimeInput = Readonly<{
  matchSeed?: DeterministicRandomSeed
  opponentId?: ImplementedDurableOpponentId
  opponentPolicyFingerprint?: string
  setup?:
    | MatchStartingPosition
    | Readonly<{ variant: "chess960"; chess960PositionId?: never }>
  signal?: AbortSignal
}> &
  (
    | Readonly<{
        mode?: "story"
        playerColor?: never
        difficultyTargetElo?: never
      }>
    | Readonly<{
        mode: "challenge"
        playerColor: MatchColor | "random"
        difficultyTargetElo?: number
      }>
  )

export type OpenMatchRuntime<Runtime extends MatchRuntime = MatchRuntime> = (
  input: OpenMatchRuntimeInput,
) => Promise<Runtime>
