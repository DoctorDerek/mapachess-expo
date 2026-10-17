import { fromCallback } from "xstate"
import {
  remainingClockTime,
  type MatchClock,
  type MonotonicClock,
} from "./matchClock.js"
import type { MatchMachineEvent } from "./matchMachineTypes.js"

export default fromCallback<
  MatchMachineEvent,
  Readonly<{ clock: MatchClock | null; monotonicClock: MonotonicClock }>
>(({ input, sendBack }) => {
  const clock = input.clock
  if (clock === null || clock.paused || clock.startedAt === null) return
  let timer: ReturnType<typeof setTimeout> | undefined
  const checkDeadline = (): void => {
    const remaining = remainingClockTime(clock, input.monotonicClock.now())[
      clock.activeColor
    ]
    if (remaining <= 0) sendBack({ type: "MATCH.CLOCK_EXPIRED" })
    else timer = setTimeout(checkDeadline, Math.ceil(remaining))
  }
  checkDeadline()
  return () => clearTimeout(timer)
})
