import type { MatchParticipantReaction } from "./matchReaction.js"
import {
  matchSpriteReactionSlot,
  type MatchSpriteReactionSlot,
} from "./presentationAssetManifest.js"

export const COACH_PORTRAITS = [
  { id: 1, label: "happy_high" },
  { id: 2, label: "happy_low" },
  { id: 3, label: "sad_high" },
  { id: 4, label: "sad_low" },
  { id: 5, label: "brilliance" },
  { id: 6, label: "wow_great" },
  { id: 7, label: "eager_high" },
  { id: 8, label: "eager_low" },
  { id: 9, label: "satisfied_high" },
  { id: 10, label: "hurt_low" },
  { id: 11, label: "impressed_1" },
  { id: 12, label: "hurt_medium" },
  { id: 13, label: "neutral" },
  { id: 14, label: "impressed_2" },
  { id: 15, label: "hurt_high" },
  { id: 16, label: "eager_peak" },
] as const

export type CoachPortraitDefinition = (typeof COACH_PORTRAITS)[number]
export type CoachPortraitLabel = CoachPortraitDefinition["label"]

export const NEUTRAL_COACH_PORTRAIT_LABEL =
  "neutral" satisfies CoachPortraitLabel

const COACH_REACTION_FALLBACKS = Object.freeze({
  idle: ["neutral"],
  "capture-attacker": ["wow_great", "eager_high", "neutral"],
  "capture-victim": ["hurt_medium", "hurt_low", "neutral"],
  "check-attacker": ["eager_peak", "impressed_2", "neutral"],
  "check-victim": ["hurt_high", "sad_high", "neutral"],
  victory: ["satisfied_high", "happy_high", "neutral"],
  defeat: ["sad_high", "sad_low", "neutral"],
}) satisfies Readonly<
  Record<
    MatchSpriteReactionSlot,
    readonly [CoachPortraitLabel, ...CoachPortraitLabel[]]
  >
>

export type ResolvedCoachPortrait =
  | Readonly<{
      kind: "portrait"
      label: CoachPortraitLabel
    }>
  | Readonly<{
      kind: "authored-fallback"
      label: typeof NEUTRAL_COACH_PORTRAIT_LABEL
    }>

export default function resolveCoachPortrait(
  playerReaction: MatchParticipantReaction,
  availablePortraits: readonly CoachPortraitLabel[],
): ResolvedCoachPortrait {
  const reactionSlot = matchSpriteReactionSlot(playerReaction)
  const label = COACH_REACTION_FALLBACKS[reactionSlot].find((candidate) =>
    availablePortraits.includes(candidate),
  )

  return label === undefined
    ? Object.freeze({
        kind: "authored-fallback",
        label: NEUTRAL_COACH_PORTRAIT_LABEL,
      })
    : Object.freeze({ kind: "portrait", label })
}
