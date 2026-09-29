"use client"

import { useEffect, useState } from "react"
import {
  LEVEL_ACHIEVEMENTS,
  type LevelAchievementId,
} from "@mapachess/profile/global-xp"

const ACHIEVEMENT_TOAST_DURATION_MS = 5_000

export default function LevelAchievementToasts({
  ids,
  paused,
}: Readonly<{ ids: readonly LevelAchievementId[]; paused: boolean }>) {
  const [index, setIndex] = useState(0)
  const [hidden, setHidden] = useState(false)
  const currentId = ids[index]
  const waiting = paused || hidden

  useEffect(() => {
    const syncVisibility = (): void => setHidden(document.hidden)
    syncVisibility()
    document.addEventListener("visibilitychange", syncVisibility)
    return () =>
      document.removeEventListener("visibilitychange", syncVisibility)
  }, [])

  useEffect(() => {
    if (currentId === undefined || waiting) return
    const timeout = window.setTimeout(
      () => setIndex((previous) => previous + 1),
      ACHIEVEMENT_TOAST_DURATION_MS,
    )
    return () => window.clearTimeout(timeout)
  }, [currentId, waiting])

  if (currentId === undefined || waiting) return null
  const achievement = LEVEL_ACHIEVEMENTS.find(({ id }) => id === currentId)
  if (achievement === undefined) {
    throw new Error("An unknown Level achievement cannot be presented.")
  }

  return (
    <p
      aria-live="polite"
      className="border-mapachito-charcoal bg-mapachito-violet text-mapachito-white fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 max-w-[min(24rem,calc(100vw-1.5rem))] rounded-lg border-3 px-4 py-3 text-base font-bold shadow-[0.375rem_0.375rem_0_#1e1e1e]"
      role="status"
    >
      Achievement unlocked · {achievement.title}
    </p>
  )
}
