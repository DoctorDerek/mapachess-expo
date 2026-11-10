"use client"

import {
  useEffect,
  useId,
  useRef,
  type RefCallback,
  type RefObject,
} from "react"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import type { MatchSetup } from "@mapachess/match/match-setup"
import matchResultPresentation, {
  matchResultRating,
} from "@mapachess/profile/match-result-presentation"
import type { AcceptedMatchReward } from "@mapachess/profile/player-data"
import type { StoryProgress } from "@mapachess/profile/story-progress"
import { usePlayerInputScope } from "../input/PlayerInputProvider"
import MapachessButton from "../presentation/MapachessButton"
import MedalSymbol from "../presentation/MedalSymbol"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import MatchLevelProgress from "./MatchLevelProgress"
import MatchSaveConfirmation from "./MatchSaveConfirmation"
import MedalWithHintUse from "./MedalWithHintUse"

const resultActionClassName =
  "min-w-0 flex-[1_1_8em] px-2! py-2! text-base wrap-break-word"

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

  const result = matchResultPresentation(match, storyProgress, copy)
  if (result === null) {
    throw new Error("A completed match is required for its celebration.")
  }
  const { action, heading, medal, reason, storyComplete, timeLabel } = result
  const rating = matchResultRating(match, reward)
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
    if (action.setup === null) onReplayRequested()
    else onSetupRequested(action.setup)
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal fixed inset-0 m-auto h-[min(48rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] w-[min(94vw,30rem)] max-w-none overflow-hidden overscroll-contain rounded-[1.5rem_0.5rem_1.5rem_0.5rem] border-3 p-0 shadow-[0.625rem_0.625rem_0_#1e1e1e] backdrop:bg-black/75 forced-colors:shadow-none"
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
      ref={dialog}
    >
      <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
        <div className="shrink-0" ref={battleStageRef} />
        <div className="grid min-w-0 shrink-0 gap-3 p-[clamp(1rem,3vw,1.25rem)] text-center">
          <h2
            className="font-display text-[clamp(1.75rem,6vw,2.5rem)] leading-tight font-black text-balance wrap-anywhere"
            id={titleId}
          >
            {heading}
          </h2>
          {reason === null ? null : <p className="text-base">{reason}</p>}
          <div className="bg-mapachito-orange flex flex-wrap items-center justify-center gap-3 rounded-lg px-3 py-2">
            <span className="font-bold">{timeLabel}</span>
            {medal === null ? null : <MedalWithHintUse medal={medal} />}
            {reward === null ? null : (
              <p className="font-display text-3xl font-black tabular-nums">
                {copy.gameplay.awardedXp(reward.awardedXp)}
              </p>
            )}
          </div>
        </div>
        <div className="relative grid min-w-0 shrink-0 gap-3 px-3 pb-6 xl:order-1 xl:mb-4">
          {rating === null ? null : (
            <p className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-base">
              <span className="grid min-w-0 flex-[1_1_min-content] gap-1 wrap-break-word">
                <span className="font-bold">
                  {copy.profile.ratingLabel[rating.variant]}
                </span>
                <span>
                  <MedalSymbol medal={rating.assistance} />
                  {copy.profile.cardRatingContext(
                    copy.gameplay.clock.category[rating.timeCategory],
                    copy.shared.story.medals[rating.assistance],
                  )}
                </span>
              </span>
              <strong className="font-display text-right text-xl tabular-nums">
                {copy.gameplay.integer(rating.before)} →{" "}
                {copy.gameplay.integer(rating.after)}
              </strong>
            </p>
          )}
          {storyComplete ? (
            <p className="text-sm font-bold">{messages.storyComplete}</p>
          ) : null}
          {showSaveConfirmation ? <MatchSaveConfirmation /> : null}
        </div>
        <footer className="bg-mapachito-white sticky bottom-0 z-10 mt-auto flex min-w-0 shrink-0 flex-wrap gap-2 px-2 pt-3 pb-2 xl:order-last">
          <MapachessButton
            autoFocus
            className={resultActionClassName}
            onClick={onDismiss}
            ref={reviewButton}
            type="button"
            variant="secondary"
          >
            {messages.reviewBoard}
          </MapachessButton>
          <MapachessButton
            className={resultActionClassName}
            disabled={disabled}
            onClick={nextAction}
            type="button"
          >
            {copy.gameplay.resultActions[action.kind]}
            {action.kind === "ladder" ? null : (
              <span className="mt-1 block text-base leading-snug font-normal">
                {action.target.elo === undefined
                  ? animalCopy.opponent(action.target.id)
                  : copy.gameplay.opponentAndElo(
                      animalCopy.opponent(action.target.id),
                      action.target.elo,
                    )}
              </span>
            )}
          </MapachessButton>
        </footer>
        {reward === null ? null : (
          <div className="mx-2 mb-2 shrink-0 xl:mx-3 xl:mb-3">
            <MatchLevelProgress
              afterXp={reward.totalXpBefore + reward.awardedXp}
              beforeXp={reward.totalXpBefore}
            />
          </div>
        )}
      </div>
    </dialog>
  )
}
