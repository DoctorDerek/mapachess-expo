"use client"

import { animate, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import levelProgressionSpans, {
  easeOutQuad,
  levelProgressFrame,
  levelProgressSpanFrame,
} from "@mapachess/profile/level-progression"
import pausePresentationWhileHidden from "../../lib/presentation/pausePresentationWhileHidden"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function MatchLevelProgress({
  beforeXp,
  afterXp,
}: Readonly<{ beforeXp: number; afterXp: number }>) {
  const copy = useMapachessCopy()

  const [displayed, setDisplayed] = useState(() => levelProgressFrame(beforeXp))
  const reduceMotion = useReducedMotion() === true
  const final = levelProgressFrame(afterXp)

  useEffect(() => {
    if (reduceMotion) {
      setDisplayed(levelProgressFrame(afterXp))
      return
    }
    let active = true
    let playback: ReturnType<typeof animate> | undefined
    let stopFollowingVisibility: (() => void) | undefined
    setDisplayed(levelProgressFrame(beforeXp))
    const traverse = async (): Promise<void> => {
      for (const span of levelProgressionSpans(beforeXp, afterXp)) {
        if (!active) return
        playback = animate(0, 1, {
          duration: span.durationMs / 1000,
          ease: easeOutQuad,
          onUpdate: (fraction) => {
            if (!active) return
            setDisplayed(levelProgressSpanFrame(span, fraction))
          },
        })
        stopFollowingVisibility = pausePresentationWhileHidden(playback)
        await playback
        stopFollowingVisibility()
        if (!active) return
        setDisplayed(levelProgressFrame(span.toXp))
      }
    }
    void traverse().catch(() => {
      stopFollowingVisibility?.()
      playback?.stop()
      if (active) setDisplayed(levelProgressFrame(afterXp))
    })

    return () => {
      active = false
      stopFollowingVisibility?.()
      playback?.stop()
    }
  }, [afterXp, beforeXp, reduceMotion])

  return (
    <section
      aria-label={copy.gameplay.levelProgress(
        final.level,
        final.current,
        final.required,
      )}
      className="border-mapachito-charcoal bg-mapachito-white grid gap-2 rounded-lg border-3 p-3"
    >
      <div
        aria-hidden="true"
        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
      >
        <span className="font-display text-2xl font-black tabular-nums">
          {copy.gameplay.level(displayed.level)}
        </span>
        <span className="text-sm font-bold tabular-nums">
          {copy.gameplay.xpProgress(displayed.current, displayed.required)}
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
