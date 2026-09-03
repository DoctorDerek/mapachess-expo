import { createActor, type ActorRefFrom } from "xstate"
import bindMatchPositionEvaluation, {
  type MatchPositionEvaluationBinding,
} from "@mapachess/evaluation/match-position-evaluation"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import { autoHintModeFromLegacyEnabled } from "@mapachess/match/auto-hint-mode"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import matchMachine from "@mapachess/match/match-machine"
import profileMachine, {
  selectCurrentPlayerData,
} from "@mapachess/profile/profile-machine"
import ProfileMatchPersistenceBridge, {
  persistProfileActiveMatch,
} from "@mapachess/profile/profile-match-persistence"
import type { WebMatchRuntime } from "../gameplay/webMatchRuntime"
import type { WebMatchSession } from "../gameplay/webMatchSessionMachine"
import openStandardChickenRuntime, {
  type OpenStandardChickenRuntimeInput,
} from "./openStandardChickenRuntime"
import resumeStandardChickenMatch, {
  buildFreshStandardChickenMatch,
  type ResumedStandardChickenMatch,
} from "./standardChickenDurableMatch"

type ProfileActor = ActorRefFrom<typeof profileMachine>

type OpenStandardChickenRuntime = (
  input?: OpenStandardChickenRuntimeInput,
) => Promise<WebMatchRuntime>

export type OpenStandardChickenMatchSessionInput = Readonly<{
  openRuntime?: OpenStandardChickenRuntime
  profileActor: ProfileActor
  signal: AbortSignal
}>

export type OpenFreshStandardChickenMatchSessionInput =
  OpenStandardChickenMatchSessionInput &
    Readonly<{
      previousSession: WebMatchSession | null
    }>

export type ReturnStandardChickenMatchSessionToMenuInput = Readonly<{
  profileActor: ProfileActor
  session: WebMatchSession
  signal: AbortSignal
}>

const requireCompletedPlayerData = (profileActor: ProfileActor) => {
  const playerData = selectCurrentPlayerData(profileActor.getSnapshot())
  if (playerData?.firstRun.autoHintsChoiceCompleted !== true) {
    throw new Error("A completed player profile is required to open a match.")
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
  resumedMatch: ResumedStandardChickenMatch
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

export async function openCurrentStandardChickenMatchSession({
  openRuntime = openStandardChickenRuntime,
  profileActor,
  signal,
}: OpenStandardChickenMatchSessionInput): Promise<WebMatchSession> {
  const activeMatch = requireCompletedPlayerData(profileActor).activeMatch
  if (activeMatch === null) {
    throw new Error("The player profile has no active match to resume.")
  }

  const resumedMatch = resumeStandardChickenMatch(activeMatch)
  const runtime = await openRuntime({
    matchSeed: resumedMatch.matchSeed,
    signal,
  })
  return openActorSession({
    match: activeMatch,
    profileActor,
    resumedMatch,
    runtime,
    signal,
  })
}

export async function openFreshStandardChickenMatchSession({
  openRuntime = openStandardChickenRuntime,
  previousSession,
  profileActor,
  signal,
}: OpenFreshStandardChickenMatchSessionInput): Promise<WebMatchSession> {
  await previousSession?.close()

  const playerData = requireCompletedPlayerData(profileActor)
  const activeMatch = playerData.activeMatch
  if (
    activeMatch !== null &&
    (previousSession === null ||
      activeMatch.matchId !== previousSession.match.matchId)
  ) {
    return openCurrentStandardChickenMatchSession({
      openRuntime,
      profileActor,
      signal,
    })
  }
  if (previousSession !== null && activeMatch === null) {
    throw new Error("The match selected for restart is no longer active.")
  }

  const runtime = await openRuntime({ signal })
  const freshMatch = buildFreshStandardChickenMatch({
    autoHintMode: autoHintModeFromLegacyEnabled(
      playerData.settings.autoHintsEnabled,
    ),
    playerEloAtStart: playerData.ratings.standardStory,
    runtime,
  })

  try {
    await persistProfileActiveMatch({
      actor: profileActor,
      candidate: freshMatch,
      expectedActiveMatch: activeMatch,
      signal,
    })
  } catch (error) {
    return closeRuntimeAfterFailure(runtime, error)
  }

  return openActorSession({
    match: freshMatch,
    profileActor,
    resumedMatch: resumeStandardChickenMatch(freshMatch),
    runtime,
    signal,
  })
}

export async function returnStandardChickenMatchSessionToMenu({
  profileActor,
  session,
  signal,
}: ReturnStandardChickenMatchSessionToMenuInput): Promise<void> {
  await session.close()

  const activeMatch = requireCompletedPlayerData(profileActor).activeMatch
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
