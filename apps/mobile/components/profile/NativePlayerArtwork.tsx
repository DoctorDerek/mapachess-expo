import type { SharedValue } from "react-native-reanimated"
import Svg, { Ellipse, G } from "react-native-svg"
import { useCSSVariable } from "uniwind"
import resolveOpponentPresentation from "@mapachess/match-presentation/opponent-presentation"
import {
  PROFILE_ARTWORK_HEIGHT,
  PROFILE_ARTWORK_WIDTH,
  profileCardCharacterLayout,
} from "@mapachess/match-presentation/profile-card-format"
import {
  HERO_IDLE_GEOMETRY,
  heroWeaponDefinition,
} from "@mapachess/profile/hero-catalog"
import {
  heroLayerPaths,
  type PlayerAppearance,
} from "@mapachess/profile/player-appearance"
import NativeSpriteImage from "@/components/presentation/NativeSpriteImage"

export default function NativePlayerArtwork({
  appearance,
  frame = 0,
  animal = true,
  onAssetLoaded,
  onAssetFailed,
  width = PROFILE_ARTWORK_WIDTH,
  height = PROFILE_ARTWORK_HEIGHT,
}: Readonly<{
  appearance: PlayerAppearance
  frame?: number | SharedValue<number>
  animal?: boolean
  onAssetLoaded?: (sourceId: string) => void
  onAssetFailed?: (sourceId: string) => void
  width?: number
  height?: number
}>) {
  const bounds = heroWeaponDefinition(appearance.weapon).bounds
  const presentation = resolveOpponentPresentation(appearance.animal)
  const blue = useCSSVariable("--color-profile-card-blue")
  const animalAnimation =
    animal && presentation.kind === "sprite"
      ? presentation.steps[0].animation
      : null
  const layout = profileCardCharacterLayout({
    width,
    height,
    heroBounds: bounds,
    animalBounds:
      animalAnimation === null
        ? null
        : {
            width: animalAnimation.geometry.visibleWidth,
            height: animalAnimation.geometry.visibleHeight,
          },
  })
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <Ellipse
        cx={layout.ground.x}
        cy={layout.ground.y}
        rx={layout.ground.radiusX}
        ry={layout.ground.radiusY}
        fill={typeof blue === "string" ? blue : undefined}
        opacity={0.28}
      />
      <Svg
        x={layout.hero.x}
        y={layout.hero.y}
        width={layout.hero.width}
        height={layout.hero.height}
        viewBox={`${String(bounds.x)} ${String(bounds.y)} ${String(bounds.width)} ${String(bounds.height)}`}
      >
        {heroLayerPaths(appearance).map((path) => (
          <NativeSpriteImage
            key={path}
            onAssetLoaded={onAssetLoaded}
            onAssetFailed={onAssetFailed}
            sourceId={`/generated/presentation-assets/${path}`}
            frame={frame}
            frameWidth={HERO_IDLE_GEOMETRY.width}
            frameHeight={HERO_IDLE_GEOMETRY.height}
            frameCount={HERO_IDLE_GEOMETRY.frameCount}
          />
        ))}
      </Svg>
      {animalAnimation !== null && layout.animal !== null ? (
        <G>
          <Svg
            x={layout.animal.x}
            y={layout.animal.y}
            width={layout.animal.width}
            height={layout.animal.height}
            viewBox={`${String(animalAnimation.geometry.visibleX)} ${String(animalAnimation.geometry.visibleY)} ${String(animalAnimation.geometry.visibleWidth)} ${String(animalAnimation.geometry.visibleHeight)}`}
          >
            <NativeSpriteImage
              sourceId={animalAnimation.sourceId}
              onAssetLoaded={onAssetLoaded}
              onAssetFailed={onAssetFailed}
              frame={frame}
              frameWidth={animalAnimation.geometry.frameWidth}
              frameHeight={animalAnimation.geometry.frameHeight}
              frameCount={animalAnimation.frameCount}
            />
          </Svg>
        </G>
      ) : null}
    </Svg>
  )
}
