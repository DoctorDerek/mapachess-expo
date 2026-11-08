import { View } from "react-native"
import { levelFromTotalXp } from "@mapachess/profile/global-xp"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import {
  playerRatingId,
  type CardRatingContext,
} from "@mapachess/profile/rating-context"
import NativeMedal from "../presentation/NativeMedal"
import NativeText from "../presentation/NativeText"
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
  const contextLabel = copy.profile.cardRatingContext(
    copy.gameplay.clock.category[ratingContext.category],
    copy.shared.story.medals[ratingContext.assistance],
  )
  return (
    <View className="min-h-60 flex-row flex-wrap-reverse overflow-hidden rounded-lg">
      <View className="bg-profile-card-yellow min-w-36 flex-1 justify-evenly gap-3 p-3">
        <View className="flex-row flex-wrap items-baseline gap-2">
          <NativeText className="font-native text-profile-card-ink text-lg">
            {copy.profile.level}
          </NativeText>
          <NativeText className="font-native text-profile-card-ink text-3xl">
            {levelFromTotalXp(data.totalXp)}
          </NativeText>
        </View>
        {(["standard", "chess960"] as const).map((variant) => (
          <View key={variant} className="gap-1">
            <NativeText className="font-native text-profile-card-ink text-3xl">
              {copy.gameplay.elo(
                data.ratings[
                  playerRatingId(
                    variant,
                    ratingContext.category,
                    ratingContext.assistance,
                  )
                ],
              )}
            </NativeText>
            <NativeText className="font-native text-profile-card-ink">
              {copy.profile.ratingLabel[variant]}
            </NativeText>
            <View className="flex-row flex-wrap items-center gap-1">
              <NativeMedal medal={ratingContext.assistance} />
              <NativeText className="text-profile-card-ink text-sm">
                {contextLabel}
              </NativeText>
            </View>
          </View>
        ))}
      </View>
      <View className="bg-profile-card-cyan min-h-60 min-w-40 flex-1">
        <NativeAnimatedPlayerArtwork appearance={appearance} />
      </View>
    </View>
  )
}
