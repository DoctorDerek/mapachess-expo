import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import type { MatchVariant } from "@mapachess/match/match-variant"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import matchVictoryMedal, {
  highestMatchMedal,
  type MatchMedal,
} from "./matchMedal.js"

export type ChallengeDifficultyRecord = Readonly<{
  targetElo: number
  lastPlayedAnimal: StockfishOpponentId
  highestMedal: MatchMedal | null
}>

export type ChallengeAnimalRecord = Readonly<{
  opponentId: StockfishOpponentId
  lifetimeWins: number
  lifetimeLosses: number
  highestMedal: MatchMedal | null
}>

export type ChallengeVariantHistory = Readonly<{
  difficulties: readonly ChallengeDifficultyRecord[]
  animals: readonly ChallengeAnimalRecord[]
}>

export type ChallengeHistory = Readonly<
  Record<MatchVariant, ChallengeVariantHistory>
>

export type ChallengeHistoryMatch = Omit<
  DurableMatchRecord,
  "opponentTargetElo"
> &
  Readonly<{
    opponentTargetElo: number | null
  }>

export const createInitialChallengeHistory = (): ChallengeHistory => {
  const empty = Object.freeze({
    difficulties: Object.freeze([]),
    animals: Object.freeze([]),
  })
  return Object.freeze({ standard: empty, chess960: empty })
}

export const recordChallengeStart = (
  history: ChallengeHistory,
  match: ChallengeHistoryMatch,
): ChallengeHistory => {
  if (match.mode !== "challenge" || match.opponentTargetElo === null)
    return history
  const variant = match.startingPosition.variant
  const current = history[variant]
  const previous = current.difficulties.find(
    ({ targetElo }) => targetElo === match.opponentTargetElo,
  )
  if (previous?.lastPlayedAnimal === match.opponentId) return history
  const record: ChallengeDifficultyRecord = Object.freeze({
    targetElo: match.opponentTargetElo,
    lastPlayedAnimal: match.opponentId,
    highestMedal: previous?.highestMedal ?? null,
  })
  return Object.freeze({
    ...history,
    [variant]: Object.freeze({
      ...current,
      difficulties: Object.freeze(
        [
          ...current.difficulties.filter(
            ({ targetElo }) => targetElo !== match.opponentTargetElo,
          ),
          record,
        ].sort((left, right) => left.targetElo - right.targetElo),
      ),
    }),
  })
}

export const adjustChallengeResultCount = (
  history: ChallengeHistory,
  variant: MatchVariant,
  opponentId: StockfishOpponentId,
  outcome: "win" | "loss",
  adjustment: -1 | 1,
): ChallengeHistory => {
  const current = history[variant]
  const previous = current.animals.find(
    (entry) => entry.opponentId === opponentId,
  )
  const wins =
    (previous?.lifetimeWins ?? 0) + (outcome === "win" ? adjustment : 0)
  const losses =
    (previous?.lifetimeLosses ?? 0) + (outcome === "loss" ? adjustment : 0)
  if (
    wins < 0 ||
    losses < 0 ||
    !Number.isSafeInteger(wins) ||
    !Number.isSafeInteger(losses)
  )
    throw new RangeError(
      "Challenge result count does not match its accepted contribution.",
    )
  return Object.freeze({
    ...history,
    [variant]: Object.freeze({
      ...current,
      animals: Object.freeze([
        ...current.animals.filter((entry) => entry.opponentId !== opponentId),
        Object.freeze({
          opponentId,
          lifetimeWins: wins,
          lifetimeLosses: losses,
          highestMedal: previous?.highestMedal ?? null,
        }),
      ]),
    }),
  })
}

export default function applyChallengeMatchResult(
  history: ChallengeHistory,
  previousMatch: Pick<DurableMatchRecord, "matchId" | "conclusion"> | null,
  match: ChallengeHistoryMatch | null,
  countResult = true,
): ChallengeHistory {
  if (
    match === null ||
    match.mode !== "challenge" ||
    match.conclusion === null ||
    (previousMatch?.matchId === match.matchId &&
      previousMatch.conclusion !== null)
  )
    return history
  const conclusion = match.conclusion
  if (conclusion.type !== "checkmate" && conclusion.type !== "resignation")
    return history
  const variant = match.startingPosition.variant
  const current = history[variant]
  const previous = current.animals.find(
    ({ opponentId }) => opponentId === match.opponentId,
  )
  const won = conclusion.winner === match.playerColor
  const medal = matchVictoryMedal(match)
  const record: ChallengeAnimalRecord = Object.freeze({
    opponentId: match.opponentId,
    lifetimeWins: (previous?.lifetimeWins ?? 0) + (countResult && won ? 1 : 0),
    lifetimeLosses:
      (previous?.lifetimeLosses ?? 0) + (countResult && !won ? 1 : 0),
    highestMedal: highestMatchMedal(previous?.highestMedal ?? null, medal),
  })
  return Object.freeze({
    ...history,
    [variant]: Object.freeze({
      animals: Object.freeze([
        ...current.animals.filter(
          ({ opponentId }) => opponentId !== match.opponentId,
        ),
        record,
      ]),
      difficulties: Object.freeze(
        current.difficulties.map((difficulty) =>
          difficulty.targetElo === match.opponentTargetElo
            ? Object.freeze({
                ...difficulty,
                highestMedal: highestMatchMedal(difficulty.highestMedal, medal),
              })
            : difficulty,
        ),
      ),
    }),
  })
}
