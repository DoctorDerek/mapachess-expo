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
import { timeControlLabel } from "@mapachess/match/time-control"
import matchVictoryMedal from "@mapachess/profile/match-medal"
import type { AcceptedMatchReward } from "@mapachess/profile/player-data"
import {
  selectStoryLadder,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import { usePlayerInputScope } from "../input/PlayerInputProvider"
import MapachessButton from "../presentation/MapachessButton"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import MatchLevelProgress from "./MatchLevelProgress"
import MatchSaveConfirmation from "./MatchSaveConfirmation"
import MedalWithHintUse from "./MedalWithHintUse"

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
  showSaveConfirmation,
}: Readonly<{
  battleStageRef: RefCallback<HTMLDivElement>
  disabled: boolean
  match: DurableMatchRecord
  onDismiss: () => void
  onReplayRequested: () => void
  onSetupRequested: (setup: MatchSetup) => void
  restoreFocusRef: RefObject<HTMLElement | null>
  reward: AcceptedMatchReward | null
  storyProgress: StoryProgress
  showSaveConfirmation: boolean
}>) {
  const copy = useMapachessCopy()
  const animalCopy = copy.animals
  const messages = copy.interface.matchCelebration

  const conclusion = match.conclusion
  if (conclusion === null) {
    throw new Error("A completed match is required for its celebration.")
  }
  const dialog = useRef<HTMLDialogElement>(null)
  usePlayerInputScope({
    root: dialog,
    handle: (action) => {
      if (action !== "cancel") return false
      onDismiss()
      return true
    },
  })
  const reviewButton = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const opponent = stockfishOpponent(match.opponentId)
  const medal = matchVictoryMedal(match)
  const variant = match.startingPosition.variant
  const playerWon =
    (conclusion.type === "checkmate" ||
      conclusion.type === "resignation" ||
      conclusion.type === "timeout") &&
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
    return () => {
      if (element.open) element.close()
      if (restoreFocusRef.current?.isConnected) {
        restoreFocusRef.current.focus({ preventScroll: true })
      }
    }
  }, [restoreFocusRef])

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
  const action =
    match.mode === "challenge" || medal === null
      ? "replay"
      : next === undefined
        ? "ladder"
        : "next"
  const actionOpponent =
    action === "next"
      ? next?.opponent
      : action === "replay"
        ? opponent
        : undefined
  const actionElo =
    action === "next"
      ? next?.opponent.storyTargetElo
      : match.mode === "story"
        ? opponent.storyTargetElo
        : match.opponentTargetElo

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
      <div className="grid gap-3 p-[clamp(1rem,3vw,1.25rem)] text-center">
        <h2
          className="font-display text-[clamp(1.75rem,6vw,2.5rem)] leading-tight font-black text-balance"
          id={titleId}
        >
          {playerWon
            ? copy.gameplay.defeatedOpponent(animalCopy.opponent(opponent.id))
            : matchConclusionText(
                conclusion,
                match.playerColor,
                animalCopy.opponent(opponent.id),
                copy.gameplay.conclusion,
              )}
        </h2>
        {playerWon && conclusion.type === "resignation" ? (
          <p className="text-base">{messages.opponentResigned}</p>
        ) : null}
        {playerWon && conclusion.type === "timeout" ? (
          <p className="text-base">
            {copy.gameplay.conclusion.opponentTimedOut(
              animalCopy.opponent(opponent.id),
            )}
          </p>
        ) : null}
        <div className="bg-mapachito-orange flex flex-wrap items-center justify-center gap-3 rounded-lg px-3 py-2">
          <span className="font-bold">
            {timeControlLabel(match.timeControl, copy.gameplay.clock)}
          </span>
          {medal === null ? null : <MedalWithHintUse medal={medal} />}
          {reward === null ? null : (
            <p className="font-display text-3xl font-black tabular-nums">
              {copy.gameplay.awardedXp(reward.awardedXp)}
            </p>
          )}
        </div>
      </div>
      <div className="relative grid gap-3 p-[clamp(1rem,3vw,1.25rem)] pb-10">
        {reward === null ? null : (
          <MatchLevelProgress
            afterXp={reward.totalXpBefore + reward.awardedXp}
            beforeXp={reward.totalXpBefore}
          />
        )}
        {reward === null || reward.ratedElo === null ? null : (
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-base">
            <span className="font-bold">
              {copy.gameplay.clock.rating(
                copy.profile.ratingLabel[reward.ratedElo.variant],
                copy.gameplay.clock.category[
                  reward.ratedElo.timeCategory ?? "untimed"
                ],
              )}
            </span>
            <strong className="font-display text-xl tabular-nums">
              {copy.gameplay.integer(reward.ratedElo.before)} →{" "}
              {copy.gameplay.integer(reward.ratedElo.after)}
            </strong>
          </p>
        )}
        {match.mode === "story" && medal !== null && next === undefined ? (
          <p className="text-sm font-bold">{messages.storyComplete}</p>
        ) : null}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(7rem,100%),1fr))] gap-2">
          <MapachessButton
            autoFocus
            className="min-h-12 min-w-0 px-2! text-base wrap-break-word"
            onClick={onDismiss}
            ref={reviewButton}
            type="button"
            variant="secondary"
          >
            {messages.reviewBoard}
          </MapachessButton>
          <MapachessButton
            className="min-h-12 min-w-0 px-2! text-base wrap-break-word"
            disabled={disabled}
            onClick={nextAction}
            type="button"
          >
            {copy.gameplay.resultActions[action]}
            {actionOpponent !== undefined ? (
              <span className="mt-1 block text-base font-normal">
                {actionElo === undefined
                  ? animalCopy.opponent(actionOpponent.id)
                  : copy.gameplay.opponentAndElo(
                      animalCopy.opponent(actionOpponent.id),
                      actionElo,
                    )}
              </span>
            ) : null}
          </MapachessButton>
        </div>
        {showSaveConfirmation ? <MatchSaveConfirmation /> : null}
      </div>
    </dialog>
  )
}
