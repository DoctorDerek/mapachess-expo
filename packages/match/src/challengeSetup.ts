import {
  parseChess960PositionId,
  type Chess960PositionId,
} from "./chess960Position.js"
import type { MatchColor } from "./matchPosition.js"
import stockfishOpponent, {
  STOCKFISH_OPPONENTS,
  type StockfishOpponentId,
} from "./stockfishOpponent.js"

export type ChallengePositionSetup = Readonly<
  { playerColor: MatchColor } & (
    | { chess960PositionId: null; variant: "standard" }
    | {
        chess960PositionId: Chess960PositionId | null
        variant: "chess960"
      }
  )
>

export type ChallengeSetup = Readonly<
  ChallengePositionSetup & {
    opponentId: StockfishOpponentId
    difficultyTargetElo: number
  }
>

export const DEFAULT_CHALLENGE_SETUP: ChallengeSetup = Object.freeze({
  opponentId: "chicken-stockfish",
  difficultyTargetElo: stockfishOpponent("chicken-stockfish").storyTargetElo,
  chess960PositionId: null,
  playerColor: "white",
  variant: "standard",
})

export type ChallengeSetupParseResult =
  Readonly<{ ok: true; setup: ChallengeSetup }> | Readonly<{ ok: false }>

export function parseChallengePositionSetup(
  received: unknown,
):
  | Readonly<{ ok: true; setup: ChallengePositionSetup }>
  | Readonly<{ ok: false }> {
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

export default function parseChallengeSetup(
  received: unknown,
): ChallengeSetupParseResult {
  if (
    typeof received !== "object" ||
    received === null ||
    Object.keys(received).length !== 5 ||
    !("variant" in received) ||
    !("playerColor" in received) ||
    !("chess960PositionId" in received) ||
    !("opponentId" in received) ||
    !("difficultyTargetElo" in received)
  )
    return { ok: false }
  const opponent = STOCKFISH_OPPONENTS.find(
    ({ id }) => id === received.opponentId,
  )
  if (
    !opponent ||
    typeof received.difficultyTargetElo !== "number" ||
    !Number.isSafeInteger(received.difficultyTargetElo) ||
    received.difficultyTargetElo < DEFAULT_CHALLENGE_SETUP.difficultyTargetElo
  )
    return { ok: false }
  const position = parseChallengePositionSetup({
    variant: received.variant,
    playerColor: received.playerColor,
    chess960PositionId: received.chess960PositionId,
  })
  return position.ok
    ? {
        ok: true,
        setup: Object.freeze({
          ...position.setup,
          opponentId: opponent.id,
          difficultyTargetElo: received.difficultyTargetElo,
        }),
      }
    : { ok: false }
}
