import cx from "classix"
import { View } from "react-native"
import type createMoveReactionController from "@mapachess/evaluation/move-reaction-controller"
import { selectMoveReactionColumns } from "@mapachess/evaluation/move-reaction-machine"
import type { MatchColor } from "@mapachess/match/match-position"
import type { MoveReactionPlacement } from "@mapachess/profile/presentation-preferences"
import useActorSnapshot from "@/lib/useActorSnapshot"
import NativeMoveReactionCard from "./NativeMoveReactionCard"

export default function NativeMoveRatings({
  controller,
  playerColor,
  placement,
  active,
  reducedMotion,
}: Readonly<{
  controller: ReturnType<typeof createMoveReactionController>
  playerColor: MatchColor
  placement: MoveReactionPlacement
  active: boolean
  reducedMotion: boolean
}>) {
  const snapshot = useActorSnapshot(controller.actor)
  const columns = selectMoveReactionColumns(snapshot, playerColor)
  return (
    <View
      pointerEvents="box-none"
      className="h-full w-full flex-row gap-2 p-1 xl:p-0"
    >
      {(["hero", "opponent"] as const).map((participant) => (
        <View
          key={participant}
          pointerEvents="box-none"
          accessibilityLiveRegion="polite"
          className={cx(
            "min-w-0 flex-1 gap-1",
            placement === "middle" && "justify-center",
            placement === "bottom" && "justify-end",
          )}
        >
          {columns[participant].map((card) => (
            <NativeMoveReactionCard
              key={card.presentationId}
              card={card}
              active={active}
              reducedMotion={reducedMotion}
              onDismiss={(presentationId) =>
                controller.actor.send({
                  type: "MOVE_REACTION.DISMISSED",
                  presentationId,
                })
              }
            />
          ))}
        </View>
      ))}
    </View>
  )
}
