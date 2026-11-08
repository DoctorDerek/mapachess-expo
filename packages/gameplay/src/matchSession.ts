import { createActor, waitFor, type ActorRefFrom } from "xstate"
import bindMatchPositionEvaluation, {
  type MatchPositionEvaluationBinding,
} from "@mapachess/evaluation/match-position-evaluation"
import createMoveFeedbackEvaluator from "@mapachess/evaluation/move-feedback-evaluator"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import type { ChallengeSetup } from "@mapachess/match/challenge-setup"
import type { Chess960PositionId } from "@mapachess/match/chess960-position"
import {
  type DurableMatchRecord,
  type ImplementedDurableOpponentId,
} from "@mapachess/match/durable-match-record"
import type { MonotonicClock } from "@mapachess/match/match-clock"
import matchMachine, {
  selectMatchTimeline,
} from "@mapachess/match/match-machine"
import type { MatchSessionIdentity } from "@mapachess/match/match-session-machine"
import createMatchSetupForMode from "@mapachess/match/match-setup"
import type { MatchVariant } from "@mapachess/match/match-variant"
import {
  timeCategory,
  UNTIMED,
  type TimeControl,
} from "@mapachess/match/time-control"
import profileMachine, {
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "@mapachess/profile/profile-machine"
import ProfileMatchPersistenceBridge, {
  persistProfileActiveMatch,
} from "@mapachess/profile/profile-match-persistence"
import { startingPlayerElos } from "@mapachess/profile/rating-context"
import {
  canPlayStoryOpponent,
  selectChallengeUnlockedOpponents,
  selectDefaultStoryOpponent,
} from "@mapachess/profile/story-progress"
import resumeMatch, {
  buildFreshMatch,
  type ResumedMatch,
} from "./durableMatch.js"
import type {
  MatchRuntime,
  OpenMatchRuntime,
  OpenMatchRuntimeInput,
} from "./matchRuntime.js"

type ProfileActor = ActorRefFrom<typeof profileMachine>

export type MatchSession<Runtime extends MatchRuntime = MatchRuntime> =
  MatchSessionIdentity &
    Readonly<{
      clockStartsOnArrival?: boolean
      actor: ActorRefFrom<typeof matchMachine>
      close: () => Promise<void>
      evaluationActor: ActorRefFrom<typeof positionEvaluationMachine>
      match: DurableMatchRecord
      runtime: Runtime
    }>

export type OpenMatchSessionInput<Runtime extends MatchRuntime = MatchRuntime> =
  Readonly<{
    openRuntime: OpenMatchRuntime<Runtime>
    monotonicClock: MonotonicClock
    profileActor: ProfileActor
    signal: AbortSignal
  }>

export type FreshMatchSessionOptions<
  Runtime extends MatchRuntime = MatchRuntime,
> = Readonly<{
  timeControl?: TimeControl
  previousSession: MatchSession<Runtime> | null
  replacementSession?: MatchSession<Runtime> | null
}> &
  (
    | Readonly<{
        mode?: "story"
        variant: MatchVariant
        opponentId?: ImplementedDurableOpponentId
      }>
    | Readonly<{
        mode: "challenge"
        challengeSetup: ChallengeSetup
        displayedChess960PositionId?: Chess960PositionId
      }>
  )

export type OpenFreshMatchSessionInput<
  Runtime extends MatchRuntime = MatchRuntime,
> = OpenMatchSessionInput<Runtime> &
  FreshMatchSessionOptions<Runtime> &
  Readonly<{
    challengeDifficultyTargets: (variant: MatchVariant) => readonly number[]
  }>

export type ReturnMatchSessionToMenuInput = Readonly<{
  profileActor: ProfileActor
  session: MatchSession
  signal: AbortSignal
}>

const requirePlayerData = (profileActor: ProfileActor) => {
  const playerData = selectCurrentPlayerData(profileActor.getSnapshot())
  if (playerData === null) {
    throw new Error("A valid player profile is required to open a match.")
  }
  return playerData
}

const abortedOpening = (): Error => {
  const error = new Error("Match session opening was aborted.")
  error.name = "AbortError"
  return error
}

const closeRuntimeAfterFailure = async (
  runtime: MatchRuntime,
  openingFailure: unknown,
): Promise<never> => {
  try {
    await runtime.close()
  } catch (closeFailure) {
    throw new AggregateError(
      [openingFailure, closeFailure],
      "Match session failed to open and close cleanly.",
    )
  }
  throw openingFailure
}

type OpenActorSessionInput<Runtime extends MatchRuntime> = Readonly<{
  monotonicClock: MonotonicClock
  fresh?: boolean
  match: DurableMatchRecord
  profileActor: ProfileActor
  resumedMatch: ResumedMatch
  runtime: Runtime
  signal: AbortSignal
}>

const openActorSession = async <Runtime extends MatchRuntime>({
  monotonicClock,
  match,
  profileActor,
  resumedMatch,
  runtime,
  signal,
  fresh = false,
}: OpenActorSessionInput<Runtime>): Promise<MatchSession<Runtime>> => {
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
        timeControl: match.timeControl,
        monotonicClock,
        autoHintMode: match.autoHintMode,
        durability: { persistence, type: "durable" },
        hintAnalyst: runtime.hintAnalyst,
        matchId: match.matchId,
        opponent: runtime.opponent,
        playerColor: match.playerColor,
        resumedState: {
          clock: match.clock ?? null,
          retainedConclusion: match.retainedConclusion ?? null,
          conclusion: match.conclusion,
          moveHintsUsed: match.moveHintsUsed,
          pieceHintsUsed: match.pieceHintsUsed,
          timeline: resumedMatch.timeline,
        },
      },
    }).start()
    matchActor = openedMatchActor
    const openedEvaluationActor = createActor(positionEvaluationMachine, {
      input: {
        evaluator: createMoveFeedbackEvaluator({
          matchId: match.matchId,
          evaluate: runtime.positionEvaluator,
          timeline: () => selectMatchTimeline(openedMatchActor.getSnapshot()),
          records: () =>
            selectCurrentPlayerData(profileActor.getSnapshot())?.activeMatch
              ?.moveFeedback ?? [],
          persist: (record, analysisSignal) =>
            persistence.persistMoveFeedback(record, analysisSignal),
        }),
      },
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
      clockStartsOnArrival: fresh,
      actor: openedMatchActor,
      close,
      evaluationActor: openedEvaluationActor,
      match,
      runtime,
      setup: {
        ...createMatchSetupForMode(
          { mode: match.mode, variant: match.startingPosition.variant },
          {
            ...match.startingPosition,
            playerColor: match.playerColor,
            opponentId: match.opponentId,
            difficultyTargetElo: runtime.opponentTargetElo,
          },
        ),
        timeControl: match.timeControl,
      },
    })
  } catch (error) {
    evaluationBinding?.disconnect()
    evaluationActor?.stop()
    matchActor?.stop()
    return closeRuntimeAfterFailure(runtime, error)
  }
}

export async function openCurrentMatchSession<Runtime extends MatchRuntime>({
  openRuntime,
  monotonicClock,
  profileActor,
  signal,
}: OpenMatchSessionInput<Runtime>): Promise<MatchSession<Runtime>> {
  const activeMatch = requirePlayerData(profileActor).activeMatch
  if (activeMatch === null) {
    throw new Error("The player profile has no active match to resume.")
  }

  const resumedMatch = resumeMatch(activeMatch)
  const commonRuntimeInput = {
    matchSeed: resumedMatch.matchSeed,
    opponentId: activeMatch.opponentId,
    opponentPolicyFingerprint: activeMatch.opponentPolicyFingerprint,
    setup: activeMatch.startingPosition,
    signal,
  }
  const runtime = await openRuntime(
    activeMatch.mode === "challenge"
      ? {
          ...commonRuntimeInput,
          mode: "challenge",
          playerColor: activeMatch.playerColor,
          ...(activeMatch.opponentTargetElo === undefined
            ? {}
            : { difficultyTargetElo: activeMatch.opponentTargetElo }),
        }
      : commonRuntimeInput,
  )
  if (signal.aborted) return closeRuntimeAfterFailure(runtime, abortedOpening())
  if (
    activeMatch.opponentPolicyFingerprint !==
      runtime.opponentPolicyFingerprint ||
    (activeMatch.opponentTargetElo !== undefined &&
      activeMatch.opponentTargetElo !== runtime.opponentTargetElo) ||
    (typeof activeMatch.ratedOpponentElo === "number" &&
      activeMatch.ratedOpponentElo !== runtime.ratedOpponentElo)
  ) {
    return closeRuntimeAfterFailure(
      runtime,
      new Error("The saved match requires its original opponent policy."),
    )
  }
  let match = activeMatch
  if (activeMatch.ratedOpponentElo === undefined) {
    match = Object.freeze({
      ...activeMatch,
      ratedOpponentElo: runtime.ratedOpponentElo,
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
    monotonicClock,
    match,
    profileActor,
    resumedMatch,
    runtime,
    signal,
  })
}

export default async function openFreshMatchSession<
  Runtime extends MatchRuntime,
>(input: OpenFreshMatchSessionInput<Runtime>): Promise<MatchSession<Runtime>> {
  const {
    openRuntime,
    monotonicClock,
    previousSession,
    replacementSession = null,
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
    ((previousSession ?? replacementSession) === null ||
      activeMatch.matchId !==
        (previousSession ?? replacementSession)?.match.matchId)
  ) {
    return openCurrentMatchSession({
      openRuntime,
      monotonicClock,
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
  if (
    challengeSetup !== undefined &&
    (!selectChallengeUnlockedOpponents(playerData.storyProgress).some(
      ({ id }) => id === opponentId,
    ) ||
      !input
        .challengeDifficultyTargets(variant)
        .includes(challengeSetup.difficultyTargetElo))
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
  const setup: OpenMatchRuntimeInput["setup"] =
    previousSession?.match.startingPosition ??
    (input.mode === "challenge" &&
    input.challengeSetup.variant === "chess960" &&
    input.displayedChess960PositionId !== undefined
      ? {
          variant: "chess960",
          chess960PositionId: input.displayedChess960PositionId,
        }
      : challengeSetup?.variant === "chess960" &&
          challengeSetup.chess960PositionId !== null
        ? {
            variant: "chess960",
            chess960PositionId: challengeSetup.chess960PositionId,
          }
        : variant === "standard"
          ? { variant, chess960PositionId: null }
          : { variant })
  const commonRuntimeInput = {
    opponentId,
    ...(previousSession === null
      ? {}
      : {
          opponentPolicyFingerprint:
            previousSession.match.opponentPolicyFingerprint,
        }),
    setup,
    signal,
  }
  const runtime = await openRuntime(
    playerColor === undefined
      ? commonRuntimeInput
      : {
          ...commonRuntimeInput,
          mode: "challenge",
          playerColor,
          ...(challengeSetup === undefined
            ? {}
            : { difficultyTargetElo: challengeSetup.difficultyTargetElo }),
        },
  )
  const mode = playerColor === undefined ? "story" : "challenge"
  const timeControl =
    previousSession?.match.timeControl ?? input.timeControl ?? UNTIMED
  const playerElosAtStart = startingPlayerElos(
    playerData.ratings,
    runtime.startingPosition.variant,
    timeCategory(timeControl),
  )
  const freshMatch = buildFreshMatch({
    timeControl,
    autoHintMode: playerData.settings.autoHintMode,
    mode,
    playerEloAtStart: playerElosAtStart.gold,
    playerElosAtStart,
    runtime,
  })

  let resumedMatch: ResumedMatch
  try {
    if (
      challengeSetup !== undefined &&
      runtime.opponentTargetElo !== challengeSetup.difficultyTargetElo
    ) {
      throw new Error(
        "The opened Challenge difficulty does not match the selection.",
      )
    }
    resumedMatch = resumeMatch(freshMatch)
    await persistProfileActiveMatch({
      actor: profileActor,
      candidate: freshMatch,
      expectedActiveMatch: activeMatch,
      signal,
    })
  } catch (error) {
    return closeRuntimeAfterFailure(runtime, error)
  }

  const session = await openActorSession({
    monotonicClock,
    fresh: true,
    match: freshMatch,
    profileActor,
    resumedMatch,
    runtime,
    signal,
  })
  try {
    if (challengeSetup !== undefined) {
      await persistProfileActiveMatch({
        actor: profileActor,
        candidate: requirePlayerData(profileActor).activeMatch,
        challengeSetup,
        expectedActiveMatch: requirePlayerData(profileActor).activeMatch,
        signal,
      })
    }
    await replacementSession?.close()
    return session
  } catch (error) {
    await session.close()
    throw error
  }
}

export async function returnMatchSessionToMenu({
  profileActor,
  session,
  signal,
}: ReturnMatchSessionToMenuInput): Promise<void> {
  await session.close()

  // ONE-TIME EXCEPTION: A dispatched save can finish after its match closes.
  const settled = await waitFor(
    profileActor,
    (snapshot) =>
      !snapshot.matches("persisting") &&
      !snapshot.matches("retryingPersistence"),
    { signal },
  )
  if (!settled.matches("ready"))
    throw new Error("A saved profile is required to return to the menu.")
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
