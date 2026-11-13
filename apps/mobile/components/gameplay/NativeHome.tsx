import cx from "classix"
import { ScrollView, View } from "react-native"
import {
  MATCH_MODE_CHOICES,
  type MatchModeSelection,
} from "@mapachess/match/match-setup"
import { timeControlLabel } from "@mapachess/match/time-control"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import NativeButton from "@/components/presentation/NativeButton"
import NativeText from "@/components/presentation/NativeText"
import { useNativeLocale } from "@/components/profile/NativeLocaleProvider"
import NativeProfileCard from "@/components/profile/NativeProfileCard"

export default function NativeHome({
  data,
  disabled,
  onSelect,
  onResume,
  onSettings,
  onCustomize,
  onShare,
}: Readonly<{
  data: MapachessPlayerData
  disabled: boolean
  onSelect: (mode: MatchModeSelection) => void
  onResume: () => void
  onSettings: () => void
  onCustomize: () => void
  onShare: () => void
}>) {
  const { copy } = useNativeLocale()
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="mx-auto w-full max-w-mapachess gap-5 p-4 pb-8 xl:p-6"
    >
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <NativeText accessibilityRole="header" className="font-native text-4xl">
          {copy.introduction.title}
        </NativeText>
        <NativeButton variant="secondary" onPress={onSettings}>
          {copy.interface.webGame.settings}
        </NativeButton>
      </View>
      <View className="flex-col gap-6 xl:flex-row xl:items-start">
        <View className="min-w-0 flex-1 gap-3">
          <NativeProfileCard data={data} />
          <View className="flex-row flex-wrap gap-2">
            <NativeButton
              disabled={disabled}
              variant="secondary"
              className="min-w-32 flex-1"
              onPress={onCustomize}
            >
              {copy.setup.customizeProfile}
            </NativeButton>
            <NativeButton
              disabled={disabled}
              className="bg-mapachito-blue min-w-32 flex-1"
              onPress={onShare}
            >
              {copy.setup.shareProfile}
            </NativeButton>
          </View>
        </View>
        <View className="min-w-0 flex-1 flex-row flex-wrap gap-3">
          {data.activeMatch === null ? null : (
            <NativeButton
              disabled={disabled}
              className="w-full"
              onPress={onResume}
            >
              <NativeText className="font-native text-center text-lg">
                {copy.interface.webGame.resumeMatch}
              </NativeText>
              <NativeText className="text-center">
                {timeControlLabel(
                  data.activeMatch.timeControl,
                  copy.gameplay.clock,
                )}
              </NativeText>
            </NativeButton>
          )}
          {MATCH_MODE_CHOICES.map(({ mode, variant }) => (
            <NativeButton
              key={`${variant}:${mode}`}
              disabled={disabled}
              accessibilityLabel={copy.setup.presentations[variant][mode].title}
              className={cx(
                "min-h-24 min-w-36 flex-1 basis-36 items-stretch",
                variant === "standard"
                  ? mode === "story"
                    ? "bg-mapachito-violet"
                    : "bg-mapachito-orange"
                  : mode === "story"
                    ? "bg-mapachito-deep-cyan"
                    : "bg-mapachito-raspberry",
              )}
              onPress={() => onSelect({ mode, variant })}
            >
              <NativeText className="font-native text-xl">
                {copy.setup.variants[variant]}
              </NativeText>
              <NativeText className="text-lg">
                {copy.setup.modes[mode]} →
              </NativeText>
            </NativeButton>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}
