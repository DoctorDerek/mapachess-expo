import { clockHasExpired, stopMatchClock } from "./matchClock.js"
import { createTimeoutConclusion } from "./matchConclusion.js"
import type { MatchMachineContext } from "./matchMachineTypes.js"
import {
  createPendingMatchMutation,
  type PendingMatchMutation,
} from "./matchPersistence.js"
import { currentMatchPosition } from "./matchTimeline.js"
import { pendingConclusionMutation } from "./matchWorkflow.js"

export const pendingClockPause = (
  context: MatchMachineContext,
): PendingMatchMutation => {
  const clock = stopMatchClock(context.clock, context.monotonicClock.now())
  if (clockHasExpired(clock, context.monotonicClock.now()))
    return pendingClockTimeout({ ...context, clock })
  return createPendingMatchMutation({
    clock: clock === null ? null : Object.freeze({ ...clock, paused: true }),
    autoHintMode: context.autoHintMode,
    conclusion: context.conclusion,
    retainedConclusion: context.retainedConclusion,
    hints: context.hints,
    matchId: context.matchId,
    moveHintsUsed: context.moveHintsUsed,
    pieceHintsUsed: context.pieceHintsUsed,
    mutationSequence: context.mutationSequence,
    timeline: context.timeline,
    route: "resolve-position",
  })
}

export const pendingClockTimeout = (
  context: MatchMachineContext,
): PendingMatchMutation =>
  pendingConclusionMutation(
    context,
    createTimeoutConclusion(currentMatchPosition(context.timeline)),
  )
