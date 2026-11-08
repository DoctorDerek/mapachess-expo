import type { SharedValue } from "react-native-reanimated"
import Svg, { Ellipse, G } from "react-native-svg"
import { useCSSVariable } from "uniwind"
import resolveOpponentPresentation from "@mapachess/match-presentation/opponent-presentation"
import {
  HERO_IDLE_GEOMETRY,
  heroWeaponDefinition,
} from "@mapachess/profile/hero-catalog"
import {
  heroLayerPaths,
  type PlayerAppearance,
} from "@mapachess/profile/player-appearance"
import NativeSpriteImage from "../presentation/NativeSpriteImage"

export default function NativePlayerArtwork({
  appearance,
  frame = 0,
  animal = true,
  onAssetLoaded,
}: Readonly<{
  appearance: PlayerAppearance
  frame?: number | SharedValue<number>
  animal?: boolean
  onAssetLoaded?: (sourceId: string) => void
}>) {
  const bounds = heroWeaponDefinition(appearance.weapon).bounds
  const presentation = resolveOpponentPresentation(appearance.animal)
  const blue = useCSSVariable("--color-profile-card-blue")
  const animalAnimation =
    animal && presentation.kind === "sprite"
      ? presentation.steps[0].animation
      : null
  return (
    <Svg width="100%" height="100%" viewBox="0 0 360 450">
      <Ellipse
        cx={180}
        cy={396}
        rx={115}
        ry={9}
        fill={typeof blue === "string" ? blue : undefined}
        opacity={0.28}
      />
      <Svg
        x={animal ? 20 : 75}
        y={55}
        width={230}
        height={340}
        viewBox={`${String(bounds.x)} ${String(bounds.y)} ${String(bounds.width)} ${String(bounds.height)}`}
      >
        {heroLayerPaths(appearance).map((path) => (
          <NativeSpriteImage
            key={path}
            onAssetLoaded={onAssetLoaded}
            sourceId={`/generated/presentation-assets/${path}`}
            frame={frame}
            frameWidth={HERO_IDLE_GEOMETRY.width}
            frameHeight={HERO_IDLE_GEOMETRY.height}
            frameCount={HERO_IDLE_GEOMETRY.frameCount}
          />
        ))}
      </Svg>
      {animalAnimation !== null ? (
        <G>
          <Svg
            x={220}
            y={270}
            width={115}
            height={125}
            viewBox={`${String(animalAnimation.geometry.visibleX)} ${String(animalAnimation.geometry.visibleY)} ${String(animalAnimation.geometry.visibleWidth)} ${String(animalAnimation.geometry.visibleHeight)}`}
          >
            <NativeSpriteImage
              sourceId={animalAnimation.sourceId}
              onAssetLoaded={onAssetLoaded}
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
