import {
  CHESS960_POSITION_COUNT,
  parseChess960PositionId,
} from "@mapachess/match/chess960-position"
import type {
  MatchColor,
  MatchStartingPosition,
} from "@mapachess/match/match-position"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import {
  createDeterministicRandom,
  type DeterministicRandomSeed,
} from "@mapachess/stockfish/opponent-move-selection"
import type { OpenMatchRuntimeInput } from "./matchRuntime.js"

export function selectMatchStartingPosition(
  setup: OpenMatchRuntimeInput["setup"],
  matchSeed: DeterministicRandomSeed,
): MatchStartingPosition {
  if (setup === undefined)
    return { variant: "standard", chess960PositionId: null }
  if (setup.variant !== "chess960" || setup.chess960PositionId !== undefined)
    return setup
  const random = createDeterministicRandom(matchSeed)
  // Invariant: player color owns the first draw; the layout uses the next draw.
  random.nextIndex(2)
  const parsed = parseChess960PositionId(
    random.nextIndex(CHESS960_POSITION_COUNT),
  )
  if (!parsed.ok) throw new Error("Generated Chess960 layout is invalid.")
  return { variant: "chess960", chess960PositionId: parsed.positionId }
}

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
