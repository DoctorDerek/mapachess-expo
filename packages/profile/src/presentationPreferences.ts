import {
  COACH_COLLECTION_IDS,
  type CoachCollectionId,
} from "@mapachess/match-presentation/coach-portrait"
import decodeChessAppearance, {
  sameChessAppearance,
  type ChessAppearanceSettings,
} from "./chessAppearanceSettings.js"
import { requireEnumValue } from "./decodePrimitives.js"

export type PresentationPreferences = Readonly<{
  chessAppearance: ChessAppearanceSettings
  coachCollection: CoachCollectionId
}>

export const samePresentationPreferences = (
  left: PresentationPreferences,
  right: PresentationPreferences,
): boolean =>
  left.coachCollection === right.coachCollection &&
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
  })
}
