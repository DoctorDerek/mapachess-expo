import type {
  MatchColor,
  MatchStartingPosition,
} from "@mapachess/match/match-position"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import {
  createDeterministicRandom,
  type DeterministicRandomSeed,
} from "@mapachess/stockfish/opponent-move-selection"

export function selectStoryPlayerColor(
  matchSeed: DeterministicRandomSeed,
): "black" | "white" {
  const random = createDeterministicRandom(matchSeed)
  return random.nextIndex(2) === 0 ? "white" : "black"
}

export function createMatchId(
  matchSeed: DeterministicRandomSeed,
  startingPosition: MatchStartingPosition = {
    variant: "standard",
    chess960PositionId: null,
  },
  selection:
    | Readonly<{ mode: "story" }>
    | Readonly<{ mode: "challenge"; playerColor: MatchColor }> = {
    mode: "story",
  },
  opponentId: StockfishOpponentId = "chicken-stockfish",
): string {
  const animalId = opponentId.replace(/-stockfish$/, "")
  if (selection.mode === "challenge") {
    return startingPosition.variant === "standard"
      ? `standard-challenge-${animalId}/${selection.playerColor}/${matchSeed}`
      : `chess960-challenge-${animalId}/${String(startingPosition.chess960PositionId)}/${selection.playerColor}/${matchSeed}`
  }
  return startingPosition.variant === "standard"
    ? `standard-story-${animalId}/${matchSeed}`
    : `chess960-story-${animalId}/${String(startingPosition.chess960PositionId)}/${matchSeed}`
}
