import {
  COACH_COLLECTION_IDS,
  type CoachCollectionId,
} from "@mapachess/match-presentation/coach-portrait"
import decodeChessAppearance, {
  sameChessAppearance,
  type ChessAppearanceSettings,
} from "./chessAppearanceSettings.js"
import { requireEnumValue } from "./decodePrimitives.js"

export const MOVE_REACTION_PLACEMENTS = ["top", "middle", "bottom"] as const
export type MoveReactionPlacement = (typeof MOVE_REACTION_PLACEMENTS)[number]
export const DEFAULT_MOVE_REACTION_PLACEMENT = "middle" as const

export type PresentationPreferences = Readonly<{
  chessAppearance: ChessAppearanceSettings
  coachCollection: CoachCollectionId
  moveReactionPlacement: MoveReactionPlacement
}>

export const samePresentationPreferences = (
  left: PresentationPreferences,
  right: PresentationPreferences,
): boolean =>
  left.coachCollection === right.coachCollection &&
  left.moveReactionPlacement === right.moveReactionPlacement &&
  sameChessAppearance(left.chessAppearance, right.chessAppearance)

export default function validatePresentationPreferences(
  preferences: PresentationPreferences,
): PresentationPreferences {
  return Object.freeze({
    chessAppearance: decodeChessAppearance(preferences.chessAppearance),
    coachCollection: requireEnumValue(
      preferences.coachCollection,
      COACH_COLLECTION_IDS,
      "$.settings.coachCollection",
    ),
    moveReactionPlacement: requireEnumValue(
      preferences.moveReactionPlacement,
      MOVE_REACTION_PLACEMENTS,
      "$.settings.moveReactionPlacement",
    ),
  })
}
