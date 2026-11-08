import { View } from "react-native"
import { AUTO_HINT_MODES } from "@mapachess/match/auto-hint-mode"
import type { MatchMachineSnapshot } from "@mapachess/match/match-machine"
import { matchMedalEligibility } from "@mapachess/profile/match-medal"
import NativeButton from "../presentation/NativeButton"
import NativeMedal from "../presentation/NativeMedal"
import NativePanel from "../presentation/NativePanel"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "./NativeLocaleProvider"

export default function NativeAutoHintsHelp({
  onBack,
  match,
}: Readonly<{ onBack: () => void; match?: MatchMachineSnapshot }>) {
  const { copy } = useNativeLocale()
  const medal =
    match === undefined ? null : matchMedalEligibility(match.context)
  return (
    <NativePanel
      title={copy.shared.settingsControls.autoHints}
      onBack={onBack}
      actions={
        <NativeButton variant="secondary" onPress={onBack}>
          {copy.shared.settingsControls.close}
        </NativeButton>
      }
    >
      {medal === null ? null : (
        <View className="flex-row flex-wrap items-center gap-2">
          <NativeMedal medal={medal} />
          <NativeText className="font-native">
            {copy.gameplay.hints.eligibility(
              copy.shared.story.medals[medal],
              copy.shared.medalHintUse[medal],
            )}
          </NativeText>
        </View>
      )}
      {AUTO_HINT_MODES.map((mode) => (
        <View key={mode} className="gap-2">
          <NativeText className="font-native text-xl">
            {copy.setup.autoHints[mode].label}
          </NativeText>
          <NativeText>{copy.setup.autoHints[mode].description}</NativeText>
          <NativeText>{copy.setup.autoHints[mode].medal}</NativeText>
        </View>
      ))}
      <NativeText>{copy.setup.hintMedalExplanation}</NativeText>
      <NativeText>{copy.gameplay.hints.xpUnchanged}</NativeText>
    </NativePanel>
  )
}
