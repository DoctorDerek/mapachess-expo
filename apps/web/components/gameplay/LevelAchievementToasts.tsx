"use client"

import { useActorRef, useSelector } from "@xstate/react"
import { useEffect, useState } from "react"
import type { LevelAchievementId } from "@mapachess/profile/global-xp"
import levelAchievementNoticeMachine, {
  selectLevelAchievementNotice,
} from "@mapachess/profile/level-achievement-notice-machine"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function LevelAchievementToasts({
  ids,
  paused,
}: Readonly<{ ids: readonly LevelAchievementId[]; paused: boolean }>) {
  const copy = useMapachessCopy()

  const [hidden, setHidden] = useState(false)
  const waiting = paused || hidden
  const actor = useActorRef(levelAchievementNoticeMachine, {
    input: { ids, paused: waiting },
  })
  const achievement = useSelector(actor, selectLevelAchievementNotice)

  useEffect(() => {
    const syncVisibility = (): void => setHidden(document.hidden)
    syncVisibility()
    document.addEventListener("visibilitychange", syncVisibility)
    return () =>
      document.removeEventListener("visibilitychange", syncVisibility)
  }, [])

  useEffect(() => {
    actor.send({ type: "LEVEL_NOTICE.SOURCE_CHANGED", ids })
  }, [actor, ids])
  useEffect(() => {
    actor.send({ type: "LEVEL_NOTICE.ACTIVITY_CHANGED", paused: waiting })
  }, [actor, waiting])

  if (achievement === null || waiting) return null

  return (
    <p
      aria-live="polite"
      className="border-mapachito-charcoal bg-mapachito-violet text-mapachito-white fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 max-w-[min(24rem,calc(100vw-1.5rem))] rounded-lg border-3 px-4 py-3 text-base font-bold shadow-[0.375rem_0.375rem_0_#1e1e1e]"
      role="status"
    >
      {copy.gameplay.achievementUnlocked(
        copy.gameplay.levelAchievement(achievement.level),
      )}
    </p>
  )
}
