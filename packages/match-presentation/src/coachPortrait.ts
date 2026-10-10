import type { MoveGrade } from "@mapachess/match/move-feedback"
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

export const COACH_PORTRAIT_NAMES = {
  happy_high: "More Happy",
  happy_low: "Less Happy",
  sad_high: "More Sad",
  sad_low: "Less Sad",
  brilliance: "Brilliance",
  wow_great: "Wow / Great",
  eager_high: "More Eager",
  eager_low: "Less Eager",
  satisfied_high: "Very Satisfied",
  hurt_low: "Tiny Hurt",
  impressed_1: "Impressed · portrait 11",
  hurt_medium: "Less Hurt",
  neutral: "Normal / OK",
  impressed_2: "Impressed · portrait 14",
  hurt_high: "More Hurt",
  eager_peak: "Most Eager",
} as const satisfies Readonly<Record<CoachPortraitLabel, string>>

export const COACH_COLLECTION_IDS = ["mapachito", "greyfox"] as const
export type CoachCollectionId = (typeof COACH_COLLECTION_IDS)[number]
export const DEFAULT_COACH_COLLECTION: CoachCollectionId = "mapachito"

export const COACH_COLLECTIONS: Readonly<
  Record<
    CoachCollectionId,
    Readonly<{
      label: string
      directory: string
      portraits: readonly CoachPortraitLabel[]
    }>
  >
> = Object.freeze({
  mapachito: Object.freeze({
    label: "Mapachito",
    directory: "coach",
    portraits: Object.freeze(COACH_PORTRAITS.map(({ label }) => label)),
  }),
  greyfox: Object.freeze({
    label: "Animal faces",
    directory: "coach/greyfox",
    portraits: Object.freeze(COACH_PORTRAITS.map(({ label }) => label)),
  }),
})

export const NEUTRAL_COACH_PORTRAIT_LABEL =
  "neutral" satisfies CoachPortraitLabel

type CoachPortraitFrame = Readonly<{
  x: number
  y: number
  size: number
  sourceSize: number
}>

const MAPACHITO_PORTRAIT_FRAME = {
  x: 0,
  y: 0,
  size: 64,
  sourceSize: 64,
} as const
const GREYFOX_PORTRAIT_FRAMES = {
  happy_high: { x: 14, y: 14.5, size: 115 },
  happy_low: { x: 18, y: 18, size: 108 },
  sad_high: { x: -6, y: -2, size: 148 },
  sad_low: { x: 17, y: 17, size: 109 },
  brilliance: { x: 15, y: 15, size: 114 },
  wow_great: { x: 16, y: 16, size: 112 },
  eager_high: { x: 17.5, y: 18, size: 108 },
  eager_low: { x: 5, y: 5.5, size: 133 },
  satisfied_high: { x: 6, y: 6, size: 132 },
  hurt_low: { x: 37.5, y: 27, size: 95 },
  impressed_1: { x: 5.5, y: 6, size: 132 },
  hurt_medium: { x: 22, y: 22, size: 100 },
  neutral: { x: 17, y: 16.5, size: 110 },
  impressed_2: { x: 25, y: 25, size: 93 },
  hurt_high: { x: 32, y: 31.5, size: 80 },
  eager_peak: { x: 18.5, y: 18, size: 107 },
} as const satisfies Readonly<
  Record<CoachPortraitLabel, Omit<CoachPortraitFrame, "sourceSize">>
>

export const coachPortraitFrame = (
  collection: CoachCollectionId,
  label: CoachPortraitLabel,
): CoachPortraitFrame =>
  collection === "mapachito"
    ? MAPACHITO_PORTRAIT_FRAME
    : {
        ...GREYFOX_PORTRAIT_FRAMES[label],
        sourceSize: 144,
      }

const COACH_REACTION_VARIANTS = Object.freeze({
  idle: ["neutral"],
  "capture-attacker": ["wow_great", "happy_low"],
  "capture-victim": ["hurt_medium", "hurt_low"],
  "check-attacker": ["eager_peak", "eager_high", "eager_low"],
  "check-victim": ["hurt_high", "hurt_medium"],
  victory: ["satisfied_high", "happy_high"],
  defeat: ["sad_high", "sad_low"],
}) satisfies Readonly<
  Record<
    MatchSpriteReactionSlot,
    readonly [CoachPortraitLabel, ...CoachPortraitLabel[]]
  >
>

const COACH_MOVE_PORTRAITS = {
  player: {
    brilliant: "brilliance",
    genius: "impressed_1",
    best: "impressed_2",
    good: "happy_low",
    inaccuracy: "hurt_low",
    mistake: "hurt_medium",
    blunder: "hurt_high",
  },
  opponent: {
    brilliant: "hurt_high",
    genius: "hurt_medium",
    best: "hurt_low",
    good: "neutral",
    inaccuracy: "eager_low",
    mistake: "eager_high",
    blunder: "eager_peak",
  },
} as const satisfies Readonly<
  Record<"player" | "opponent", Readonly<Record<MoveGrade, CoachPortraitLabel>>>
>

export type CoachMoveReaction = Readonly<{
  family: "move"
  grade: MoveGrade
  role: "player" | "opponent"
}>

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
  playerReaction: MatchParticipantReaction | CoachMoveReaction,
  availablePortraits: readonly CoachPortraitLabel[],
  variationOrdinal = 0,
): ResolvedCoachPortrait {
  const candidates =
    playerReaction.family === "move"
      ? [COACH_MOVE_PORTRAITS[playerReaction.role][playerReaction.grade]]
      : COACH_REACTION_VARIANTS[matchSpriteReactionSlot(playerReaction)]
  const requested = candidates[variationOrdinal % candidates.length]
  if (requested === undefined)
    throw new Error("A coach reaction requires a valid variation ordinal.")
  const label = availablePortraits.includes(requested)
    ? requested
    : availablePortraits.includes(NEUTRAL_COACH_PORTRAIT_LABEL)
      ? NEUTRAL_COACH_PORTRAIT_LABEL
      : undefined

  return label === undefined
    ? Object.freeze({
        kind: "authored-fallback",
        label: NEUTRAL_COACH_PORTRAIT_LABEL,
      })
    : Object.freeze({ kind: "portrait", label })
}
