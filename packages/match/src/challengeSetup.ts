import {
  parseChess960PositionId,
  type Chess960PositionId,
} from "./chess960Position.js"
import type { MatchColor } from "./matchPosition.js"

export type ChallengeSetup = Readonly<
  { playerColor: MatchColor } & (
    | { chess960PositionId: null; variant: "standard" }
    | {
        chess960PositionId: Chess960PositionId | null
        variant: "chess960"
      }
  )
>

export const DEFAULT_CHALLENGE_SETUP: ChallengeSetup = Object.freeze({
  chess960PositionId: null,
  playerColor: "white",
  variant: "standard",
})

export type ChallengeSetupParseResult =
  Readonly<{ ok: true; setup: ChallengeSetup }> | Readonly<{ ok: false }>

export default function parseChallengeSetup(
  received: unknown,
): ChallengeSetupParseResult {
  if (
    typeof received !== "object" ||
    received === null ||
    Object.keys(received).length !== 3 ||
    !("variant" in received) ||
    !("playerColor" in received) ||
    !("chess960PositionId" in received) ||
    (received.playerColor !== "white" && received.playerColor !== "black")
  ) {
    return { ok: false }
  }

  if (received.variant === "standard" && received.chess960PositionId === null) {
    return {
      ok: true,
      setup: Object.freeze({
        chess960PositionId: null,
        playerColor: received.playerColor,
        variant: "standard",
      }),
    }
  }

  if (received.variant !== "chess960") return { ok: false }
  const position = parseChess960PositionId(received.chess960PositionId)
  if (received.chess960PositionId !== null && !position.ok) return { ok: false }

  return {
    ok: true,
    setup: Object.freeze({
      chess960PositionId: position.ok ? position.positionId : null,
      playerColor: received.playerColor,
      variant: "chess960",
    }),
  }
}
