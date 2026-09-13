import { IMPLEMENTED_DURABLE_OPPONENT_IDS } from "@mapachess/match/durable-match-record"
import { MATCH_VARIANTS } from "@mapachess/match/match-variant"
import type {
  ChallengeAnimalRecord,
  ChallengeDifficultyRecord,
  ChallengeHistory,
  ChallengeVariantHistory,
} from "./challengeHistory.js"
import {
  failData,
  requireEnumValue,
  requireExactKeys,
  requireObject,
  requirePlayerElo,
  requireSafeRevision,
} from "./decodePrimitives.js"
import { MATCH_MEDALS, type MatchMedal } from "./matchMedal.js"

const decodeMedal = (received: unknown, path: string): MatchMedal | null =>
  received === null ? null : requireEnumValue(received, MATCH_MEDALS, path)

const decodeDifficulties = (
  received: unknown,
  path: string,
): readonly ChallengeDifficultyRecord[] => {
  if (!Array.isArray(received)) return failData(path)
  const targets = new Set<number>()
  return Object.freeze(
    received
      .map((value: unknown, index) => {
        const itemPath = `${path}[${String(index)}]`
        const item = requireObject(value, itemPath)
        requireExactKeys(
          item,
          ["targetElo", "lastPlayedAnimal", "highestMedal"],
          itemPath,
        )
        const targetElo = requirePlayerElo(
          item.targetElo,
          `${itemPath}.targetElo`,
        )
        if (targets.has(targetElo)) return failData(`${itemPath}.targetElo`)
        targets.add(targetElo)
        return Object.freeze({
          targetElo,
          lastPlayedAnimal: requireEnumValue(
            item.lastPlayedAnimal,
            IMPLEMENTED_DURABLE_OPPONENT_IDS,
            `${itemPath}.lastPlayedAnimal`,
          ),
          highestMedal: decodeMedal(
            item.highestMedal,
            `${itemPath}.highestMedal`,
          ),
        })
      })
      .sort((left, right) => left.targetElo - right.targetElo),
  )
}

const decodeAnimals = (
  received: unknown,
  path: string,
): readonly ChallengeAnimalRecord[] => {
  if (
    !Array.isArray(received) ||
    received.length > IMPLEMENTED_DURABLE_OPPONENT_IDS.length
  )
    return failData(path)
  const opponents = new Set<string>()
  return Object.freeze(
    received.map((value: unknown, index) => {
      const itemPath = `${path}[${String(index)}]`
      const item = requireObject(value, itemPath)
      requireExactKeys(
        item,
        ["opponentId", "lifetimeWins", "lifetimeLosses", "highestMedal"],
        itemPath,
      )
      const opponentId = requireEnumValue(
        item.opponentId,
        IMPLEMENTED_DURABLE_OPPONENT_IDS,
        `${itemPath}.opponentId`,
      )
      if (opponents.has(opponentId)) return failData(`${itemPath}.opponentId`)
      opponents.add(opponentId)
      const lifetimeWins = requireSafeRevision(
        item.lifetimeWins,
        `${itemPath}.lifetimeWins`,
      )
      const lifetimeLosses = requireSafeRevision(
        item.lifetimeLosses,
        `${itemPath}.lifetimeLosses`,
      )
      const highestMedal = decodeMedal(
        item.highestMedal,
        `${itemPath}.highestMedal`,
      )
      if ((lifetimeWins === 0) !== (highestMedal === null))
        return failData(`${itemPath}.highestMedal`)
      return Object.freeze({
        opponentId,
        lifetimeWins,
        lifetimeLosses,
        highestMedal,
      })
    }),
  )
}

const decodeVariant = (
  received: unknown,
  path: string,
): ChallengeVariantHistory => {
  const object = requireObject(received, path)
  requireExactKeys(object, ["difficulties", "animals"], path)
  return Object.freeze({
    difficulties: decodeDifficulties(
      object.difficulties,
      `${path}.difficulties`,
    ),
    animals: decodeAnimals(object.animals, `${path}.animals`),
  })
}

export default function decodeChallengeHistory(
  received: unknown,
  path: string,
): ChallengeHistory {
  const object = requireObject(received, path)
  requireExactKeys(object, MATCH_VARIANTS, path)
  return Object.freeze({
    standard: decodeVariant(object.standard, `${path}.standard`),
    chess960: decodeVariant(object.chess960, `${path}.chess960`),
  })
}

export const canonicalChallengeHistory = (
  history: ChallengeHistory,
): readonly unknown[] =>
  MATCH_VARIANTS.map((variant) => [
    [...history[variant].difficulties]
      .sort((left, right) => left.targetElo - right.targetElo)
      .map(({ targetElo, lastPlayedAnimal, highestMedal }) => [
        targetElo,
        lastPlayedAnimal,
        highestMedal,
      ]),
    [...history[variant].animals]
      .sort(
        (left, right) =>
          IMPLEMENTED_DURABLE_OPPONENT_IDS.indexOf(left.opponentId) -
          IMPLEMENTED_DURABLE_OPPONENT_IDS.indexOf(right.opponentId),
      )
      .map(({ opponentId, lifetimeWins, lifetimeLosses, highestMedal }) => [
        opponentId,
        lifetimeWins,
        lifetimeLosses,
        highestMedal,
      ]),
  ])
