import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import type { MatchVariant } from "@mapachess/match/match-variant"
import stockfishOpponent, {
  STOCKFISH_OPPONENTS,
} from "@mapachess/match/stockfish-opponent"
import {
  failData,
  requireEnumValue,
  requireExactKeys,
  requireObject,
} from "./decodePrimitives.js"
import {
  isStoryOpponentAvailable,
  RETAINED_STORY_FRONTIERS,
  STORY_MEDALS,
  storyVictoryMedal,
  type RetainedStoryFrontier,
  type StoryProgress,
  type StoryVictory,
} from "./storyProgress.js"

const ORIGINAL_ROSTER = STOCKFISH_OPPONENTS.filter(
  ({ originalStoryTargetElo }) => originalStoryTargetElo !== null,
)

const decodeStoryVictories = (
  received: unknown,
  path: string,
  original: boolean,
  retained: RetainedStoryFrontier | undefined,
): readonly StoryVictory[] => {
  const roster = original ? ORIGINAL_ROSTER : STOCKFISH_OPPONENTS
  if (!Array.isArray(received) || received.length > roster.length)
    return failData(path)
  const victories: StoryVictory[] = []
  let priorPosition = 0
  for (const [index, value] of received.entries()) {
    const itemPath = `${path}[${String(index)}]`
    const object = requireObject(value, itemPath)
    requireExactKeys(object, ["opponentId", "highestMedal"], itemPath)
    const opponent = original
      ? roster[index]
      : roster.find(({ id }) => id === object.opponentId)
    if (
      opponent === undefined ||
      opponent.id !== object.opponentId ||
      opponent.storyPosition <= priorPosition ||
      (!original && !isStoryOpponentAvailable(victories, retained, opponent))
    )
      return failData(`${itemPath}.opponentId`)
    priorPosition = opponent.storyPosition
    victories.push(
      Object.freeze({
        opponentId: opponent.id,
        highestMedal: requireEnumValue(
          object.highestMedal,
          STORY_MEDALS,
          `${itemPath}.highestMedal`,
        ),
      }),
    )
  }
  return Object.freeze(victories)
}

const originalFrontier = (
  victories: readonly StoryVictory[],
): RetainedStoryFrontier | undefined =>
  RETAINED_STORY_FRONTIERS.find((id) => {
    const index = ORIGINAL_ROSTER.findIndex((opponent) => opponent.id === id)
    return ORIGINAL_ROSTER.slice(0, index).every((opponent) =>
      victories.some(({ opponentId }) => opponentId === opponent.id),
    )
  })

export default function decodeStoryProgress(
  received: unknown,
  path: string,
  original = false,
): StoryProgress {
  const object = requireObject(received, path)
  const hasRetainedAccess = !original && object.retainedAccess !== undefined
  requireExactKeys(
    object,
    hasRetainedAccess
      ? ["standard", "chess960", "retainedAccess"]
      : ["standard", "chess960"],
    path,
  )
  const retained = hasRetainedAccess
    ? requireObject(object.retainedAccess, `${path}.retainedAccess`)
    : {}
  if (
    Object.keys(retained).some(
      (key) => key !== "standard" && key !== "chess960",
    )
  )
    return failData(`${path}.retainedAccess`)
  const retainedAccess: Partial<Record<MatchVariant, RetainedStoryFrontier>> =
    {}
  const decodeVariant = (variant: MatchVariant): readonly StoryVictory[] => {
    const frontier =
      retained[variant] === undefined
        ? undefined
        : requireEnumValue(
            retained[variant],
            RETAINED_STORY_FRONTIERS,
            `${path}.retainedAccess.${variant}`,
          )
    const victories = decodeStoryVictories(
      object[variant],
      `${path}.${variant}`,
      original,
      frontier,
    )
    if (original || frontier !== undefined) {
      const earned = originalFrontier(victories)
      if (
        frontier !== undefined &&
        (earned === undefined ||
          stockfishOpponent(earned).storyPosition <
            stockfishOpponent(frontier).storyPosition)
      )
        return failData(`${path}.retainedAccess.${variant}`)
      const access = original ? earned : frontier
      if (access !== undefined) retainedAccess[variant] = access
    }
    return victories
  }
  const standard = decodeVariant("standard")
  const chess960 = decodeVariant("chess960")
  if (hasRetainedAccess && !Object.keys(retainedAccess).length)
    return failData(`${path}.retainedAccess`)
  return Object.freeze({
    standard,
    chess960,
    ...(Object.keys(retainedAccess).length
      ? { retainedAccess: Object.freeze(retainedAccess) }
      : {}),
  })
}

export const requireRecordedStoryResult = (
  progress: StoryProgress,
  match: DurableMatchRecord | null,
): void => {
  if (match === null) return
  const medal = storyVictoryMedal(match)
  if (medal === null) return
  const victory = progress[match.startingPosition.variant].find(
    ({ opponentId }) => opponentId === match.opponentId,
  )
  if (
    victory === undefined ||
    STORY_MEDALS.indexOf(victory.highestMedal) < STORY_MEDALS.indexOf(medal)
  ) {
    failData(`$.storyProgress.${match.startingPosition.variant}`)
  }
}

export const canonicalStoryProgress = (
  progress: StoryProgress,
  original = false,
): readonly unknown[] => [
  progress.standard.map(({ opponentId, highestMedal }) => [
    opponentId,
    highestMedal,
  ]),
  progress.chess960.map(({ opponentId, highestMedal }) => [
    opponentId,
    highestMedal,
  ]),
  ...(!original && progress.retainedAccess !== undefined
    ? [
        [
          progress.retainedAccess.standard ?? null,
          progress.retainedAccess.chess960 ?? null,
        ],
      ]
    : []),
]
