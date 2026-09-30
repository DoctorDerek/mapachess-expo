"use client"

import { useAnimate, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import {
  levelFromTotalXp,
  levelProgress,
  xpAtLevel,
} from "@mapachess/profile/global-xp"

const LEVEL_FILL_DURATION_SECONDS = 0.36
const MINIMUM_INTERMEDIATE_LEVEL_PRESENTATION_MS = 900
const INTERMEDIATE_LEVEL_HOLD_MS =
  MINIMUM_INTERMEDIATE_LEVEL_PRESENTATION_MS -
  LEVEL_FILL_DURATION_SECONDS * 1000

export default function MatchLevelProgress({
  beforeXp,
  afterXp,
}: Readonly<{ beforeXp: number; afterXp: number }>) {
  const [displayXp, setDisplayXp] = useState(beforeXp)
  const [fill, animate] = useAnimate<HTMLSpanElement>()
  const reduceMotion = useReducedMotion() === true
  const displayed = levelProgress(displayXp)
  const final = levelProgress(afterXp)

  useEffect(() => {
    if (reduceMotion) {
      setDisplayXp(afterXp)
      return
    }
    if (displayXp >= afterXp || fill.current === null) return

    const level = levelFromTotalXp(displayXp)
    const start = xpAtLevel(level)
    const next = xpAtLevel(level + 1)
    const boundary = Math.min(next, afterXp)
    let active = true
    let stopPlayback: (() => void) | undefined
    const startFill = () => {
      if (!active || fill.current === null) return
      const playback = animate(
        fill.current,
        {
          scaleX: [
            (displayXp - start) / (next - start),
            (boundary - start) / (next - start),
          ],
        },
        { duration: LEVEL_FILL_DURATION_SECONDS, ease: "easeOut" },
      )
      stopPlayback = () => playback.stop()
      void playback.then(() => {
        if (active) setDisplayXp(boundary)
      })
    }
    const holdIntermediateLevel = displayXp > beforeXp
    const holdTimer = holdIntermediateLevel
      ? setTimeout(startFill, INTERMEDIATE_LEVEL_HOLD_MS)
      : undefined
    if (!holdIntermediateLevel) startFill()

    return () => {
      active = false
      if (holdTimer !== undefined) clearTimeout(holdTimer)
      stopPlayback?.()
    }
  }, [afterXp, animate, beforeXp, displayXp, fill, reduceMotion])

  return (
    <section
      aria-label={`Level ${String(final.level)}. ${String(final.current)} of ${String(final.required)} XP toward the next Level.`}
      className="border-mapachito-charcoal bg-mapachito-white grid gap-2 rounded-lg border-3 p-3"
    >
      <div
        aria-hidden="true"
        className="flex items-baseline justify-between gap-3"
      >
        <span className="font-display text-2xl font-black tabular-nums">
          Level {displayed.level}
        </span>
        <span className="text-sm font-bold tabular-nums">
          {displayed.current} / {displayed.required} XP
        </span>
      </div>
      <div
        aria-hidden="true"
        className="border-mapachito-charcoal bg-mapachito-charcoal/15 h-3 overflow-hidden rounded-full border-2"
      >
        <span
          ref={fill}
          className="bg-mapachito-green block h-full w-full origin-left"
          style={{
            transform: `scaleX(${String(displayed.current / displayed.required)})`,
          }}
        />
      </div>
    </section>
  )
}
