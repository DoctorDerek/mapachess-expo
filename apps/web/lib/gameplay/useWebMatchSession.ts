"use client"

import { useEffect, useState } from "react"
import createMatchSessionController from "@mapachess/gameplay/session-controller"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import openWebMatchRuntime from "./openWebMatchRuntime"
import type { WebMatchSessionActor } from "./webMatchSessionMachine"
import { webChallengeDifficultyTargets } from "./webOpponentPolicy"

export default function useWebMatchSession(
  profileActor: ProfileActor,
): WebMatchSessionActor | null {
  const [sessionActor, setSessionActor] = useState<WebMatchSessionActor | null>(
    null,
  )
  useEffect(() => {
    const controller = createMatchSessionController({
      profileActor,
      openRuntime: openWebMatchRuntime,
      monotonicClock: { now: () => performance.now() },
      challengeDifficultyTargets: webChallengeDifficultyTargets,
      activity: {
        isActive: () => document.visibilityState !== "hidden",
        subscribe: (listener) => {
          document.addEventListener("visibilitychange", listener)
          return () =>
            document.removeEventListener("visibilitychange", listener)
        },
      },
    })
    setSessionActor(controller.actor)
    return () => {
      void controller.close().catch(() => undefined)
    }
  }, [profileActor])
  return sessionActor
}
