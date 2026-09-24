"use client"

import { useSelector } from "@xstate/react"
import { useLayoutEffect } from "react"
import type { ActorRefFrom } from "xstate"
import moveReactionMachine, {
  selectMoveReactionWaitingCounts,
} from "@mapachess/evaluation/move-reaction-machine"
import { moveGradeText } from "@mapachess/match/move-feedback"

export default function MoveReactionFeedback({
  actor,
}: Readonly<{ actor: ActorRefFrom<typeof moveReactionMachine> }>) {
  const snapshot = useSelector(actor, (current) => current)
  const reaction = snapshot.context.visible
  const counts = selectMoveReactionWaitingCounts(snapshot)

  useLayoutEffect(() => {
    if (reaction !== null)
      actor.send({ type: "MOVE_REACTION.PRESENTED", id: reaction.id })
  }, [actor, reaction])

  if (reaction === null) return null
  const grade = moveGradeText(reaction.mover, reaction.classification.grade)

  return (
    <button
      type="button"
      className="bg-mapachito-charcoal font-body relative grid h-10 grid-cols-[1.75rem_max-content_1.75rem] items-center gap-1 rounded px-1 text-base font-bold whitespace-nowrap text-white focus-visible:outline-2"
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
    </button>
  )
}
