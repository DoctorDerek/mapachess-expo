import type { MatchColor, MatchPosition, MatchSquare } from "./matchPosition.js"

export const BETTER_HINTS_PER_SIDE = 3 as const

export type BetterHint = Readonly<{
  color: MatchColor
  from: MatchSquare
  to: MatchSquare
  uci: string
}>

export type BetterHintsResult = Readonly<{
  opponent: readonly BetterHint[]
  player: readonly BetterHint[]
  positionFen: string
  requestId: string
}>

export type BetterHintsRequest = Readonly<{
  playerColor: MatchColor
  position: MatchPosition
  requestId: string
}>

export type BetterHintsAnalyst = Readonly<{
  analyze: (
    request: BetterHintsRequest,
    signal?: AbortSignal,
  ) => Promise<BetterHintsResult>
}>
