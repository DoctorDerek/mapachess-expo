import type { MatchParticipantReaction } from "@mapachess/match-presentation/match-reaction"
import resolveSpritePresentation, {
  type ResolvedSpritePresentation,
  type SpriteAssetManifest,
} from "@mapachess/match-presentation/presentation-asset-manifest"
import STORY_ANIMAL_SPRITES from "@mapachess/match-presentation/story-animal-sprites"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import {
  AVAILABLE_CHICKEN_SPRITE_SOURCES,
  AVAILABLE_MAPACHITO_SPRITE_SOURCES,
  CHICKEN_SPRITE_MANIFEST,
  LICENSED_PRESENTATION_ASSETS_ENABLED,
  MAPACHITO_SPRITE_MANIFEST,
  presentationAssetSource,
} from "./webPresentationAssets"

const webAnimalSprite = (
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

const WEB_STORY_ANIMAL_SPRITES = {
  "bunny-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["bunny-stockfish"]),
  "dog-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["dog-stockfish"]),
  "cat-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["cat-stockfish"]),
  "mouse-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["mouse-stockfish"]),
  "frog-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["frog-stockfish"]),
  "turtle-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["turtle-stockfish"]),
  "panda-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["panda-stockfish"]),
  "otter-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["otter-stockfish"]),
  "axolotl-stockfish": webAnimalSprite(
    STORY_ANIMAL_SPRITES["axolotl-stockfish"],
  ),
  "hedgehog-stockfish": webAnimalSprite(
    STORY_ANIMAL_SPRITES["hedgehog-stockfish"],
  ),
  "deer-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["deer-stockfish"]),
  "fox-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["fox-stockfish"]),
  "wolf-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["wolf-stockfish"]),
  "ninja-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["ninja-stockfish"]),
  "war-hero-stockfish": webAnimalSprite(
    STORY_ANIMAL_SPRITES["war-hero-stockfish"],
  ),
  "parrot-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["parrot-stockfish"]),
  "falcon-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["falcon-stockfish"]),
  "crane-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["crane-stockfish"]),
  "crow-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["crow-stockfish"]),
  "bat-stockfish": webAnimalSprite(STORY_ANIMAL_SPRITES["bat-stockfish"]),
  "dragonfly-stockfish": webAnimalSprite(
    STORY_ANIMAL_SPRITES["dragonfly-stockfish"],
  ),
} as const

export default function resolveWebOpponentPresentation(
  opponentId: StockfishOpponentId,
  reaction: MatchParticipantReaction = { family: "idle" },
): ResolvedSpritePresentation<string, string> {
  switch (opponentId) {
    case "chicken-stockfish":
      return resolveSpritePresentation(
        CHICKEN_SPRITE_MANIFEST,
        reaction,
        AVAILABLE_CHICKEN_SPRITE_SOURCES,
      )
    case "raccoon-stockfish":
      return resolveSpritePresentation(
        MAPACHITO_SPRITE_MANIFEST,
        reaction,
        AVAILABLE_MAPACHITO_SPRITE_SOURCES,
      )
    default: {
      const manifest = WEB_STORY_ANIMAL_SPRITES[opponentId]
      return resolveSpritePresentation(
        manifest,
        reaction,
        LICENSED_PRESENTATION_ASSETS_ENABLED
          ? Object.values(manifest.animations).map(({ sourceId }) => sourceId)
          : [],
      )
    }
  }
}
