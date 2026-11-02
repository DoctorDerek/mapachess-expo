import loadCatalog from "@mapachess/localization/catalog"
import type {
  DurableMatchRecord,
  ImplementedDurableOpponentId,
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

export const RETAINED_STORY_FRONTIERS = [
  "falcon-stockfish",
  "frog-stockfish",
] as const
export type RetainedStoryFrontier = (typeof RETAINED_STORY_FRONTIERS)[number]

export type StoryProgress = Readonly<
  Record<MatchVariant, readonly StoryVictory[]> & {
    retainedAccess?: Readonly<
      Partial<Record<MatchVariant, RetainedStoryFrontier>>
    >
  }
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

export const isStoryOpponentAvailable = (
  victories: readonly StoryVictory[],
  retained: RetainedStoryFrontier | undefined,
  opponent: StockfishOpponentDefinition,
): boolean => {
  const previous = STOCKFISH_OPPONENTS[opponent.storyPosition - 2]
  return (
    previous === undefined ||
    victories.some(
      ({ opponentId }) =>
        opponentId === opponent.id || opponentId === previous.id,
    ) ||
    (retained !== undefined &&
      opponent.originalStoryTargetElo !== null &&
      opponent.storyPosition <= stockfishOpponent(retained).storyPosition)
  )
}

export const canPlayStoryOpponent = (
  progress: StoryProgress,
  variant: MatchVariant,
  opponentId: StockfishOpponentId,
): boolean =>
  isStoryOpponentAvailable(
    progress[variant],
    progress.retainedAccess?.[variant],
    stockfishOpponent(opponentId),
  )

export const selectDefaultStoryOpponent = (
  progress: StoryProgress,
  variant: MatchVariant,
): ImplementedDurableOpponentId =>
  selectStoryLadder(progress, variant).find(
    ({ status }) => status === "unlocked",
  )?.opponent.id ?? STOCKFISH_OPPONENTS[STOCKFISH_OPPONENTS.length - 1]!.id

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
  if (!canPlayStoryOpponent(progress, variant, match.opponentId)) {
    throw new TypeError("A Story victory cannot skip a locked opponent.")
  }
  const previous = victories.find(
    ({ opponentId }) => opponentId === match.opponentId,
  )
  if (
    previous !== undefined &&
    STORY_MEDALS.indexOf(previous.highestMedal) >=
      STORY_MEDALS.indexOf(highestMedal)
  )
    return progress

  const victory = Object.freeze({ opponentId: match.opponentId, highestMedal })
  const updated =
    previous === undefined
      ? [...victories, victory].sort(
          (left, right) =>
            stockfishOpponent(left.opponentId).storyPosition -
            stockfishOpponent(right.opponentId).storyPosition,
        )
      : victories.map((item) => (item === previous ? victory : item))
  return Object.freeze({ ...progress, [variant]: Object.freeze(updated) })
}

export const selectStoryLadder = (
  progress: StoryProgress,
  variant: MatchVariant,
): readonly StoryLadderStep[] =>
  Object.freeze(
    STOCKFISH_OPPONENTS.map((opponent) => {
      const highestMedal =
        progress[variant].find(({ opponentId }) => opponentId === opponent.id)
          ?.highestMedal ?? null
      return Object.freeze({
        opponent,
        highestMedal,
        status:
          highestMedal !== null
            ? "defeated"
            : isStoryOpponentAvailable(
                  progress[variant],
                  progress.retainedAccess?.[variant],
                  opponent,
                )
              ? "unlocked"
              : "locked",
      })
    }),
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
