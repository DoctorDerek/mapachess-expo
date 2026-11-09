import type { AnimalPresentationId } from "@mapachess/match-presentation/animal-opponent"
import type { MatchParticipantReaction } from "@mapachess/match-presentation/match-reaction"
import resolveOpponentPresentation, {
  resolveOpponentAttention,
  resolveOpponentAttentionSequence,
} from "@mapachess/match-presentation/opponent-presentation"
import type {
  ResolvedSpritePresentation,
  ResolvedSpriteStep,
} from "@mapachess/match-presentation/presentation-asset-manifest"
import { LICENSED_PRESENTATION_ASSETS_ENABLED } from "./webPresentationAssets"

const sourceAvailable = (): boolean => LICENSED_PRESENTATION_ASSETS_ENABLED
export const resolveWebOpponentAttention = (
  opponentId: AnimalPresentationId,
  variationOrdinal = 0,
): ResolvedSpriteStep<string, string> | null =>
  resolveOpponentAttention(opponentId, variationOrdinal, sourceAvailable)
export const resolveWebOpponentAttentionSequence = (
  opponentId: AnimalPresentationId,
  variationOrdinal = 0,
): readonly ResolvedSpriteStep<string, string>[] =>
  resolveOpponentAttentionSequence(
    opponentId,
    variationOrdinal,
    sourceAvailable,
  )
export default function resolveWebOpponentPresentation(
  opponentId: AnimalPresentationId,
  reaction: MatchParticipantReaction = { family: "idle" },
  variationOrdinal = 0,
  targetSourceAnimalId?: string,
): ResolvedSpritePresentation<string, string> {
  return resolveOpponentPresentation(
    opponentId,
    reaction,
    variationOrdinal,
    sourceAvailable,
    targetSourceAnimalId,
  )
}
