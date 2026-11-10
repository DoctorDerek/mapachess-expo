import type { MapachessCatalog } from "@mapachess/localization/catalog"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import { matchConclusionText } from "@mapachess/match/match-conclusion"
import type { MatchSetup } from "@mapachess/match/match-setup"
import stockfishOpponent, {
  type StockfishOpponentId,
} from "@mapachess/match/stockfish-opponent"
import { timeControlLabel } from "@mapachess/match/time-control"
import matchVictoryMedal, {
  matchMedalEligibility,
  type MatchMedal,
} from "./matchMedal.js"
import type { AcceptedMatchReward } from "./playerData.js"
import {
  selectStoryLadder,
  storyVictoryMedal,
  type StoryMatchResult,
  type StoryProgress,
} from "./storyProgress.js"

export const SAVE_CONFIRMATION_DURATION_MS = 5_000

type OpponentTarget = Readonly<{
  id: StockfishOpponentId
  elo: number | undefined
}>
type RatedOpponentTarget = OpponentTarget & Readonly<{ elo: number }>
type StorySetup = Extract<MatchSetup, { mode: "story" }>
type MatchResultAction =
  | Readonly<{ kind: "next"; target: OpponentTarget; setup: StorySetup }>
  | Readonly<{ kind: "ladder"; setup: StorySetup }>
  | Readonly<{
      kind: "replay"
      target: OpponentTarget
      setup: StorySetup | null
    }>

type StoryResultPresentation = Readonly<{
  medal: MatchMedal | null
  best: MatchMedal | undefined
  next: RatedOpponentTarget | null
  replay: RatedOpponentTarget
  storyComplete: boolean
  opponentCount: number
}>

export function storyResultPresentation(
  match: StoryMatchResult,
  progress: StoryProgress,
): StoryResultPresentation | null {
  if (match.mode !== "story" || match.conclusion === null) return null
  const { variant } = match.startingPosition
  const medal = storyVictoryMedal(match)
  const ladder = selectStoryLadder(progress, variant)
  const next = ladder.find(({ status }) => status === "unlocked")?.opponent
  const opponent = stockfishOpponent(match.opponentId)
  return {
    medal,
    best: progress[variant].find(({ opponentId }) => opponentId === opponent.id)
      ?.highestMedal,
    next: next === undefined ? null : { id: next.id, elo: next.storyTargetElo },
    replay: { id: opponent.id, elo: opponent.storyTargetElo },
    storyComplete: medal !== null && next === undefined,
    opponentCount: ladder.length,
  }
}

type MatchResultPresentation = Readonly<{
  heading: string
  reason: string | null
  timeLabel: string
  medal: MatchMedal | null
  storyComplete: boolean
  action: MatchResultAction
}>

export default function matchResultPresentation(
  match: DurableMatchRecord,
  progress: StoryProgress,
  copy: MapachessCatalog,
): MatchResultPresentation | null {
  const { conclusion, opponentId, playerColor, startingPosition, timeControl } =
    match
  if (conclusion === null) return null
  const story = storyResultPresentation(match, progress)
  const medal = story === null ? matchVictoryMedal(match) : story.medal
  const won = medal !== null
  const opponentName = copy.animals.opponent(opponentId)
  const { variant } = startingPosition
  const storySetup = { mode: "story", variant } as const
  let action: MatchResultAction
  if (story === null) {
    action = {
      kind: "replay",
      target: { id: opponentId, elo: match.opponentTargetElo },
      setup: null,
    }
  } else if (!won) {
    action = {
      kind: "replay",
      target: story.replay,
      setup: { ...storySetup, opponentId },
    }
  } else if (story.next === null) {
    action = { kind: "ladder", setup: storySetup }
  } else {
    action = {
      kind: "next",
      target: story.next,
      setup: { ...storySetup, opponentId: story.next.id },
    }
  }
  return {
    heading: won
      ? copy.gameplay.defeatedOpponent(opponentName)
      : matchConclusionText(
          conclusion,
          playerColor,
          opponentName,
          copy.gameplay.conclusion,
        ),
    reason:
      won && conclusion.type === "resignation"
        ? copy.interface.matchCelebration.opponentResigned
        : won && conclusion.type === "timeout"
          ? copy.gameplay.conclusion.opponentTimedOut(opponentName)
          : null,
    timeLabel: timeControlLabel(timeControl, copy.gameplay.clock),
    medal,
    storyComplete: story?.storyComplete ?? false,
    action,
  }
}

type PresentedRating = Readonly<
  Required<NonNullable<AcceptedMatchReward["ratedElo"]>>
>

export function matchResultRating(
  match: Pick<DurableMatchRecord, "moveHintsUsed" | "pieceHintsUsed">,
  reward: AcceptedMatchReward | null,
): PresentedRating | null {
  const rating = reward?.ratedElo
  if (rating == null) return null
  return {
    ...rating,
    assistance: rating.assistance ?? matchMedalEligibility(match),
    timeCategory: rating.timeCategory ?? "untimed",
  }
}
