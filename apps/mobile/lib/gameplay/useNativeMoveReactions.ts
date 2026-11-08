import { useEffect, useState } from "react"
import createMoveReactionController from "@mapachess/evaluation/move-reaction-controller"
import type { MatchTimeline } from "@mapachess/match/match-timeline"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"

export default function useNativeMoveReactions(
  timeline: MatchTimeline,
  records: readonly MoveFeedbackRecord[],
  paused: boolean,
) {
  const [controller, setController] = useState<ReturnType<
    typeof createMoveReactionController
  > | null>(null)
  useEffect(() => {
    const opened = createMoveReactionController(timeline)
    setController(opened)
    return opened.close
  }, [])
  useEffect(() => {
    controller?.update(timeline, records, paused)
  }, [controller, timeline, records, paused])
  return controller
}
