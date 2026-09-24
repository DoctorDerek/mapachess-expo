"use client"

import { useSelector } from "@xstate/react"
import { useAnimate } from "motion/react"
import { useLayoutEffect } from "react"
import type { ActorRefFrom } from "xstate"
import moveReactionMachine, {
  MOVE_REACTION_DURATION_MS,
  selectMoveReactionWaitingCounts,
} from "@mapachess/evaluation/move-reaction-machine"
import { moveGradeText } from "@mapachess/match/move-feedback"

export default function MoveReactionFeedback({
  actor,
}: Readonly<{ actor: ActorRefFrom<typeof moveReactionMachine> }>) {
  const snapshot = useSelector(actor, (current) => current)
  const reaction = snapshot.context.visible
  const counts = selectMoveReactionWaitingCounts(snapshot)
  const [countdown, animate] = useAnimate<HTMLSpanElement>()

  useLayoutEffect(() => {
    if (reaction === null) return
    const playback = animate(
      countdown.current,
      { scaleX: [1, 0] },
      { duration: MOVE_REACTION_DURATION_MS / 1_000, ease: "linear" },
    )
    actor.send({ type: "MOVE_REACTION.PRESENTED", id: reaction.id })
    return () => playback.stop()
  }, [actor, animate, countdown, reaction])

  if (reaction === null) return null
  const grade = moveGradeText(reaction.mover, reaction.classification.grade)

  return (
    <button
      type="button"
      className="bg-mapachito-charcoal font-body pointer-events-auto relative grid h-10 grid-cols-[1.75rem_max-content_1.75rem] items-center gap-1 rounded px-1 text-base font-bold whitespace-nowrap text-white focus-visible:outline-2"
      aria-label={`Dismiss ${grade}. Waiting: White ${String(counts.white)}, Black ${String(counts.black)}.`}
      onClick={() =>
        actor.send({ type: "MOVE_REACTION.DISMISSED", id: reaction.id })
      }
    >
      <span
        aria-hidden="true"
        className={`bg-mapachito-white text-mapachito-charcoal inline-grid size-7 place-items-center rounded-full text-sm tabular-nums ${counts.white === 0 ? "invisible" : ""}`}
      >
        {counts.white}
      </span>
      <span>{grade}</span>
      <span
        aria-hidden="true"
        className={`bg-mapachito-charcoal inline-grid size-7 place-items-center rounded-full text-sm tabular-nums outline outline-white ${counts.black === 0 ? "invisible" : ""}`}
      >
        {counts.black}
      </span>
      <span
        key={reaction.id}
        ref={countdown}
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left rounded-full bg-linear-[to_right,var(--color-mapachito-raspberry),var(--color-mapachito-orange),var(--color-mapachito-green),var(--color-mapachito-blue),var(--color-mapachito-violet)] motion-reduce:invisible"
      />
    </button>
  )
}
