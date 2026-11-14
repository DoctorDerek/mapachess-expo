import cx from "classix"
import { View } from "react-native"
import type {
  ProfileCardElements,
  ProfileCardGroupProps,
  ProfileCardTextProps,
} from "@mapachess/application-ui/home-elements"
import SharedProfileCard from "@mapachess/application-ui/profile-card"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { CardInput } from "@mapachess/profile/profile-card-model"
import type { CardRatingContext } from "@mapachess/profile/rating-context"
import NativeMedal from "@/components/presentation/NativeMedal"
import NativeText from "@/components/presentation/NativeText"
import NativeAnimatedPlayerArtwork from "@/components/profile/NativeAnimatedPlayerArtwork"
import { useNativeLocale } from "@/components/profile/NativeLocaleProvider"

function CardGroup({
  region,
  description,
  className,
  children,
}: ProfileCardGroupProps) {
  return (
    <View
      accessible={region === "facts"}
      accessibilityLabel={region === "facts" ? description : undefined}
      className={cx(
        className,
        region === "body" && "min-h-60",
        region === "facts" && "p-3",
      )}
    >
      {children}
    </View>
  )
}

function CardText({ children, className }: ProfileCardTextProps) {
  return <NativeText className={className}>{children}</NativeText>
}

function CardArtwork({ input }: Readonly<{ input: CardInput }>) {
  return <NativeAnimatedPlayerArtwork appearance={input.appearance} />
}

export const nativeProfileCardElements: ProfileCardElements = {
  Group: CardGroup,
  Text: CardText,
  Artwork: CardArtwork,
  Medal: NativeMedal,
}

export default function NativeProfileCard({
  data,
  appearance = data.appearance,
  ratingContext = data.settings.cardRatingContext,
}: Readonly<{
  data: MapachessPlayerData
  appearance?: PlayerAppearance
  ratingContext?: CardRatingContext
}>) {
  const { copy, locale } = useNativeLocale()
  return (
    <SharedProfileCard
      data={data}
      appearance={appearance}
      ratingContext={ratingContext}
      copy={copy}
      locale={locale}
      elements={nativeProfileCardElements}
    />
  )
}
