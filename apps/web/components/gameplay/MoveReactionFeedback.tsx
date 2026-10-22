"use client"

import { useSelector } from "@xstate/react"
import cx from "classix"
import type { ActorRefFrom } from "xstate"
import moveReactionMachine, {
  selectMoveReactionColumns,
} from "@mapachess/evaluation/move-reaction-machine"
import type { MatchColor } from "@mapachess/match/match-position"
import type { MoveReactionPlacement } from "@mapachess/profile/presentation-preferences"
import MoveReactionCard from "./MoveReactionCard"

export default function MoveReactionFeedback({
  actor,
  playerColor,
  placement,
}: Readonly<{
  actor: ActorRefFrom<typeof moveReactionMachine>
  playerColor: MatchColor
  placement: MoveReactionPlacement
}>) {
  const snapshot = useSelector(actor, (current) => current)
  const columns = selectMoveReactionColumns(snapshot, playerColor)
  const dismiss = (presentationId: string) =>
    actor.send({ type: "MOVE_REACTION.DISMISSED", presentationId })

  return (
    <div
      className={cx(
        "pointer-events-none absolute inset-0 z-30 min-h-0 min-w-0 xl:relative xl:[grid-area:auto]",
        placement === "top" ? "[grid-area:identity]" : "[grid-area:board]",
      )}
    >
      <div className="absolute inset-0 grid grid-cols-2 gap-2 p-1 xl:p-0">
        {(["hero", "opponent"] as const).map((participant) => (
          <div
            key={participant}
            className={cx(
              "flex min-h-0 min-w-0 flex-col gap-1",
              placement === "middle" && "justify-center-safe",
              placement === "bottom" && "justify-end-safe",
            )}
            aria-live="polite"
          >
            {columns[participant].map((card) => (
              <MoveReactionCard
                key={card.presentationId}
                card={card}
                onDismiss={dismiss}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
