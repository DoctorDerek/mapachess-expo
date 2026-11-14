import type { ActorRefFrom } from "xstate"
import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import parseChallengeSetup, {
  type ChallengePositionSetup,
} from "@mapachess/match/challenge-setup"
import {
  parseChess960PositionId,
  type Chess960PositionId,
} from "@mapachess/match/chess960-position"
import type matchMachine from "@mapachess/match/match-machine"
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import type {
  MatchSessionActor,
  MatchSessionIdentity,
} from "@mapachess/match/match-session-machine"
import type { MatchSetup } from "@mapachess/match/match-setup"
import type { MatchVariant } from "@mapachess/match/match-variant"
import stockfishOpponent, {
  type StockfishOpponentId,
} from "@mapachess/match/stockfish-opponent"
import {
  timeCategory,
  UNTIMED,
  type TimeControl,
} from "@mapachess/match/time-control"
import {
  eligiblePlayerAnimals,
  type PlayerAppearance,
} from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import {
  selectCanChangeAutoHintMode,
  selectCurrentPlayerData,
} from "@mapachess/profile/profile-machine"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import {
  playerRatingId,
  startingRatingAssistance,
} from "@mapachess/profile/rating-context"
import {
  canPlayStoryOpponent,
  selectChallengeUnlockedOpponents,
  selectDefaultStoryOpponent,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import challengeDifficultyGrid, {
  createChallengeDifficultyDraft,
  projectChallengeDifficulty,
  type ChallengeDifficultyDraft,
} from "./challengeDifficulty.js"
import { profileAllowsMatchOpening } from "./home.js"

export type SetupEditorValues = Readonly<{
  player: StockfishOpponentId | undefined
  opponent: StockfishOpponentId
  hints: AutoHintMode
  "time-control": TimeControl
}>
export type SetupEditor = keyof SetupEditorValues
export type SetupSource = Readonly<{
  storyProgress: StoryProgress
  challengeHistory: MapachessPlayerData["challengeHistory"]
  autoHintMode: AutoHintMode
  playerAppearance?: PlayerAppearance | undefined
  ratings?: MapachessPlayerData["ratings"] | undefined
}>
export type MatchSetupDraft = Readonly<{
  initial: MatchSetup
  variant: MatchVariant
  opponentId: StockfishOpponentId
  playerColor: ChallengePositionSetup["playerColor"]
  timeControl: TimeControl
  difficulty: ChallengeDifficultyDraft | null
  positionText: string
  numberedPosition: boolean
  invalidSetup: boolean
  generatePosition: () => Chess960PositionId
}>
export type MatchSetupDraftInput = Readonly<{
  initial: MatchSetup
  storyProgress: StoryProgress
  generatePosition: () => Chess960PositionId
}>

export default function createMatchSetupDraft(
  input: MatchSetupDraftInput,
): MatchSetupDraft {
  const initial = input.initial
  const challenge = initial.mode === "challenge" ? initial.challengeSetup : null
  const variant =
    initial.mode === "story" ? initial.variant : initial.challengeSetup.variant
  const displayed =
    challenge?.variant === "chess960"
      ? (challenge.chess960PositionId ??
        (initial.mode === "challenge"
          ? initial.displayedChess960PositionId
          : undefined) ??
        input.generatePosition())
      : null
  return {
    initial,
    variant,
    opponentId:
      initial.mode === "story"
        ? (initial.opponentId ??
          selectDefaultStoryOpponent(input.storyProgress, variant))
        : initial.challengeSetup.opponentId,
    playerColor: challenge?.playerColor ?? "white",
    timeControl: initial.timeControl ?? UNTIMED,
    difficulty:
      challenge === null
        ? null
        : createChallengeDifficultyDraft(
            challengeDifficultyGrid(variant),
            challenge.difficultyTargetElo,
          ),
    positionText: displayed === null ? "" : String(displayed),
    numberedPosition:
      challenge?.variant === "chess960" &&
      challenge.chess960PositionId !== null,
    invalidSetup: false,
    generatePosition: input.generatePosition,
  }
}

export type MatchSetupView = Readonly<{
  draft: MatchSetupDraft
  difficulty: ReturnType<typeof projectChallengeDifficulty> | null
  available: boolean
  position: ReturnType<typeof parseChess960PositionId>
  category: ReturnType<typeof timeCategory>
  assistance: ReturnType<typeof startingRatingAssistance>
  opponent: ReturnType<typeof stockfishOpponent>
  playerAnimal: ReturnType<typeof stockfishOpponent> | null
  rating: Readonly<{
    id: ReturnType<typeof playerRatingId>
    value: number
  }> | null
  chess960Challenge: boolean
}>
export function selectMatchSetup(
  draft: MatchSetupDraft,
  source: SetupSource,
): MatchSetupView {
  const difficulty =
    draft.difficulty === null
      ? null
      : projectChallengeDifficulty(
          draft.variant,
          draft.difficulty,
          source.challengeHistory,
        )
  const challenge = draft.initial.mode === "challenge"
  const available = challenge
    ? selectChallengeUnlockedOpponents(source.storyProgress).some(
        ({ id }) => id === draft.opponentId,
      ) &&
      difficulty !== null &&
      difficulty.start.type !== "unavailable"
    : canPlayStoryOpponent(
        source.storyProgress,
        draft.variant,
        draft.opponentId,
      )
  const position = parseChess960PositionId(
    draft.positionText.trim() === "" ? NaN : Number(draft.positionText),
  )
  const category = timeCategory(draft.timeControl)
  const assistance = startingRatingAssistance(source.autoHintMode)
  const ratingId = playerRatingId(draft.variant, category, assistance)
  return {
    draft,
    difficulty,
    available,
    position,
    category,
    assistance,
    opponent: stockfishOpponent(draft.opponentId),
    playerAnimal:
      source.playerAppearance === undefined
        ? null
        : stockfishOpponent(source.playerAppearance.animal),
    rating:
      source.ratings === undefined
        ? null
        : { id: ratingId, value: source.ratings[ratingId] },
    chess960Challenge: challenge && draft.variant === "chess960",
  }
}
export type SetupSubmission =
  | Readonly<{ type: "blocked" | "difficulty" | "invalid" }>
  | Readonly<{ type: "ready"; setup: MatchSetup }>

export function prepareMatchSetupSubmission(
  draft: MatchSetupDraft,
  source: SetupSource,
  blocked: boolean,
): SetupSubmission {
  const view = selectMatchSetup(draft, source)
  if (blocked || !view.available) return { type: "blocked" }
  if (draft.initial.mode === "story")
    return {
      type: "ready",
      setup: {
        ...draft.initial,
        timeControl: draft.timeControl,
        opponentId: draft.opponentId,
      },
    }
  if (view.difficulty?.start.type !== "ready") return { type: "difficulty" }
  if (draft.variant === "chess960" && !view.position.ok)
    return { type: "invalid" }
  const parsed = parseChallengeSetup({
    variant: draft.variant,
    opponentId: draft.opponentId,
    playerColor: draft.playerColor,
    difficultyTargetElo: view.difficulty.start.targetElo,
    chess960PositionId:
      draft.variant === "chess960" && draft.numberedPosition && view.position.ok
        ? view.position.positionId
        : null,
  })
  if (!parsed.ok) return { type: "invalid" }
  return {
    type: "ready",
    setup: {
      mode: "challenge",
      challengeSetup: parsed.setup,
      timeControl: draft.timeControl,
      ...(draft.variant === "chess960" && view.position.ok
        ? { displayedChess960PositionId: view.position.positionId }
        : {}),
    },
  }
}

export function selectSetupEditor(
  overlays: readonly MatchNavigationOverlay[],
): Readonly<{ editor: SetupEditor | null; active: boolean }> {
  const overlay = overlays.findLast(
    (value) =>
      value === "setup-player" ||
      value === "setup-opponent" ||
      value === "setup-hints" ||
      value === "setup-time-control",
  )
  const editor =
    overlay === "setup-player"
      ? "player"
      : overlay === "setup-opponent"
        ? "opponent"
        : overlay === "setup-hints"
          ? "hints"
          : overlay === "setup-time-control"
            ? "time-control"
            : null
  return {
    editor,
    active: overlay !== undefined && overlays.at(-1) === overlay,
  }
}

export type MatchSetupCommands = Readonly<{
  changeHints: (autoHintMode: AutoHintMode) => void
  changePlayer: (animal: StockfishOpponentId) => void
  start: (setup: MatchSetup) => void
  openEditor: (editor: SetupEditor) => void
  closeEditor: () => void
  back: () => void
}>
type SetupSession = MatchSessionIdentity &
  Readonly<{ actor: ActorRefFrom<typeof matchMachine> }>
export function createMatchSetupCommands<Session extends SetupSession>({
  profileActor,
  sessionActor,
  navigation,
  blocked = () => false,
}: Readonly<{
  profileActor: ProfileActor
  sessionActor: MatchSessionActor<Session>
  navigation: MatchNavigationCommands
  blocked?: () => boolean
}>): MatchSetupCommands {
  return {
    changeHints: (autoHintMode: AutoHintMode): void => {
      const profile = profileActor.getSnapshot()
      if (!profile.matches("ready") && !selectCanChangeAutoHintMode(profile))
        return
      const session = sessionActor.getSnapshot().context.session
      if (session === null)
        profileActor.send({
          type: "PROFILE.AUTO_HINT_MODE_CHANGED",
          autoHintMode,
        })
      else
        session.actor.send({
          type: "MATCH.AUTO_HINT_MODE_CHANGED",
          autoHintMode,
        })
    },
    changePlayer: (animal: StockfishOpponentId): void => {
      const profile = profileActor.getSnapshot()
      const data = selectCurrentPlayerData(profile)
      if (
        !profile.matches("ready") ||
        data === null ||
        !eligiblePlayerAnimals(data.storyProgress).includes(animal)
      )
        return
      profileActor.send({
        type: "PROFILE.APPEARANCE_SAVE_REQUESTED",
        appearance: { ...data.appearance, animal },
      })
    },
    start: (setup: MatchSetup): void => {
      const profile = profileActor.getSnapshot()
      const session = sessionActor.getSnapshot()
      const data = selectCurrentPlayerData(profile)
      if (
        blocked() ||
        !profileAllowsMatchOpening(profile) ||
        data === null ||
        !session.matches({ menu: "setup" }) ||
        session.context.overlays.length > 0
      )
        return
      const variant =
        setup.mode === "story" ? setup.variant : setup.challengeSetup.variant
      if (setup.mode === "story") {
        const opponent =
          setup.opponentId ??
          selectDefaultStoryOpponent(data.storyProgress, variant)
        if (!canPlayStoryOpponent(data.storyProgress, variant, opponent)) return
      } else if (
        !selectChallengeUnlockedOpponents(data.storyProgress).some(
          ({ id }) => id === setup.challengeSetup.opponentId,
        ) ||
        !challengeDifficultyGrid(variant).targets.includes(
          setup.challengeSetup.difficultyTargetElo,
        )
      )
        return
      sessionActor.send({ type: "MATCH_SESSION.MATCH_REQUESTED", setup })
    },
    openEditor: (editor: SetupEditor): void =>
      navigation.open(`setup-${editor}`),
    closeEditor: navigation.back,
    back: navigation.back,
  }
}

export function canAcceptSetupEditor(
  editor: SetupEditor,
  values: SetupEditorValues,
  variant: MatchVariant,
  mode: MatchSetup["mode"],
  progress: StoryProgress,
): boolean {
  if (editor === "player")
    return (
      values.player !== undefined &&
      eligiblePlayerAnimals(progress).includes(values.player)
    )
  if (editor !== "opponent") return true
  return mode === "story"
    ? canPlayStoryOpponent(progress, variant, values.opponent)
    : selectChallengeUnlockedOpponents(progress).some(
        ({ id }) => id === values.opponent,
      )
}
