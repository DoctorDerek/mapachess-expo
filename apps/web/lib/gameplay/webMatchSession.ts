import { createActor, type ActorRefFrom } from "xstate"
import bindMatchPositionEvaluation, {
  type MatchPositionEvaluationBinding,
} from "@mapachess/evaluation/match-position-evaluation"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import type { ChallengeSetup } from "@mapachess/match/challenge-setup"
import {
  isImplementedDurableOpponent,
  type DurableMatchRecord,
  type ImplementedDurableOpponentId,
} from "@mapachess/match/durable-match-record"
import matchMachine from "@mapachess/match/match-machine"
import type { MatchVariant } from "@mapachess/match/match-variant"
import profileMachine, {
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "@mapachess/profile/profile-machine"
import ProfileMatchPersistenceBridge, {
  persistProfileActiveMatch,
} from "@mapachess/profile/profile-match-persistence"
import {
  canPlayStoryOpponent,
  selectChallengeUnlockedOpponents,
  selectDefaultStoryOpponent,
} from "@mapachess/profile/story-progress"
import openWebMatchRuntime, {
  type OpenWebMatchRuntimeInput,
} from "./openWebMatchRuntime"
import resumeWebMatch, {
  buildFreshWebMatch,
  type ResumedWebMatch,
} from "./webDurableMatch"
import type { WebMatchRuntime } from "./webMatchRuntime"
import type { WebMatchSession } from "./webMatchSessionMachine"
import { webChallengeDifficultyTargets } from "./webOpponentPolicy"

type ProfileActor = ActorRefFrom<typeof profileMachine>

type OpenWebMatchRuntime = (
  input?: OpenWebMatchRuntimeInput,
) => Promise<WebMatchRuntime>

export type OpenWebMatchSessionInput = Readonly<{
  openRuntime?: OpenWebMatchRuntime
  profileActor: ProfileActor
  signal: AbortSignal
}>

export type OpenFreshWebMatchSessionInput = OpenWebMatchSessionInput &
  Readonly<{
    previousSession: WebMatchSession | null
  }> &
  (
    | Readonly<{
        mode?: "story"
        variant: MatchVariant
        opponentId?: ImplementedDurableOpponentId
      }>
    | Readonly<{ mode: "challenge"; challengeSetup: ChallengeSetup }>
  )

export type ReturnWebMatchSessionToMenuInput = Readonly<{
  profileActor: ProfileActor
  session: WebMatchSession
  signal: AbortSignal
}>

const requirePlayerData = (profileActor: ProfileActor) => {
  const playerData = selectCurrentPlayerData(profileActor.getSnapshot())
  if (playerData === null) {
    throw new Error("A valid player profile is required to open a match.")
  }
  return playerData
}

const abortedOpening = (): DOMException =>
  new DOMException("Web match session opening was aborted.", "AbortError")

const closeRuntimeAfterFailure = async (
  runtime: WebMatchRuntime,
  openingFailure: unknown,
): Promise<never> => {
  try {
    await runtime.close()
  } catch (closeFailure) {
    throw new AggregateError(
      [openingFailure, closeFailure],
      "Web match session failed to open and close cleanly.",
    )
  }
  throw openingFailure
}

type OpenActorSessionInput = Readonly<{
  match: DurableMatchRecord
  profileActor: ProfileActor
  resumedMatch: ResumedWebMatch
  runtime: WebMatchRuntime
  signal: AbortSignal
}>

const openActorSession = async ({
  match,
  profileActor,
  resumedMatch,
  runtime,
  signal,
}: OpenActorSessionInput): Promise<WebMatchSession> => {
  const persistence = new ProfileMatchPersistenceBridge({
    actor: profileActor,
    expectedActiveMatch: match,
    initialMatch: match,
  })

  try {
    await persistence.establish(signal)
    if (signal.aborted) throw abortedOpening()
  } catch (error) {
    return closeRuntimeAfterFailure(runtime, error)
  }

  let evaluationActor: ActorRefFrom<typeof positionEvaluationMachine> | null =
    null
  let evaluationBinding: MatchPositionEvaluationBinding | null = null
  let matchActor: ActorRefFrom<typeof matchMachine> | null = null

  try {
    const openedMatchActor = createActor(matchMachine, {
      input: {
        autoHintMode: match.autoHintMode,
        durability: { persistence, type: "durable" },
        hintAnalyst: runtime.hintAnalyst,
        matchId: match.matchId,
        opponent: runtime.opponent,
        playerColor: match.playerColor,
        resumedState: {
          conclusion: match.conclusion,
          moveHintsUsed: match.moveHintsUsed,
          pieceHintsUsed: match.pieceHintsUsed,
          timeline: resumedMatch.timeline,
        },
      },
    }).start()
    matchActor = openedMatchActor
    const openedEvaluationActor = createActor(positionEvaluationMachine, {
      input: { evaluator: runtime.positionEvaluator },
    }).start()
    evaluationActor = openedEvaluationActor
    const openedEvaluationBinding = bindMatchPositionEvaluation(
      openedMatchActor,
      openedEvaluationActor,
    )
    evaluationBinding = openedEvaluationBinding

    let closePromise: Promise<void> | null = null
    const close = (): Promise<void> => {
      if (closePromise !== null) return closePromise

      openedEvaluationBinding.disconnect()
      openedEvaluationActor.stop()
      openedMatchActor.stop()
      closePromise = Promise.resolve().then(() => runtime.close())
      return closePromise
    }

    return Object.freeze({
      actor: openedMatchActor,
      close,
      evaluationActor: openedEvaluationActor,
      match,
      runtime,
    })
  } catch (error) {
    evaluationBinding?.disconnect()
    evaluationActor?.stop()
    matchActor?.stop()
    return closeRuntimeAfterFailure(runtime, error)
  }
}

export async function openCurrentWebMatchSession({
  openRuntime = openWebMatchRuntime,
  profileActor,
  signal,
}: OpenWebMatchSessionInput): Promise<WebMatchSession> {
  const activeMatch = requirePlayerData(profileActor).activeMatch
  if (activeMatch === null) {
    throw new Error("The player profile has no active match to resume.")
  }

  const resumedMatch = resumeWebMatch(activeMatch)
  const runtime = await openRuntime({
    ...(activeMatch.mode === "challenge"
      ? { mode: "challenge" as const, playerColor: activeMatch.playerColor }
      : {}),
    matchSeed: resumedMatch.matchSeed,
    opponentId: activeMatch.opponentId,
    opponentPolicyFingerprint: activeMatch.opponentPolicyFingerprint,
    setup: activeMatch.startingPosition,
    signal,
  })
  let match = activeMatch
  if (
    activeMatch.opponentPolicyFingerprint !== runtime.opponentPolicyFingerprint
  ) {
    match = Object.freeze({
      ...activeMatch,
      opponentPolicyFingerprint: runtime.opponentPolicyFingerprint,
    })
    try {
      await persistProfileActiveMatch({
        actor: profileActor,
        candidate: match,
        expectedActiveMatch: activeMatch,
        signal,
      })
    } catch (error) {
      return closeRuntimeAfterFailure(runtime, error)
    }
  }
  return openActorSession({
    match,
    profileActor,
    resumedMatch,
    runtime,
    signal,
  })
}

export async function openFreshWebMatchSession(
  input: OpenFreshWebMatchSessionInput,
): Promise<WebMatchSession> {
  const {
    openRuntime = openWebMatchRuntime,
    previousSession,
    profileActor,
    signal,
  } = input
  await previousSession?.close()

  const playerData =
    selectPendingPlayerData(profileActor.getSnapshot()) ??
    requirePlayerData(profileActor)
  const activeMatch = playerData.activeMatch
  if (
    activeMatch !== null &&
    (previousSession === null ||
      activeMatch.matchId !== previousSession.match.matchId)
  ) {
    return openCurrentWebMatchSession({
      openRuntime,
      profileActor,
      signal,
    })
  }
  if (previousSession !== null && activeMatch === null) {
    throw new Error("The match selected for restart is no longer active.")
  }

  const challengeSetup =
    previousSession === null && input.mode === "challenge"
      ? input.challengeSetup
      : undefined
  const playerColor =
    previousSession?.match.mode === "challenge"
      ? previousSession.match.playerColor
      : challengeSetup?.playerColor
  const variant =
    input.mode === "challenge" ? input.challengeSetup.variant : input.variant
  const opponentId =
    previousSession?.match.opponentId ??
    (input.mode === "challenge"
      ? input.challengeSetup.opponentId
      : (input.opponentId ??
        selectDefaultStoryOpponent(playerData.storyProgress, variant)))
  if (!isImplementedDurableOpponent(opponentId)) {
    throw new Error("The selected opponent is not available for web play.")
  }
  if (
    challengeSetup !== undefined &&
    (!selectChallengeUnlockedOpponents(playerData.storyProgress).some(
      ({ id }) => id === opponentId,
    ) ||
      !webChallengeDifficultyTargets(variant).includes(
        challengeSetup.difficultyTargetElo,
      ))
  ) {
    throw new Error(
      "Choose an earned Challenge animal and supported difficulty.",
    )
  }
  if (
    previousSession === null &&
    input.mode !== "challenge" &&
    !canPlayStoryOpponent(playerData.storyProgress, variant, opponentId)
  ) {
    throw new Error(
      "The selected Story opponent is not unlocked in this variant.",
    )
  }
  const setup: OpenWebMatchRuntimeInput["setup"] =
    previousSession?.match.startingPosition ??
    (challengeSetup?.variant === "chess960" &&
    challengeSetup.chess960PositionId !== null
      ? {
          variant: "chess960",
          chess960PositionId: challengeSetup.chess960PositionId,
        }
      : variant === "standard"
        ? { variant, chess960PositionId: null }
        : { variant })
  const runtime = await openRuntime({
    opponentId,
    ...(playerColor === undefined
      ? {}
      : {
          mode: "challenge" as const,
          playerColor,
          ...(challengeSetup === undefined
            ? {}
            : { difficultyTargetElo: challengeSetup.difficultyTargetElo }),
        }),
    ...(previousSession === null
      ? {}
      : {
          opponentPolicyFingerprint:
            previousSession.match.opponentPolicyFingerprint,
        }),
    setup,
    signal,
  })
  const mode = playerColor === undefined ? "story" : "challenge"
  const freshMatch = buildFreshWebMatch({
    autoHintMode: playerData.settings.autoHintMode,
    mode,
    playerEloAtStart:
      runtime.startingPosition.variant === "standard"
        ? mode === "story"
          ? playerData.ratings.standardStory
          : playerData.ratings.standardChallenge
        : mode === "story"
          ? playerData.ratings.chess960Story
          : playerData.ratings.chess960Challenge,
    runtime,
  })

  let resumedMatch: ResumedWebMatch
  try {
    if (
      challengeSetup !== undefined &&
      runtime.opponentTargetElo !== challengeSetup.difficultyTargetElo
    ) {
      throw new Error(
        "The opened Challenge difficulty does not match the selection.",
      )
    }
    resumedMatch = resumeWebMatch(freshMatch)
    await persistProfileActiveMatch({
      actor: profileActor,
      candidate: freshMatch,
      ...(challengeSetup === undefined ? {} : { challengeSetup }),
      expectedActiveMatch: activeMatch,
      signal,
    })
  } catch (error) {
    return closeRuntimeAfterFailure(runtime, error)
  }

  return openActorSession({
    match: freshMatch,
    profileActor,
    resumedMatch,
    runtime,
    signal,
  })
}

export async function returnWebMatchSessionToMenu({
  profileActor,
  session,
  signal,
}: ReturnWebMatchSessionToMenuInput): Promise<void> {
  await session.close()

  const activeMatch = requirePlayerData(profileActor).activeMatch
  if (activeMatch === null) return
  if (activeMatch.matchId !== session.match.matchId) {
    throw new Error(
      "A different active match cannot be cleared by this session.",
    )
  }

  await persistProfileActiveMatch({
    actor: profileActor,
    candidate: null,
    expectedActiveMatch: activeMatch,
    signal,
  })
}
