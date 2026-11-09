import type { AnimalPresentationId } from "./animalOpponent.js"
import type { MatchParticipantReaction } from "./matchReaction.js"
import resolveSpritePresentation, {
  resolveSpriteAttention,
  resolveSpriteAttentionSequence,
  type ResolvedSpritePresentation,
  type ResolvedSpriteStep,
  type SpriteAssetManifest,
} from "./presentationAssetManifest.js"
import {
  CHICKEN_SPRITE_MANIFEST,
  MAPACHITO_SPRITE_MANIFEST,
  presentationAssetSource,
} from "./presentationAssets.js"
import STORY_ANIMAL_SPRITES from "./storyAnimalSprites.js"

const assetAnimalSprite = (
  manifest: SpriteAssetManifest<string, string>,
): SpriteAssetManifest<string, string> =>
  Object.freeze({
    ...manifest,
    animations: Object.freeze(
      Object.fromEntries(
        Object.entries(manifest.animations).map(([animationId, animation]) => [
          animationId,
          Object.freeze({
            ...animation,
            sourceId: presentationAssetSource(animation.sourceId),
          }),
        ]),
      ),
    ),
  })

const STORY_ANIMAL_ASSET_MANIFESTS = {
  "bunny-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["bunny-stockfish"]),
  "dog-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["dog-stockfish"]),
  "cat-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["cat-stockfish"]),
  "mouse-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["mouse-stockfish"]),
  "squirrel-stockfish": assetAnimalSprite(
    STORY_ANIMAL_SPRITES["squirrel-stockfish"],
  ),
  "frog-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["frog-stockfish"]),
  "turtle-stockfish": assetAnimalSprite(
    STORY_ANIMAL_SPRITES["turtle-stockfish"],
  ),
  "panda-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["panda-stockfish"]),
  "otter-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["otter-stockfish"]),
  "axolotl-stockfish": assetAnimalSprite(
    STORY_ANIMAL_SPRITES["axolotl-stockfish"],
  ),
  "hedgehog-stockfish": assetAnimalSprite(
    STORY_ANIMAL_SPRITES["hedgehog-stockfish"],
  ),
  "deer-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["deer-stockfish"]),
  "fox-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["fox-stockfish"]),
  "wolf-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["wolf-stockfish"]),
  "tiger-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["tiger-stockfish"]),
  "bear-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["bear-stockfish"]),
  "ninja-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["ninja-stockfish"]),
  "war-hero-stockfish": assetAnimalSprite(
    STORY_ANIMAL_SPRITES["war-hero-stockfish"],
  ),
  "parrot-stockfish": assetAnimalSprite(
    STORY_ANIMAL_SPRITES["parrot-stockfish"],
  ),
  "falcon-stockfish": assetAnimalSprite(
    STORY_ANIMAL_SPRITES["falcon-stockfish"],
  ),
  "crane-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["crane-stockfish"]),
  "crow-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["crow-stockfish"]),
  "bat-stockfish": assetAnimalSprite(STORY_ANIMAL_SPRITES["bat-stockfish"]),
  "dragonfly-stockfish": assetAnimalSprite(
    STORY_ANIMAL_SPRITES["dragonfly-stockfish"],
  ),
} as const

export const opponentManifest = (
  opponentId: AnimalPresentationId,
): SpriteAssetManifest<string, string> => {
  switch (opponentId) {
    case "chicken-stockfish":
      return CHICKEN_SPRITE_MANIFEST
    case "raccoon-stockfish":
      return MAPACHITO_SPRITE_MANIFEST
    default: {
      return STORY_ANIMAL_ASSET_MANIFESTS[opponentId]
    }
  }
}

export type PresentationSourceAvailable = (sourceId: string) => boolean
const allSourcesAvailable: PresentationSourceAvailable = () => true

export const resolveOpponentAttention = (
  opponentId: AnimalPresentationId,
  variationOrdinal = 0,
  sourceAvailable: PresentationSourceAvailable = allSourcesAvailable,
): ResolvedSpriteStep<string, string> | null => {
  const manifest = opponentManifest(opponentId)
  return resolveSpriteAttention(
    manifest,
    Object.values(manifest.animations)
      .map(({ sourceId }) => sourceId)
      .filter(sourceAvailable),
    variationOrdinal,
  )
}

export default function resolveOpponentPresentation(
  opponentId: AnimalPresentationId,
  reaction: MatchParticipantReaction = { family: "idle" },
  variationOrdinal = 0,
  sourceAvailable: PresentationSourceAvailable = allSourcesAvailable,
  targetSourceAnimalId?: string,
): ResolvedSpritePresentation<string, string> {
  const manifest = opponentManifest(opponentId)
  return resolveSpritePresentation(
    manifest,
    reaction,
    Object.values(manifest.animations)
      .map(({ sourceId }) => sourceId)
      .filter(sourceAvailable),
    variationOrdinal,
    targetSourceAnimalId,
  )
}

export const resolveOpponentAttentionSequence = (
  opponentId: AnimalPresentationId,
  variationOrdinal = 0,
  sourceAvailable: PresentationSourceAvailable = allSourcesAvailable,
): readonly ResolvedSpriteStep<string, string>[] => {
  const manifest = opponentManifest(opponentId)
  return resolveSpriteAttentionSequence(
    manifest,
    Object.values(manifest.animations)
      .map(({ sourceId }) => sourceId)
      .filter(sourceAvailable),
    variationOrdinal,
  )
}
