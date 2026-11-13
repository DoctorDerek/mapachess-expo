import { forwardRef } from "react"
import Svg, { Ellipse, G, Image, Rect, Text, TSpan } from "react-native-svg"
import { useCSSVariable } from "uniwind"
import {
  PROFILE_CARD_HEIGHT,
  PROFILE_CARD_LAYOUT,
  PROFILE_CARD_WIDTH,
  PROFILE_CARD_TYPOGRAPHY as typography,
} from "@mapachess/match-presentation/profile-card-format"
import type { CardInput } from "@mapachess/profile/profile-card-model"
import assets from "@/lib/presentation/nativeAssetManifest"
import { useNativeLocale } from "./NativeLocaleProvider"
import NativePlayerArtwork from "./NativePlayerArtwork"

const NativeCardArtwork = forwardRef<
  Svg,
  Readonly<{
    input: CardInput
    frame: number
    onAssetLoaded?: (sourceId: string) => void
  }>
>(function NativeCardArtwork({ input, frame, onAssetLoaded }, ref) {
  const { copy } = useNativeLocale()
  const color = useCSSVariable([
    "--color-profile-card-yellow",
    "--color-profile-card-cyan",
    "--color-profile-card-mint",
    "--color-profile-card-blue",
    "--color-profile-card-ink",
    "--color-mapachito-white",
  ])
  const [yellow, cyan, mint, blue, ink, white] = color.map((value) =>
    typeof value === "string" ? value : undefined,
  )
  const face = useCSSVariable("--font-native")
  const font = typeof face === "string" ? face : undefined
  const { facts, content } = input
  const items = [
    ...(content.level
      ? [{ id: "level", label: copy.profile.level, value: facts.level }]
      : []),
    ...(content.standard
      ? [
          {
            id: "standard",
            label: copy.profile.ratingLabel.standard,
            value: facts.standard,
          },
        ]
      : []),
    ...(content.chess960
      ? [
          {
            id: "chess960",
            label: copy.profile.ratingLabel.chess960,
            value: facts.chess960,
          },
        ]
      : []),
  ]
  const factsWidth = items.length > 0 ? PROFILE_CARD_LAYOUT.factsWidth : 0
  const height = PROFILE_CARD_HEIGHT - PROFILE_CARD_LAYOUT.invitationHeight
  const medalId = `/medals/${facts.ratingContext.assistance}.png`
  const medal = assets.images[medalId]
  return (
    <Svg
      ref={ref}
      width="100%"
      height="100%"
      viewBox={`0 0 ${PROFILE_CARD_WIDTH} ${PROFILE_CARD_HEIGHT}`}
    >
      <Rect
        width={PROFILE_CARD_WIDTH}
        height={PROFILE_CARD_HEIGHT}
        fill={cyan}
      />
      <Ellipse
        cx={PROFILE_CARD_WIDTH * 0.71}
        cy={height * 0.73}
        rx={PROFILE_CARD_WIDTH * 0.4}
        ry={height * 0.69}
        fill={mint}
      />
      <Rect
        x={factsWidth}
        y={height * 0.91}
        width={PROFILE_CARD_WIDTH - factsWidth}
        height={height * 0.09}
        fill={blue}
      />
      <Svg
        x={factsWidth}
        width={PROFILE_CARD_WIDTH - factsWidth}
        height={height}
        viewBox={`0 0 ${PROFILE_CARD_WIDTH - factsWidth} ${height}`}
      >
        <NativePlayerArtwork
          appearance={input.appearance}
          animal={content.animal}
          frame={frame}
          onAssetLoaded={onAssetLoaded}
          width={PROFILE_CARD_WIDTH - factsWidth}
          height={height}
        />
      </Svg>
      <Rect width={factsWidth} height={height} fill={yellow} />
      {items.map((item, index) => {
        const center = (height * (index + 0.5)) / items.length
        const left = PROFILE_CARD_LAYOUT.factsInset
        return (
          <G key={item.id}>
            {item.id === "level" ? (
              <Text
                x={left}
                y={center}
                alignmentBaseline="middle"
                fontSize={typography.label.size}
                fontFamily={font}
                fill={ink}
              >
                {item.label}
                <TSpan
                  dx={PROFILE_CARD_LAYOUT.levelLabelGap}
                  fontSize={typography.value.size}
                >
                  {String(item.value)}
                </TSpan>
              </Text>
            ) : (
              <>
                <Text
                  x={left}
                  y={center + PROFILE_CARD_LAYOUT.ratingValueOffset}
                  alignmentBaseline="middle"
                  fontSize={typography.value.size}
                  fontFamily={font}
                  fill={ink}
                >
                  {String(item.value)}
                </Text>
                <Text
                  x={left}
                  y={center + PROFILE_CARD_LAYOUT.ratingLabelOffset}
                  alignmentBaseline="middle"
                  fontSize={typography.label.size}
                  fontFamily={font}
                  fill={ink}
                >
                  {item.label}
                </Text>
                {medal === undefined ? null : (
                  <Image
                    href={medal}
                    x={left}
                    y={
                      center +
                      PROFILE_CARD_LAYOUT.categoryOffset -
                      PROFILE_CARD_LAYOUT.medalSize / 2
                    }
                    width={PROFILE_CARD_LAYOUT.medalSize}
                    height={PROFILE_CARD_LAYOUT.medalSize}
                    onLoad={() => onAssetLoaded?.(medalId)}
                  />
                )}
                <Text
                  x={
                    left +
                    PROFILE_CARD_LAYOUT.medalSize +
                    PROFILE_CARD_LAYOUT.medalGap
                  }
                  y={center + PROFILE_CARD_LAYOUT.categoryOffset}
                  alignmentBaseline="middle"
                  fontSize={typography.category.size}
                  fontFamily={font}
                  fill={ink}
                >
                  {copy.profile.cardRatingContext(
                    copy.gameplay.clock.category[facts.ratingContext.category],
                    copy.shared.story.medals[facts.ratingContext.assistance],
                  )}
                </Text>
              </>
            )}
          </G>
        )
      })}
      <Rect
        y={height}
        width={PROFILE_CARD_WIDTH}
        height={PROFILE_CARD_LAYOUT.invitationHeight}
        fill={ink}
      />
      <Text
        x={PROFILE_CARD_WIDTH / 2}
        y={height + PROFILE_CARD_LAYOUT.invitationHeight / 2}
        alignmentBaseline="middle"
        textAnchor="middle"
        fontFamily={font}
        fontSize={typography.invitation.size}
        fill={white}
      >
        {copy.profile.playFree}
      </Text>
    </Svg>
  )
})
export default NativeCardArtwork
