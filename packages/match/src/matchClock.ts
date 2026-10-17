import type { MatchColor } from "./matchPosition.js"
import type { TimeControl } from "./timeControl.js"

export type ClockDurations = Readonly<Record<MatchColor, number>>
export type MatchClockRecord = Readonly<{
  activeColor: MatchColor
  remainingMs: ClockDurations
  history: readonly ClockDurations[]
  paused: boolean
}>
export type MatchClock = MatchClockRecord &
  Readonly<{ startedAt: number | null }>
export type MonotonicClock = Readonly<{ now: () => number }>

export const createMatchClock = (
  control: TimeControl,
  activeColor: MatchColor,
): MatchClock | null => {
  if (control.type === "untimed") return null
  const remainingMs = Object.freeze({
    white: control.baseSeconds * 1000,
    black: control.baseSeconds * 1000,
  })
  return Object.freeze({
    activeColor,
    remainingMs,
    history: Object.freeze([remainingMs]),
    paused: false,
    startedAt: null,
  })
}

export const remainingClockTime = (
  clock: MatchClock,
  now: number,
): ClockDurations =>
  clock.startedAt === null
    ? clock.remainingMs
    : Object.freeze({
        ...clock.remainingMs,
        [clock.activeColor]: Math.max(
          0,
          clock.remainingMs[clock.activeColor] -
            Math.max(0, now - clock.startedAt),
        ),
      })

export const stopMatchClock = (
  clock: MatchClock | null,
  now: number,
): MatchClock | null =>
  clock === null || clock.startedAt === null
    ? clock
    : Object.freeze({
        ...clock,
        remainingMs: remainingClockTime(clock, now),
        startedAt: null,
      })

export const startMatchClock = (
  clock: MatchClock | null,
  now: number,
): MatchClock | null =>
  clock === null || clock.paused || clock.startedAt !== null
    ? clock
    : Object.freeze({ ...clock, startedAt: now })

export const pauseMatchClock = (
  clock: MatchClock | null,
  now: number,
): MatchClock | null => {
  const stopped = stopMatchClock(clock, now)
  return stopped === null ? null : Object.freeze({ ...stopped, paused: true })
}

export const clockHasExpired = (
  clock: MatchClock | null,
  now: number,
): boolean =>
  clock !== null && remainingClockTime(clock, now)[clock.activeColor] <= 0

export const advanceMatchClock = (
  clock: MatchClock | null,
  control: TimeControl,
  cursor: number,
  nextColor: MatchColor,
): MatchClock | null => {
  if (clock === null || control.type === "untimed") return null
  const remainingMs = Object.freeze({
    ...clock.remainingMs,
    [clock.activeColor]:
      clock.remainingMs[clock.activeColor] + control.incrementSeconds * 1000,
  })
  return Object.freeze({
    ...clock,
    activeColor: nextColor,
    remainingMs,
    history: Object.freeze([...clock.history.slice(0, cursor), remainingMs]),
    startedAt: null,
  })
}

export const restoreMatchClock = (
  clock: MatchClock | null,
  cursor: number,
  activeColor: MatchColor,
  expired = false,
): MatchClock | null => {
  if (clock === null) return null
  const recorded = clock.history[cursor]
  if (recorded === undefined)
    throw new Error("Clock history has no matching board cursor.")
  return Object.freeze({
    ...clock,
    activeColor,
    remainingMs: expired
      ? Object.freeze({ ...recorded, [activeColor]: 0 })
      : recorded,
    paused: true,
    startedAt: null,
  })
}

export const durableMatchClock = (
  clock: MatchClock | null,
): MatchClockRecord | null =>
  clock === null
    ? null
    : Object.freeze({
        activeColor: clock.activeColor,
        remainingMs: clock.remainingMs,
        history: clock.history,
        paused: clock.paused,
      })
