"use client"

import { useAnimate } from "motion/react"
import { useLayoutEffect } from "react"
import {
  MOVE_REACTION_DURATION_MS,
  type MoveReactionCard as ReactionCard,
} from "@mapachess/evaluation/move-reaction-machine"
import { MOVE_GRADE_LABELS } from "@mapachess/match/move-feedback"
import ClassifiedMoveText from "./ClassifiedMoveText"

export default function MoveReactionCard({
  card,
  onDismiss,
}: Readonly<{
  card: ReactionCard
  onDismiss: (presentationId: string) => void
}>) {
  const [countdown, animate] = useAnimate<HTMLSpanElement>()

  useLayoutEffect(() => {
    const playback = animate(
      countdown.current,
      { scaleX: [1, 0] },
      { duration: MOVE_REACTION_DURATION_MS / 1_000, ease: "linear" },
    )
    card.actor.send({ type: "MOVE_REACTION.PRESENTED" })
    return () => playback.stop()
  }, [animate, card.actor, countdown])

  const { mover, notation, classification } = card.reaction
  const color = mover === "white" ? "White" : "Black"

  return (
    <button
      type="button"
      className={`font-body pointer-events-auto relative min-h-10 w-full rounded px-2 py-2 text-base leading-tight wrap-anywhere shadow-sm ring-1 ring-current/40 focus-visible:outline-2 focus-visible:-outline-offset-2 ${mover === "white" ? "bg-mapachito-white text-mapachito-charcoal focus-visible:outline-mapachito-charcoal" : "bg-mapachito-charcoal text-mapachito-white focus-visible:outline-mapachito-white"}`}
      aria-label={`Dismiss ${color} ${notation} ${MOVE_GRADE_LABELS[classification.grade]}`}
      onClick={(event) => {
        event.stopPropagation()
        onDismiss(card.presentationId)
      }}
    >
      <ClassifiedMoveText notation={notation} grade={classification.grade} />
      <span
        ref={countdown}
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left rounded-full bg-linear-[to_right,var(--color-mapachito-raspberry),var(--color-mapachito-orange),var(--color-mapachito-green),var(--color-mapachito-blue),var(--color-mapachito-violet)] motion-reduce:invisible"
      />
    </button>
  )
}
