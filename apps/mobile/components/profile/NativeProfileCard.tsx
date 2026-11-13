import { View } from "react-native"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import { cardFacts } from "@mapachess/profile/profile-card-model"
import type { CardRatingContext } from "@mapachess/profile/rating-context"
import NativeMedal from "@/components/presentation/NativeMedal"
import NativeText from "@/components/presentation/NativeText"
import NativeAnimatedPlayerArtwork from "./NativeAnimatedPlayerArtwork"
import { useNativeLocale } from "./NativeLocaleProvider"

export default function NativeProfileCard({
  data,
  appearance = data.appearance,
  ratingContext = data.settings.cardRatingContext,
}: Readonly<{
  data: MapachessPlayerData
  appearance?: PlayerAppearance
  ratingContext?: CardRatingContext
}>) {
  const { copy } = useNativeLocale()
  const facts = cardFacts(data, ratingContext)
  const contextLabel = copy.profile.cardRatingContext(
    copy.gameplay.clock.category[ratingContext.category],
    copy.shared.story.medals[ratingContext.assistance],
  )
  return (
    <View className="shadow-mapachess-raised shadow-profile-card-blue min-h-60 flex-row flex-wrap-reverse overflow-hidden">
      <View
        accessible
        accessibilityLabel={copy.profile.cardDescription(
          facts.level,
          facts.standard,
          facts.chess960,
          contextLabel,
        )}
        className="bg-profile-card-yellow min-w-0 flex-[2_1_8rem] justify-evenly gap-3 p-3"
      >
        <View className="flex-row flex-wrap items-baseline gap-2">
          <NativeText className="font-native text-profile-card-ink text-lg">
            {copy.profile.level}
          </NativeText>
          <NativeText className="font-native text-profile-card-ink text-3xl">
            {facts.level}
          </NativeText>
        </View>
        {(["standard", "chess960"] as const).map((variant) => (
          <View
            key={variant}
            className="min-w-0 flex-row flex-wrap-reverse items-center justify-between gap-x-2 gap-y-1"
          >
            <View className="min-w-0 grow basis-28 gap-1">
              <NativeText className="font-native text-profile-card-ink leading-tight">
                {copy.profile.ratingLabel[variant]}
              </NativeText>
              <View className="flex-row flex-wrap items-center gap-1">
                <NativeMedal medal={ratingContext.assistance} />
                <NativeText className="text-profile-card-ink text-sm">
                  {contextLabel}
                </NativeText>
              </View>
            </View>
            <NativeText className="font-native text-profile-card-ink text-3xl leading-none tabular-nums">
              {facts[variant]}
            </NativeText>
          </View>
        ))}
      </View>
      <View className="bg-profile-card-cyan min-h-60 min-w-0 flex-[3_1_9rem]">
        <NativeAnimatedPlayerArtwork appearance={appearance} />
      </View>
    </View>
  )
}
