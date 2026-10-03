"use client"

import { animate, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { levelProgress, xpAtLevel } from "@mapachess/profile/global-xp"
import levelProgressionSpans, {
  easeOutQuad,
} from "@mapachess/profile/level-progression"
import pausePresentationWhileHidden from "../../lib/presentation/pausePresentationWhileHidden"

const progressFrame = (xp: number) => {
  const progress = levelProgress(xp)
  return { ...progress, fraction: progress.current / progress.required }
}

export default function MatchLevelProgress({
  beforeXp,
  afterXp,
}: Readonly<{ beforeXp: number; afterXp: number }>) {
  const [displayed, setDisplayed] = useState(() => progressFrame(beforeXp))
  const reduceMotion = useReducedMotion() === true
  const final = levelProgress(afterXp)

  useEffect(() => {
    if (reduceMotion) {
      setDisplayed(progressFrame(afterXp))
      return
    }
    let active = true
    let playback: ReturnType<typeof animate> | undefined
    let stopFollowingVisibility: (() => void) | undefined
    setDisplayed(progressFrame(beforeXp))
    const traverse = async (): Promise<void> => {
      for (const span of levelProgressionSpans(beforeXp, afterXp)) {
        if (!active) return
        const start = xpAtLevel(span.level)
        const required = xpAtLevel(span.level + 1) - start
        playback = animate(0, 1, {
          duration: span.durationMs / 1000,
          ease: easeOutQuad,
          onUpdate: (fraction) => {
            if (!active) return
            const xp = span.fromXp + (span.toXp - span.fromXp) * fraction
            setDisplayed({
              level: span.level,
              current: Math.floor(xp) - start,
              required,
              fraction:
                span.fromFraction +
                (span.toFraction - span.fromFraction) * fraction,
            })
          },
        })
        stopFollowingVisibility = pausePresentationWhileHidden(playback)
        await playback
        stopFollowingVisibility()
        if (!active) return
        setDisplayed(progressFrame(span.toXp))
      }
    }
    void traverse()

    return () => {
      active = false
      stopFollowingVisibility?.()
      playback?.stop()
    }
  }, [afterXp, beforeXp, reduceMotion])

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
          className="bg-mapachito-green block h-full w-full origin-left"
          style={{
            transform: `scaleX(${String(displayed.fraction)})`,
          }}
        />
      </div>
    </section>
  )
}
