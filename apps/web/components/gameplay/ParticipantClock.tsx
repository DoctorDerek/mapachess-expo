"use client"

import cx from "classix"
import { useEffect, useState } from "react"
import {
  remainingClockTime,
  type MatchClock,
  type MonotonicClock,
} from "@mapachess/match/match-clock"
import type { MatchColor } from "@mapachess/match/match-position"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

const CLOCK_DISPLAY_INTERVAL_MS = 100
const LOW_TIME_MS = 10_000

export default function ParticipantClock({
  clock,
  color,
  monotonicClock,
}: Readonly<{
  clock: MatchClock
  color: MatchColor
  monotonicClock: MonotonicClock
}>) {
  const copy = useMapachessCopy()
  const [, repaint] = useState(0)
  const running =
    clock.activeColor === color && clock.startedAt !== null && !clock.paused
  useEffect(() => {
    if (!running) return
    const timer = setInterval(
      () => repaint((previous) => previous + 1),
      CLOCK_DISPLAY_INTERVAL_MS,
    )
    return () => clearInterval(timer)
  }, [running])
  const remaining = remainingClockTime(clock, monotonicClock.now())[color]
  const seconds = Math.ceil(remaining / 1000)
  return (
    <span
      role="timer"
      aria-live="off"
      aria-label={copy.gameplay.clock.label(copy.board.colors[color])}
      className={cx(
        "ml-2 inline-flex min-w-18 items-baseline justify-center gap-1 rounded-md px-2 py-1 text-xl font-black tabular-nums",
        running
          ? "bg-mapachito-white text-mapachito-charcoal"
          : "bg-mapachito-white/15 text-mapachito-white",
        remaining <= LOW_TIME_MS && "outline-mapachito-orange outline-2",
      )}
    >
      <span aria-hidden="true" className="w-3 shrink-0 text-sm">
        {running ? "▶" : clock.paused ? "Ⅱ" : ""}
      </span>
      <span>
        {copy.gameplay.clock.display(Math.floor(seconds / 60), seconds % 60)}
      </span>
      <span className="sr-only">
        {running
          ? copy.gameplay.clock.running
          : clock.paused
            ? copy.gameplay.clock.paused
            : ""}
        {remaining <= LOW_TIME_MS ? ` · ${copy.gameplay.clock.low}` : ""}
      </span>
    </span>
  )
}
