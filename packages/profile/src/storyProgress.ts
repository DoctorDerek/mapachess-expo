import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import {
  MATCH_VARIANTS,
  type MatchVariant,
} from "@mapachess/match/match-variant"
import stockfishOpponent, {
  STOCKFISH_OPPONENTS,
  type StockfishOpponentDefinition,
  type StockfishOpponentId,
} from "@mapachess/match/stockfish-opponent"

export const STORY_MEDALS = ["bronze", "silver", "gold"] as const
export type StoryMedal = (typeof STORY_MEDALS)[number]

export type StoryVictory = Readonly<{
  opponentId: StockfishOpponentId
  highestMedal: StoryMedal
}>

export type StoryProgress = Readonly<
  Record<MatchVariant, readonly StoryVictory[]>
>

export type StoryMatchResult = Readonly<
  Pick<
    DurableMatchRecord,
    | "conclusion"
    | "mode"
    | "moveHintsUsed"
    | "pieceHintsUsed"
    | "playerColor"
    | "startingPosition"
  > & { opponentId: StockfishOpponentId }
>

export type StoryLadderStep = Readonly<{
  opponent: StockfishOpponentDefinition
  highestMedal: StoryMedal | null
  status: "defeated" | "unlocked" | "locked"
}>

export const STORY_PROGRESS_COPY = Object.freeze({
  title: "Your Story ladder",
  standard: "Standard Story completion",
  chess960: "Chess960 Story completion",
  overall: "Overall Story completion",
  defeated: "Defeated",
  unlocked: "Unlocked",
  locked: "Locked",
  targetElo: "Authored Elo target",
  nextOpponent: "Next unlocked opponent",
  allDefeated: "Every opponent defeated",
  replay: "Replay wins to improve your medals. Your highest medal is kept.",
  independence: "Standard and Chess960 keep separate victories and medals.",
  availability:
    "Chicken is playable now. Additional opponents and their artwork are still in development; unlocked progress is saved for them.",
  medals: Object.freeze({ bronze: "Bronze", silver: "Silver", gold: "Gold" }),
})

export const createInitialStoryProgress = (): StoryProgress =>
  Object.freeze({ standard: Object.freeze([]), chess960: Object.freeze([]) })

export const storyVictoryMedal = (
  match: StoryMatchResult,
): StoryMedal | null => {
  if (
    match.mode !== "story" ||
    (match.conclusion?.type !== "checkmate" &&
      match.conclusion?.type !== "resignation") ||
    match.conclusion.winner !== match.playerColor
  )
    return null
  if (match.moveHintsUsed && !match.pieceHintsUsed) {
    throw new TypeError(
      "Move Hints cannot award a medal without Piece Hint use.",
    )
  }
  return match.moveHintsUsed
    ? "bronze"
    : match.pieceHintsUsed
      ? "silver"
      : "gold"
}

export default function applyStoryMatchResult(
  progress: StoryProgress,
  match: StoryMatchResult | null,
): StoryProgress {
  if (match === null) return progress
  const highestMedal = storyVictoryMedal(match)
  if (highestMedal === null) return progress
  const variant = match.startingPosition.variant
  const victories = progress[variant]
  const index = stockfishOpponent(match.opponentId).storyPosition - 1
  if (index > victories.length) {
    throw new TypeError("A Story victory cannot skip a locked opponent.")
  }
  const previous = victories[index]
  if (
    previous !== undefined &&
    STORY_MEDALS.indexOf(previous.highestMedal) >=
      STORY_MEDALS.indexOf(highestMedal)
  )
    return progress

  const updated = [...victories]
  updated[index] = Object.freeze({ opponentId: match.opponentId, highestMedal })
  return Object.freeze({ ...progress, [variant]: Object.freeze(updated) })
}

export const selectStoryLadder = (
  progress: StoryProgress,
  variant: MatchVariant,
): readonly StoryLadderStep[] =>
  Object.freeze(
    STOCKFISH_OPPONENTS.map((opponent, index) =>
      Object.freeze({
        opponent,
        highestMedal: progress[variant][index]?.highestMedal ?? null,
        status:
          index < progress[variant].length
            ? "defeated"
            : index === progress[variant].length
              ? "unlocked"
              : "locked",
      }),
    ),
  )

export const selectStoryCompletion = (
  progress: StoryProgress,
): Readonly<Record<MatchVariant | "overall", number>> =>
  Object.freeze({
    standard: (100 * progress.standard.length) / STOCKFISH_OPPONENTS.length,
    chess960: (100 * progress.chess960.length) / STOCKFISH_OPPONENTS.length,
    overall:
      (100 * (progress.standard.length + progress.chess960.length)) /
      (STOCKFISH_OPPONENTS.length * MATCH_VARIANTS.length),
  })

export const selectChallengeUnlockedOpponents = (
  progress: StoryProgress,
): readonly StockfishOpponentDefinition[] =>
  Object.freeze(
    STOCKFISH_OPPONENTS.filter(
      (opponent) =>
        opponent.storyPosition === 1 ||
        MATCH_VARIANTS.some((variant) =>
          progress[variant].some(
            (victory) => victory.opponentId === opponent.id,
          ),
        ),
    ),
  )
