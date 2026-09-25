"use client"

import { useSelector } from "@xstate/react"
import type { ActorRefFrom } from "xstate"
import moveReactionMachine, {
  selectMoveReactionColumns,
} from "@mapachess/evaluation/move-reaction-machine"
import type { MatchColor } from "@mapachess/match/match-position"
import MoveReactionCard from "./MoveReactionCard"

export default function MoveReactionFeedback({
  actor,
  playerColor,
}: Readonly<{
  actor: ActorRefFrom<typeof moveReactionMachine>
  playerColor: MatchColor
}>) {
  const snapshot = useSelector(actor, (current) => current)
  const columns = selectMoveReactionColumns(snapshot, playerColor)
  const dismiss = (presentationId: string) =>
    actor.send({ type: "MOVE_REACTION.DISMISSED", presentationId })

  return (
    <div className="pointer-events-none grid w-full grid-cols-2 items-start gap-2">
      <div className="flex min-w-0 flex-col gap-1" aria-live="polite">
        {columns.hero.map((card) => (
          <MoveReactionCard
            key={card.presentationId}
            card={card}
            onDismiss={dismiss}
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-1" aria-live="polite">
        {columns.opponent.map((card) => (
          <MoveReactionCard
            key={card.presentationId}
            card={card}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </div>
  )
}
