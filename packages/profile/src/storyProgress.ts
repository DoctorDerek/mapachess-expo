import loadCatalog from "@mapachess/localization/catalog"
import {
  IMPLEMENTED_DURABLE_OPPONENT_IDS,
  type DurableMatchRecord,
  type ImplementedDurableOpponentId,
} from "@mapachess/match/durable-match-record"
import {
  MATCH_VARIANTS,
  type MatchVariant,
} from "@mapachess/match/match-variant"
import stockfishOpponent, {
  STOCKFISH_OPPONENTS,
  type StockfishOpponentDefinition,
  type StockfishOpponentId,
} from "@mapachess/match/stockfish-opponent"
import matchVictoryMedal, {
  MATCH_MEDALS,
  type MatchMedal,
} from "./matchMedal.js"

export const STORY_MEDALS = MATCH_MEDALS
export type StoryMedal = MatchMedal

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

export const STORY_PROGRESS_COPY = loadCatalog("en").shared.story

export const formatStoryCompletion = (percent: number): string =>
  loadCatalog("en").gameplay.storyCompletion(percent)

export const createInitialStoryProgress = (): StoryProgress =>
  Object.freeze({ standard: Object.freeze([]), chess960: Object.freeze([]) })

export const canPlayStoryOpponent = (
  progress: StoryProgress,
  variant: MatchVariant,
  opponentId: StockfishOpponentId,
): boolean =>
  stockfishOpponent(opponentId).storyPosition <= progress[variant].length + 1

export const selectDefaultStoryOpponent = (
  progress: StoryProgress,
  variant: MatchVariant,
): ImplementedDurableOpponentId =>
  IMPLEMENTED_DURABLE_OPPONENT_IDS.reduce<ImplementedDurableOpponentId>(
    (selected, opponentId) =>
      canPlayStoryOpponent(progress, variant, opponentId)
        ? opponentId
        : selected,
    "chicken-stockfish",
  )

export const storyVictoryMedal = (
  match: StoryMatchResult,
): StoryMedal | null =>
  match.mode === "story" ? matchVictoryMedal(match) : null

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
