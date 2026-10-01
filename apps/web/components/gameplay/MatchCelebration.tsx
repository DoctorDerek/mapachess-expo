"use client"

import {
  useEffect,
  useId,
  useRef,
  type RefCallback,
  type RefObject,
} from "react"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import { matchConclusionText } from "@mapachess/match/match-conclusion"
import type { MatchSetup } from "@mapachess/match/match-setup"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import matchVictoryMedal from "@mapachess/profile/match-medal"
import type { AcceptedMatchReward } from "@mapachess/profile/player-data"
import {
  selectStoryLadder,
  STORY_PROGRESS_COPY,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import MapachessButton from "../presentation/MapachessButton"
import MedalSymbol from "../presentation/MedalSymbol"
import MatchLevelProgress from "./MatchLevelProgress"

const displayElo = (elo: number): string => Math.round(elo).toLocaleString("en")

export default function MatchCelebration({
  battleStageRef,
  disabled,
  match,
  onDismiss,
  onReplayRequested,
  onSetupRequested,
  restoreFocusRef,
  reward,
  storyProgress,
}: Readonly<{
  battleStageRef: RefCallback<HTMLDivElement>
  disabled: boolean
  match: DurableMatchRecord
  onDismiss: () => void
  onReplayRequested: () => void
  onSetupRequested: (setup: MatchSetup) => void
  restoreFocusRef: RefObject<HTMLElement | null>
  reward: AcceptedMatchReward
  storyProgress: StoryProgress
}>) {
  const conclusion = match.conclusion
  if (conclusion === null) {
    throw new Error("A completed match is required for its celebration.")
  }
  const dialog = useRef<HTMLDialogElement>(null)
  const reviewButton = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const opponent = stockfishOpponent(match.opponentId)
  const medal = matchVictoryMedal(match)
  const variant = match.startingPosition.variant
  const playerWon =
    (conclusion.type === "checkmate" || conclusion.type === "resignation") &&
    conclusion.winner === match.playerColor
  const next =
    match.mode === "story" && medal !== null
      ? selectStoryLadder(storyProgress, variant).find(
          (step) => step.status === "unlocked",
        )
      : undefined

  useEffect(() => {
    const element = dialog.current
    if (element === null) return
    element.showModal()
    reviewButton.current?.focus({ preventScroll: true })
    const onVisibilityChange = (): void => {
      if (document.hidden) onDismiss()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      if (element.open) element.close()
      if (restoreFocusRef.current?.isConnected) {
        restoreFocusRef.current.focus({ preventScroll: true })
      }
    }
  }, [onDismiss, restoreFocusRef])

  const nextAction = (): void => {
    if (match.mode === "challenge") {
      onReplayRequested()
    } else if (medal === null) {
      onSetupRequested({ mode: "story", variant, opponentId: match.opponentId })
    } else if (next === undefined) {
      onSetupRequested({ mode: "story", variant })
    } else {
      onSetupRequested({ mode: "story", variant, opponentId: next.opponent.id })
    }
  }
  const actionLabel =
    match.mode === "challenge" || medal === null
      ? "Replay match"
      : next === undefined
        ? "Story ladder"
        : "Next opponent"

  return (
    <dialog
      aria-labelledby={titleId}
      className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(94vw,30rem)] overflow-y-auto rounded-[1.5rem_0.5rem_1.5rem_0.5rem] border-3 p-0 shadow-[0.625rem_0.625rem_0_#1e1e1e] backdrop:bg-black/75 forced-colors:shadow-none"
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
      ref={dialog}
    >
      <div ref={battleStageRef} />
      <div className="grid gap-3 p-4 text-center sm:p-5">
        <h2
          className="font-display text-[clamp(1.75rem,6vw,2.5rem)] leading-tight font-black text-balance"
          id={titleId}
        >
          {playerWon
            ? `You defeated ${opponent.displayName}!`
            : matchConclusionText(
                conclusion,
                match.playerColor,
                opponent.displayName,
              )}
        </h2>
        {playerWon && conclusion.type === "resignation" ? (
          <p className="text-base">Opponent resigned.</p>
        ) : null}
        <div className="bg-mapachito-orange flex flex-wrap items-center justify-center gap-3 rounded-lg px-3 py-2">
          {medal === null ? null : (
            <span className="text-lg font-black">
              <MedalSymbol medal={medal} />
              {STORY_PROGRESS_COPY.medals[medal]}
            </span>
          )}
          <p className="font-display text-3xl font-black tabular-nums">
            +{reward.awardedXp} XP
          </p>
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:p-5">
        <MatchLevelProgress
          afterXp={reward.totalXpBefore + reward.awardedXp}
          beforeXp={reward.totalXpBefore}
        />
        {reward.ratedElo === null ? null : (
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-base">
            <span className="font-bold">
              {reward.ratedElo.variant === "standard" ? "Standard" : "Chess960"}{" "}
              Elo
            </span>
            <strong className="font-display text-xl tabular-nums">
              {displayElo(reward.ratedElo.before)} →{" "}
              {displayElo(reward.ratedElo.after)}
            </strong>
          </p>
        )}
        {match.mode === "story" && medal !== null && next === undefined ? (
          <p className="text-sm font-bold">Story complete!</p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <MapachessButton
            autoFocus
            className="min-h-12 px-2! text-base"
            onClick={onDismiss}
            ref={reviewButton}
            type="button"
            variant="secondary"
          >
            Review board
          </MapachessButton>
          <MapachessButton
            className="min-h-12 px-2! text-base"
            disabled={disabled}
            onClick={nextAction}
            type="button"
          >
            {actionLabel}
            {next !== undefined && match.mode === "story" && medal !== null ? (
              <span className="mt-1 block text-base font-normal">
                {next.opponent.displayName} · {next.opponent.storyTargetElo} Elo
              </span>
            ) : null}
          </MapachessButton>
        </div>
      </div>
    </dialog>
  )
}
