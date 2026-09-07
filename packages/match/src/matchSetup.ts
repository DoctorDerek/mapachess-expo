import type { ChallengeSetup } from "./challengeSetup.js"
import { MATCH_MODES, type MatchMode } from "./durableMatchRecord.js"
import { MATCH_VARIANTS, type MatchVariant } from "./matchVariant.js"

export type MatchSetup =
  | Readonly<{ mode: "story"; variant: MatchVariant }>
  | Readonly<{ mode: "challenge"; challengeSetup: ChallengeSetup }>

export type MatchModeSelection = Readonly<{
  mode: MatchMode
  variant: MatchVariant
}>

export const MATCH_SETUP_COPY = Object.freeze({
  menuTitle: "Choose your game",
  menuDescription: "Play your way. Better Hints are always within reach.",
  allModes: "All game modes",
  opponent: "Opponent",
  color: "Play as",
  white: "White",
  black: "Black",
  randomColor: "Your side is chosen at random when the match starts.",
  position: "Chess960 starting position",
  randomPosition: "Random position",
  numberedPosition: "Choose a position number",
  positionNumber: "Position number",
  invalidSetup: "Choose White or Black and a valid Chess960 position number.",
  untimed: "Untimed",
  provisionalDifficulty:
    "Current difficulty is provisional, not calibrated. This match does not update your Elo.",
  storyAvailability:
    "Chicken is the first playable opponent. Ladder progression and further opponents are still in development.",
  challengeAvailability:
    "Chicken is currently available. Independent animal and difficulty selection will follow.",
  savingHints: "Saving your hint preference…",
  profileUnavailable:
    "Finish the open Settings or player-data action before starting a match.",
  startMatch: "Start match",
})

const MATCH_MODE_PRESENTATION = {
  standard: {
    story: {
      title: "Standard Story",
      description:
        "The classic starting position. Your side is chosen at random.",
    },
    challenge: {
      title: "Standard Challenge",
      description: "The classic starting position. Choose White or Black.",
    },
  },
  chess960: {
    story: {
      title: "Chess960 Story",
      description: "A fresh starting position and a randomly chosen side.",
    },
    challenge: {
      title: "Chess960 Challenge",
      description:
        "Choose your side and a random or numbered starting position.",
    },
  },
} as const satisfies Readonly<
  Record<
    MatchVariant,
    Readonly<
      Record<
        MatchMode,
        Readonly<{
          title: string
          description: string
        }>
      >
    >
  >
>

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

export const matchModeLabel = ({ mode, variant }: MatchModeSelection): string =>
  MATCH_MODE_PRESENTATION[variant][mode].title

export default function createMatchSetupForMode(
  { mode, variant }: MatchModeSelection,
  rememberedChallenge: ChallengeSetup,
): MatchSetup {
  if (mode === "story") return Object.freeze({ mode, variant })
  return Object.freeze({
    mode,
    challengeSetup: Object.freeze({
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
