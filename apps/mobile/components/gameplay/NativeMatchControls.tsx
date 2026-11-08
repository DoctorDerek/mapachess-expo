import type { ReactNode } from "react"
import { View } from "react-native"
import type { MatchSession } from "@mapachess/gameplay/match-session"
import {
  selectAreMatchMutationsFrozen,
  selectAutoHintMode,
  selectCanRedo,
  selectCanUndo,
  selectHintStage,
  selectMatchConclusion,
  type MatchMachineSnapshot,
} from "@mapachess/match/match-machine"
import type { MatchNavigationCommands } from "@mapachess/match/match-navigation"
import NativeButton from "../presentation/NativeButton"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "../profile/NativeLocaleProvider"

export default function NativeMatchControls({
  session,
  snapshot,
  navigation,
  coach,
}: Readonly<{
  session: MatchSession
  snapshot: MatchMachineSnapshot
  navigation: MatchNavigationCommands
  coach: ReactNode
}>) {
  const { copy } = useNativeLocale()
  const mode = selectAutoHintMode(snapshot)
  const stage = selectHintStage(snapshot)
  const complete = selectMatchConclusion(snapshot) !== null
  const frozen = selectAreMatchMutationsFrozen(snapshot)
  return (
    <View className="gap-2">
      <View className="items-center justify-center">{coach}</View>
      <View className="flex-row items-stretch gap-2">
        <NativeButton
          variant="secondary"
          className="min-w-0 flex-1"
          disabled={complete || frozen}
          onPress={() => navigation.open("match-hints")}
        >
          <NativeText className="font-native text-center text-sm">
            {copy.gameplay.hints.autoLabel}
          </NativeText>
          <NativeText className="font-native text-center text-sm">
            {copy.gameplay.hints.autoMode[mode]}
          </NativeText>
        </NativeButton>
        <NativeButton
          variant="secondary"
          className="min-h-14 min-w-14"
          accessibilityLabel={copy.shared.settingsControls.explainAutoHints}
          onPress={() => navigation.open("auto-hints-help")}
        >
          ?
        </NativeButton>
        <NativeButton
          variant="hint"
          action="hints"
          className="min-w-0 flex-1"
          disabled={
            complete ||
            frozen ||
            !["ready", "failure", "piece-hints"].includes(stage)
          }
          onPress={() =>
            session.actor.send({
              type:
                stage === "piece-hints"
                  ? "MATCH.MOVE_HINTS_REQUESTED"
                  : "MATCH.PIECE_HINTS_REQUESTED",
            })
          }
        >
          <NativeText className="font-native text-mapachito-charcoal text-center text-sm">
            {copy.gameplay.hints.getHint}
          </NativeText>
          <NativeText className="text-mapachito-charcoal text-center text-xs">
            {complete
              ? copy.gameplay.hints.controls.complete
              : copy.gameplay.hints.controls[stage]}
          </NativeText>
        </NativeButton>
      </View>
      <View className="flex-row items-stretch gap-2">
        <NativeButton
          variant="secondary"
          className="min-w-0 flex-1"
          onPress={() => navigation.open("match-menu")}
          action="menu"
        >
          {copy.interface.matchCommands.menu}
        </NativeButton>
        <NativeButton
          variant="secondary"
          className="min-w-0 flex-1"
          disabled={!selectCanUndo(snapshot)}
          action="undo"
          onPress={() => session.actor.send({ type: "MATCH.UNDO_REQUESTED" })}
        >
          {copy.interface.matchCommands.undo}
        </NativeButton>
        <NativeButton
          variant="secondary"
          className="min-w-0 flex-1"
          disabled={!selectCanRedo(snapshot)}
          action="redo"
          onPress={() => session.actor.send({ type: "MATCH.REDO_REQUESTED" })}
        >
          {copy.interface.matchCommands.redo}
        </NativeButton>
      </View>
    </View>
  )
}
