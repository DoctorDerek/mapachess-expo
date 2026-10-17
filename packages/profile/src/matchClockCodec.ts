import type {
  ClockDurations,
  MatchClockRecord,
} from "@mapachess/match/match-clock"
import type { MatchConclusion } from "@mapachess/match/match-conclusion"
import { MATCH_COLORS } from "@mapachess/match/match-position"
import {
  currentMatchPosition,
  type MatchTimeline,
} from "@mapachess/match/match-timeline"
import {
  TIME_CONTROL_PRESETS,
  type TimeControl,
} from "@mapachess/match/time-control"
import {
  failData,
  requireBoolean,
  requireEnumValue,
  requireExactKeys,
  requireObject,
} from "./decodePrimitives.js"

export const decodeTimeControl = (
  received: unknown,
  path: string,
): TimeControl => {
  const object = requireObject(received, path)
  requireExactKeys(
    object,
    object.type === "untimed"
      ? ["type"]
      : ["type", "baseSeconds", "incrementSeconds"],
    path,
  )
  const preset = TIME_CONTROL_PRESETS.find(({ control }) =>
    control.type === "untimed"
      ? object.type === "untimed"
      : object.type === "fischer" &&
        object.baseSeconds === control.baseSeconds &&
        object.incrementSeconds === control.incrementSeconds,
  )
  return preset?.control ?? failData(path)
}

const decodeDurations = (received: unknown, path: string): ClockDurations => {
  const object = requireObject(received, path)
  requireExactKeys(object, MATCH_COLORS, path)
  const duration = (value: unknown, color: string): number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : failData(`${path}.${color}`)
  return Object.freeze({
    white: duration(object.white, "white"),
    black: duration(object.black, "black"),
  })
}

export default function decodeMatchClock(
  received: unknown,
  control: TimeControl,
  timeline: MatchTimeline,
  conclusion: MatchConclusion | null,
  path: string,
): MatchClockRecord | null {
  if (control.type === "untimed") {
    if (received != null) return failData(path)
    if (
      conclusion?.type === "timeout" ||
      conclusion?.type === "timeout-insufficient-material"
    )
      return failData(path)
    return null
  }
  const object = requireObject(received, path)
  requireExactKeys(
    object,
    ["activeColor", "remainingMs", "history", "paused"],
    path,
  )
  if (
    !Array.isArray(object.history) ||
    object.history.length !== timeline.transitions.length + 1
  )
    return failData(`${path}.history`)
  const history = Object.freeze(
    object.history.map((value: unknown, index: number) =>
      decodeDurations(value, `${path}.history[${String(index)}]`),
    ),
  )
  const first = history[0]
  if (
    first?.white !== control.baseSeconds * 1000 ||
    first.black !== control.baseSeconds * 1000
  )
    return failData(`${path}.history[0]`)
  for (const [index, transition] of timeline.transitions.entries()) {
    const before = history[index]!
    const after = history[index + 1]!
    const mover = transition.before.turn
    const other = transition.after.turn
    if (
      after[other] !== before[other] ||
      after[mover] <= control.incrementSeconds * 1000 ||
      after[mover] > before[mover] + control.incrementSeconds * 1000
    )
      return failData(`${path}.history[${String(index + 1)}]`)
  }
  const activeColor = requireEnumValue(
    object.activeColor,
    MATCH_COLORS,
    `${path}.activeColor`,
  )
  const remainingMs = decodeDurations(object.remainingMs, `${path}.remainingMs`)
  const recorded = history[timeline.cursor]!
  const other = activeColor === "white" ? "black" : "white"
  if (
    activeColor !== currentMatchPosition(timeline).turn ||
    remainingMs[other] !== recorded[other] ||
    remainingMs[activeColor] > recorded[activeColor]
  )
    return failData(path)
  const timeout =
    conclusion?.type === "timeout" ||
    conclusion?.type === "timeout-insufficient-material"
  if (timeout !== (remainingMs[activeColor] === 0))
    return failData(`${path}.remainingMs`)
  return Object.freeze({
    activeColor,
    remainingMs,
    history,
    paused: requireBoolean(object.paused, `${path}.paused`),
  })
}
