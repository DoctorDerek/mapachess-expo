import type { ShippedLocale } from "@mapachess/localization/locale"
import { levelFromTotalXp } from "./globalXp.js"
import type { PlayerAppearance } from "./playerAppearance.js"
import type { MapachessPlayerData } from "./playerData.js"
import { playerRatingId, type CardRatingContext } from "./ratingContext.js"

export type CardContent = Readonly<{
  level: boolean
  standard: boolean
  chess960: boolean
  animal: boolean
}>
export const INITIAL_CARD_CONTENT: CardContent = Object.freeze({
  level: true,
  standard: true,
  chess960: true,
  animal: true,
})
export type CardFacts = Readonly<{
  level: number
  standard: number
  chess960: number
  ratingContext: CardRatingContext
}>
export type CardInput = Readonly<{
  locale?: ShippedLocale
  appearance: PlayerAppearance
  facts: CardFacts
  content: CardContent
  format: "GIF" | "PNG"
}>
export const cardFacts = (
  data: MapachessPlayerData,
  ratingContext = data.settings.cardRatingContext,
): CardFacts => ({
  level: levelFromTotalXp(data.totalXp),
  standard: Math.round(
    data.ratings[
      playerRatingId(
        "standard",
        ratingContext.category,
        ratingContext.assistance,
      )
    ],
  ),
  chess960: Math.round(
    data.ratings[
      playerRatingId(
        "chess960",
        ratingContext.category,
        ratingContext.assistance,
      )
    ],
  ),
  ratingContext,
})
