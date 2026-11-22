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
        "pointer-events-none absolute inset-0 z-30 col-start-1 col-end-2 min-h-0 min-w-0 xl:relative xl:col-start-2 xl:col-end-3 xl:row-start-4 xl:row-end-5 xl:mt-2",
        placement === "top" ? "row-start-1 row-end-2" : "row-start-3 row-end-4",
      )}
    >
      <div
        className={cx(
          "absolute inset-0 grid grid-cols-2 gap-1 px-1 xl:p-0",
          placement !== "top" && "py-1",
        )}
      >
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
