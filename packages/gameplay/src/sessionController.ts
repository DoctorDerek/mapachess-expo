import { createActor } from "xstate"
import type { MonotonicClock } from "@mapachess/match/match-clock"
import createMatchSessionMachine, {
  type MatchSessionActor,
} from "@mapachess/match/match-session-machine"
import type { MatchVariant } from "@mapachess/match/match-variant"
import {
  selectCanNavigateProfile,
  selectCurrentPlayerData,
} from "@mapachess/profile/profile-machine"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import type { MatchRuntime, OpenMatchRuntime } from "./matchRuntime.js"
import openFreshMatchSession, {
  openCurrentMatchSession,
  returnMatchSessionToMenu,
  type MatchSession,
} from "./matchSession.js"

export type ApplicationActivity = Readonly<{
  isActive: () => boolean
  subscribe: (listener: () => void) => () => void
}>

export type MatchSessionController<
  Runtime extends MatchRuntime = MatchRuntime,
> = Readonly<{
  actor: MatchSessionActor<MatchSession<Runtime>>
  close: () => Promise<void>
}>

export type MatchSessionControllerInput<Runtime extends MatchRuntime> =
  Readonly<{
    profileActor: ProfileActor
    openRuntime: OpenMatchRuntime<Runtime>
    monotonicClock: MonotonicClock
    challengeDifficultyTargets: (variant: MatchVariant) => readonly number[]
    activity: ApplicationActivity
  }>

export default function createMatchSessionController<
  Runtime extends MatchRuntime,
>(
  input: MatchSessionControllerInput<Runtime>,
): MatchSessionController<Runtime> {
  const { profileActor, openRuntime, monotonicClock, activity } = input
  const playerData = selectCurrentPlayerData(profileActor.getSnapshot())
  if (playerData === null) {
    throw new Error("A valid player profile is required to enter play.")
  }
  let disposed = false
  let closing: Promise<void> | undefined
  let latestSession: MatchSession<Runtime> | null = null
  const captureSession = async (
    promise: Promise<MatchSession<Runtime>>,
  ): Promise<MatchSession<Runtime>> => {
    const session = await promise
    if (disposed) {
      await session.close()
      const error = new Error("Match view was closed.")
      error.name = "AbortError"
      throw error
    }
    latestSession = session
    return session
  }
  const actor = createActor(
    createMatchSessionMachine<MatchSession<Runtime>>(),
    {
      input: {
        activeMatchExists: playerData.activeMatch !== null,
        operations: {
          canNavigate: () =>
            selectCanNavigateProfile(profileActor.getSnapshot()),
          openCurrentMatch: (signal) =>
            captureSession(
              openCurrentMatchSession({
                profileActor,
                openRuntime,
                monotonicClock,
                signal,
              }),
            ),
          openFreshMatch: (previousSession, setup, signal) =>
            captureSession(
              openFreshMatchSession({
                previousSession,
                replacementSession:
                  previousSession === null ? latestSession : null,
                ...setup,
                profileActor,
                openRuntime,
                monotonicClock,
                signal,
                challengeDifficultyTargets: input.challengeDifficultyTargets,
              }),
            ),
          returnToMenu: async (session, signal) => {
            await returnMatchSessionToMenu({ profileActor, session, signal })
            if (latestSession === session) latestSession = null
          },
        },
      },
    },
  ).start()
  const arrivedMatches = new WeakSet<MatchSession<Runtime>>()
  const updateClockAvailability = (): void => {
    const current = actor.getSnapshot()
    const session = current.context.session
    if (session === null) return
    if (
      !current.matches("active") ||
      current.context.overlays.length > 0 ||
      !activity.isActive()
    ) {
      arrivedMatches.add(session)
      session.actor.send({ type: "MATCH.CLOCK_PAUSE_REQUESTED" })
    } else if (session.clockStartsOnArrival && !arrivedMatches.has(session)) {
      arrivedMatches.add(session)
      session.actor.send({ type: "MATCH.CLOCK_RESUME_REQUESTED" })
    }
  }
  const clockSubscription = actor.subscribe(updateClockAvailability)
  const removeActivity = activity.subscribe(updateClockAvailability)
  let preImportBackup =
    profileActor.getSnapshot().context.loaded?.snapshot.preImportBackup ?? null
  const profileSubscription = profileActor.subscribe((snapshot) => {
    if (!selectCanNavigateProfile(snapshot)) {
      actor
        .getSnapshot()
        .context.session?.actor.send({ type: "MATCH.CLOCK_PAUSE_REQUESTED" })
    }
    if (!snapshot.matches("ready") || disposed) return
    const current = selectCurrentPlayerData(snapshot)
    if (current === null) return
    const acceptedBackup =
      snapshot.context.loaded?.snapshot.preImportBackup ?? null
    const imported = acceptedBackup !== preImportBackup
    preImportBackup = acceptedBackup
    const sessionSnapshot = actor.getSnapshot()
    if (!sessionSnapshot.matches("active") && !sessionSnapshot.matches("menu"))
      return
    if (
      !imported &&
      (latestSession === null ||
        latestSession.match.matchId === current.activeMatch?.matchId)
    )
      return
    const replaced = latestSession
    latestSession = null
    if (replaced !== null) void replaced.close().catch(() => undefined)
    actor.send({
      type: "MATCH_SESSION.PROFILE_REPLACED",
      activeMatchExists: current.activeMatch !== null,
    })
  })
  return Object.freeze({
    actor,
    close: () => {
      if (closing !== undefined) return closing
      disposed = true
      removeActivity()
      clockSubscription.unsubscribe()
      profileSubscription.unsubscribe()
      actor.stop()
      closing = latestSession?.close() ?? Promise.resolve()
      return closing
    },
  })
}
