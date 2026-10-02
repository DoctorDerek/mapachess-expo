"use client"

import { useEffect, useState } from "react"
import { createActor, type ActorRefFrom } from "xstate"
import profileMachine, {
  selectCanNavigateProfile,
  selectCurrentPlayerData,
} from "@mapachess/profile/profile-machine"
import {
  openCurrentWebMatchSession,
  openFreshWebMatchSession,
  returnWebMatchSessionToMenu,
} from "./webMatchSession"
import webMatchSessionMachine, {
  type WebMatchSession,
  type WebMatchSessionActor,
} from "./webMatchSessionMachine"

export default function useWebMatchSession(
  profileActor: ActorRefFrom<typeof profileMachine>,
): WebMatchSessionActor | null {
  const [sessionActor, setSessionActor] = useState<WebMatchSessionActor | null>(
    null,
  )
  useEffect(() => {
    const playerData = selectCurrentPlayerData(profileActor.getSnapshot())
    if (playerData === null)
      throw new Error("A valid player profile is required to enter play.")
    let disposed = false
    let latestSession: WebMatchSession | null = null
    const captureSession = async (
      promise: Promise<WebMatchSession>,
    ): Promise<WebMatchSession> => {
      const session = await promise
      if (disposed) {
        await session.close()
        throw new DOMException("Web match view was closed.", "AbortError")
      }
      latestSession = session
      return session
    }
    const actor = createActor(webMatchSessionMachine, {
      input: {
        activeMatchExists: playerData.activeMatch !== null,
        operations: {
          canNavigate: () =>
            selectCanNavigateProfile(profileActor.getSnapshot()),
          openCurrentMatch: (signal) =>
            captureSession(
              openCurrentWebMatchSession({ profileActor, signal }),
            ),
          openFreshMatch: (previousSession, setup, signal) =>
            captureSession(
              openFreshWebMatchSession({
                previousSession,
                replacementSession:
                  previousSession === null ? latestSession : null,
                ...setup,
                profileActor,
                signal,
              }),
            ),
          returnToMenu: async (session, signal) => {
            await returnWebMatchSessionToMenu({ profileActor, session, signal })
            if (latestSession === session) latestSession = null
          },
        },
      },
    }).start()
    let preImportBackup =
      profileActor.getSnapshot().context.loaded?.snapshot.preImportBackup ??
      null
    const profileSubscription = profileActor.subscribe((snapshot) => {
      if (!snapshot.matches("ready") || disposed) return
      const current = selectCurrentPlayerData(snapshot)
      if (current === null) return
      const acceptedBackup =
        snapshot.context.loaded?.snapshot.preImportBackup ?? null
      const imported = acceptedBackup !== preImportBackup
      preImportBackup = acceptedBackup
      const sessionSnapshot = actor.getSnapshot()
      if (
        !sessionSnapshot.matches("active") &&
        !sessionSnapshot.matches("menu")
      )
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
    setSessionActor(actor)
    return () => {
      disposed = true
      profileSubscription.unsubscribe()
      actor.stop()
      if (latestSession !== null)
        void latestSession.close().catch(() => undefined)
    }
  }, [profileActor])
  return sessionActor
}
