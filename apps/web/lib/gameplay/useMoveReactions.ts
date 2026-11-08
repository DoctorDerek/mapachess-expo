"use client"

import { useActorRef } from "@xstate/react"
import { useCallback, useEffect, useState } from "react"
import createMoveReactionController from "@mapachess/evaluation/move-reaction-controller"
import moveReactionMachine from "@mapachess/evaluation/move-reaction-machine"
import type { MatchTimeline } from "@mapachess/match/match-timeline"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"

export default function useMoveReactions(
  timeline: MatchTimeline,
  records: readonly MoveFeedbackRecord[],
  paused: boolean,
) {
  const actor = useActorRef(moveReactionMachine)
  const [controller] = useState(() =>
    createMoveReactionController(timeline, actor),
  )
  const clear = useCallback(() => controller.clear(), [controller])
  useEffect(() => {
    const visibilityChanged = () => {
      if (document.hidden) clear()
    }
    document.addEventListener("visibilitychange", visibilityChanged)
    return () => {
      document.removeEventListener("visibilitychange", visibilityChanged)
      clear()
    }
  }, [clear])
  useEffect(() => {
    controller.update(timeline, records, paused || document.hidden)
  }, [controller, paused, records, timeline])
  return { actor, clear }
}
