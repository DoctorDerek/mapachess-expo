import loadCatalog from "@mapachess/localization/catalog"
import type { ShippedLocale } from "@mapachess/localization/locale"
import type { ChallengeSetup } from "./challengeSetup.js"
import type { Chess960PositionId } from "./chess960Position.js"
import {
  MATCH_MODES,
  type ImplementedDurableOpponentId,
  type MatchMode,
} from "./durableMatchRecord.js"
import { MATCH_VARIANTS, type MatchVariant } from "./matchVariant.js"
import type { TimeControl } from "./timeControl.js"

export type MatchSetup = Readonly<{ timeControl?: TimeControl }> &
  (
    | Readonly<{
        mode: "story"
        variant: MatchVariant
        opponentId?: ImplementedDurableOpponentId
      }>
    | Readonly<{
        mode: "challenge"
        challengeSetup: ChallengeSetup
        displayedChess960PositionId?: Chess960PositionId
      }>
  )

export type MatchModeSelection = Readonly<{
  mode: MatchMode
  variant: MatchVariant
}>

export const MATCH_SETUP_COPY = loadCatalog("en").setup

const MATCH_MODE_PRESENTATION = MATCH_SETUP_COPY.presentations

export const MATCH_MODE_CHOICES = Object.freeze(
  MATCH_VARIANTS.flatMap((variant) =>
    MATCH_MODES.map((mode) =>
      Object.freeze({
        mode,
        variant,
        ...MATCH_MODE_PRESENTATION[variant][mode],
      }),
    ),
  ),
)

export const matchModeLabel = ({
  mode,
  variant,
  locale = "en",
}: MatchModeSelection & Readonly<{ locale?: ShippedLocale }>): string =>
  loadCatalog(locale).setup.presentations[variant][mode].title

export default function createMatchSetupForMode(
  { mode, variant }: MatchModeSelection,
  rememberedChallenge: ChallengeSetup,
  storyOpponentId?: ImplementedDurableOpponentId,
): MatchSetup {
  if (mode === "story")
    return Object.freeze({
      mode,
      variant,
      ...(storyOpponentId === undefined ? {} : { opponentId: storyOpponentId }),
    })
  return Object.freeze({
    mode,
    challengeSetup: Object.freeze({
      opponentId: rememberedChallenge.opponentId,
      difficultyTargetElo: rememberedChallenge.difficultyTargetElo,
      playerColor: rememberedChallenge.playerColor,
      ...(variant === "standard"
        ? { variant, chess960PositionId: null }
        : {
            variant,
            chess960PositionId:
              rememberedChallenge.variant === "chess960"
                ? rememberedChallenge.chess960PositionId
                : null,
          }),
    }),
  })
}
