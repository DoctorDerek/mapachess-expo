import type { PositionEvaluator } from "@mapachess/evaluation/position-evaluator"
import type { BetterHintsAnalyst } from "@mapachess/match/better-hints"
import type { MatchOpponent } from "@mapachess/match/match-machine"
import type { MatchColor } from "@mapachess/match/match-position"
import type { DeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import type { StockfishUciIdentity } from "@mapachess/stockfish/uci-session"

export type WebMatchRuntime = Readonly<{
  close: () => Promise<void>
  engineIdentity: StockfishUciIdentity
  hintAnalyst: BetterHintsAnalyst
  matchId: string
  matchSeed: DeterministicRandomSeed
  opponent: MatchOpponent
  opponentPolicyFingerprint: string
  playerColor: MatchColor
  positionEvaluator: PositionEvaluator
}>
