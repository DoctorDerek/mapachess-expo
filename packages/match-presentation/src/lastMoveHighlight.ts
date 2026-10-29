import type { AppliedMatchMove } from "@mapachess/match/match-move"
import type { MatchSquare } from "@mapachess/match/match-position"

export type LastMoveHighlight = "origin" | "destination"

export default function lastMoveHighlight(
  move: AppliedMatchMove | null,
  square: MatchSquare,
): LastMoveHighlight | null {
  if (move === null) return null
  if (move.to === square || (move.kind === "castle" && move.rookTo === square))
    return "destination"
  if (
    move.from === square ||
    (move.kind === "castle" && move.rookFrom === square)
  )
    return "origin"
  return null
}
