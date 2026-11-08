import cx from "classix"
import { View } from "react-native"
import type createMoveReactionController from "@mapachess/evaluation/move-reaction-controller"
import useActorSnapshot from "@/lib/useActorSnapshot"
import NativeButton from "../presentation/NativeButton"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "../profile/NativeLocaleProvider"

export default function NativeMoveRatings({
  controller,
}: Readonly<{ controller: ReturnType<typeof createMoveReactionController> }>) {
  const snapshot = useActorSnapshot(controller.actor)
  const { copy } = useNativeLocale()
  return (
    <View pointerEvents="box-none" className="w-full gap-1 p-1">
      {snapshot.context.cards.map(({ presentationId, reaction }) => (
        <NativeButton
          key={presentationId}
          className={cx(
            "border-mapachito-white min-h-12 flex-row rounded-lg py-1",
            reaction.mover === "white"
              ? "bg-mapachito-white"
              : "bg-mapachito-charcoal",
          )}
          accessibilityLabel={copy.board.dismissReaction(
            reaction.mover,
            reaction.notation,
            copy.shared.moveGrades[reaction.classification.grade],
          )}
          onPress={() =>
            controller.actor.send({
              type: "MOVE_REACTION.DISMISSED",
              presentationId,
            })
          }
        >
          <NativeText
            className={cx(
              "font-native text-center",
              reaction.mover === "white" && "text-mapachito-charcoal",
            )}
          >
            {reaction.notation} ·{" "}
            {copy.shared.moveGrades[reaction.classification.grade]} ×
          </NativeText>
        </NativeButton>
      ))}
    </View>
  )
}
