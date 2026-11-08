import resolveOpponentPresentation from "@mapachess/match-presentation/opponent-presentation"
import { profileCardAnimationFrameCount } from "@mapachess/match-presentation/profile-card-format"
import { HERO_IDLE_GEOMETRY } from "@mapachess/profile/hero-catalog"
import { heroLayerPaths } from "@mapachess/profile/player-appearance"
import type { CardInput } from "@mapachess/profile/profile-card-model"

export function nativeCardFrameCount(input: CardInput): number {
  const animal = resolveOpponentPresentation(input.appearance.animal)
  const frames =
    input.content.animal && animal.kind === "sprite"
      ? animal.steps[0].animation.frameCount
      : 1
  return profileCardAnimationFrameCount(HERO_IDLE_GEOMETRY.frameCount, frames)
}

export default function nativeCardAssetIds(
  input: CardInput,
): readonly string[] {
  const animal = resolveOpponentPresentation(input.appearance.animal)
  return [
    ...heroLayerPaths(input.appearance).map(
      (path) => `/generated/presentation-assets/${path}`,
    ),
    ...(input.content.animal && animal.kind === "sprite"
      ? [animal.steps[0].animation.sourceId]
      : []),
    ...(input.content.standard || input.content.chess960
      ? [`/medals/${input.facts.ratingContext.assistance}.png`]
      : []),
  ]
}
