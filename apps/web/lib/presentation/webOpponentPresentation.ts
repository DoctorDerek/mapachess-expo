import type { MatchParticipantReaction } from "@mapachess/match-presentation/match-reaction"
import resolveSpritePresentation, {
  type ResolvedSpritePresentation,
} from "@mapachess/match-presentation/presentation-asset-manifest"
import type { ImplementedDurableOpponentId } from "@mapachess/match/durable-match-record"
import {
  AVAILABLE_CHICKEN_SPRITE_SOURCES,
  CHICKEN_SPRITE_MANIFEST,
} from "./webPresentationAssets"

export default function resolveWebOpponentPresentation(
  opponentId: ImplementedDurableOpponentId,
  reaction: MatchParticipantReaction = { family: "idle" },
): ResolvedSpritePresentation<string, string> {
  switch (opponentId) {
    case "chicken-stockfish":
      return resolveSpritePresentation(
        CHICKEN_SPRITE_MANIFEST,
        reaction,
        AVAILABLE_CHICKEN_SPRITE_SOURCES,
      )
  }
}
