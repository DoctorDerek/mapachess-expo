import {
  DEFAULT_COACH_COLLECTION,
  type CoachCollectionId,
  type CoachPortraitLabel,
} from "@mapachess/match-presentation/coach-portrait"
import {
  AVAILABLE_CHICKEN_SPRITE_SOURCES as chickenSources,
  availableCoachPortraits as coachPortraits,
  AVAILABLE_MAPACHITO_SPRITE_SOURCES as mapachitoSources,
  coachPortraitSource as portraitSource,
} from "@mapachess/match-presentation/presentation-assets"

export {
  CHICKEN_SPRITE_SOURCES,
  CHICKEN_SPRITE_MANIFEST,
  MAPACHITO_SPRITE_SOURCES,
  MAPACHITO_SPRITE_MANIFEST,
  presentationAssetSource,
  type ChickenSpriteAnimationId,
  type ChickenSpriteSourceId,
  type MapachitoSpriteAnimationId,
  type MapachitoSpriteSourceId,
} from "@mapachess/match-presentation/presentation-assets"

export const LICENSED_PRESENTATION_ASSETS_ENABLED =
  process.env.MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS === "true"
export const AVAILABLE_CHICKEN_SPRITE_SOURCES =
  LICENSED_PRESENTATION_ASSETS_ENABLED ? chickenSources : Object.freeze([])
export const AVAILABLE_MAPACHITO_SPRITE_SOURCES =
  LICENSED_PRESENTATION_ASSETS_ENABLED ? mapachitoSources : Object.freeze([])
export const availableCoachPortraits = (
  collection: CoachCollectionId = DEFAULT_COACH_COLLECTION,
): readonly CoachPortraitLabel[] =>
  LICENSED_PRESENTATION_ASSETS_ENABLED
    ? coachPortraits(collection)
    : Object.freeze([])
export const coachPortraitSource = (
  label: CoachPortraitLabel,
  collection: CoachCollectionId = DEFAULT_COACH_COLLECTION,
): string | null =>
  LICENSED_PRESENTATION_ASSETS_ENABLED
    ? portraitSource(label, collection)
    : null
