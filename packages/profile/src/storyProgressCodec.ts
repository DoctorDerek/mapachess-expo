import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import {
  failData,
  requireEnumValue,
  requireExactKeys,
  requireObject,
} from "./decodePrimitives.js"
import {
  STORY_MEDALS,
  storyVictoryMedal,
  type StoryProgress,
  type StoryVictory,
} from "./storyProgress.js"

const decodeStoryVictories = (
  received: unknown,
  path: string,
): readonly StoryVictory[] => {
  if (!Array.isArray(received) || received.length > STOCKFISH_OPPONENTS.length)
    return failData(path)
  return Object.freeze(
    received.map((value: unknown, index) => {
      const itemPath = `${path}[${String(index)}]`
      const object = requireObject(value, itemPath)
      requireExactKeys(object, ["opponentId", "highestMedal"], itemPath)
      const opponent = STOCKFISH_OPPONENTS[index]
      if (opponent === undefined || object.opponentId !== opponent.id)
        return failData(`${itemPath}.opponentId`)
      return Object.freeze({
        opponentId: opponent.id,
        highestMedal: requireEnumValue(
          object.highestMedal,
          STORY_MEDALS,
          `${itemPath}.highestMedal`,
        ),
      })
    }),
  )
}

export default function decodeStoryProgress(
  received: unknown,
  path: string,
): StoryProgress {
  const object = requireObject(received, path)
  requireExactKeys(object, ["standard", "chess960"], path)
  return Object.freeze({
    standard: decodeStoryVictories(object.standard, `${path}.standard`),
    chess960: decodeStoryVictories(object.chess960, `${path}.chess960`),
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
): readonly unknown[] => [
  progress.standard.map(({ opponentId, highestMedal }) => [
    opponentId,
    highestMedal,
  ]),
  progress.chess960.map(({ opponentId, highestMedal }) => [
    opponentId,
    highestMedal,
  ]),
]
