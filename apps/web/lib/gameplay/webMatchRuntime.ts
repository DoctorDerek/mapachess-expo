import type { MatchRuntime } from "@mapachess/gameplay/match-runtime"
import type { StockfishUciIdentity } from "@mapachess/stockfish/uci-session"

export type WebMatchRuntime = MatchRuntime &
  Readonly<{ engineIdentity: StockfishUciIdentity }>
