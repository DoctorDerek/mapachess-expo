"use client"

import { useAnimate, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import {
  levelFromTotalXp,
  levelProgress,
  xpAtLevel,
} from "@mapachess/profile/global-xp"

const MINIMUM_LEVEL_FILL_SECONDS = 0.9
const MINIMUM_TOTAL_PROGRESS_SECONDS = 3.7

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

    const finalLevel = levelFromTotalXp(afterXp)
    const crossedLevelCount = finalLevel - levelFromTotalXp(beforeXp)
    const hasPartialFinalLevel = afterXp > xpAtLevel(finalLevel)
    const fillSegmentCount = crossedLevelCount + Number(hasPartialFinalLevel)
    const fillDurationSeconds = Math.max(
      MINIMUM_LEVEL_FILL_SECONDS,
      MINIMUM_TOTAL_PROGRESS_SECONDS / fillSegmentCount,
    )
    const level = levelFromTotalXp(displayXp)
    const start = xpAtLevel(level)
    const next = xpAtLevel(level + 1)
    const boundary = Math.min(next, afterXp)
    const bar = fill.current
    const playback = animate(
      bar,
      {
        scaleX: [
          (displayXp - start) / (next - start),
          (boundary - start) / (next - start),
        ],
      },
      { duration: fillDurationSeconds, ease: "easeOut" },
    )
    let active = true
    void playback.then(() => {
      if (!active) return
      if (boundary === next) {
        // Motion's completed transform outlives React's unchanged zero-progress style.
        bar.style.transform = "scaleX(0)"
      }
      setDisplayXp(boundary)
    })

    return () => {
      active = false
      playback.stop()
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
