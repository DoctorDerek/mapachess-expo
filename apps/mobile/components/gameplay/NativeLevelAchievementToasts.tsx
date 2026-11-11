import { useEffect, useState } from "react"
import { AccessibilityInfo, Platform, View } from "react-native"
import { createActor, type ActorRefFrom } from "xstate"
import type { LevelAchievementId } from "@mapachess/profile/global-xp"
import levelAchievementNoticeMachine, {
  selectLevelAchievementNotice,
} from "@mapachess/profile/level-achievement-notice-machine"
import NativeText from "@/components/presentation/NativeText"
import { useNativeLocale } from "@/components/profile/NativeLocaleProvider"
import useActorSnapshot from "@/lib/useActorSnapshot"

export default function NativeLevelAchievementToasts({
  ids,
  paused,
}: Readonly<{ ids: readonly LevelAchievementId[]; paused: boolean }>) {
  const { copy } = useNativeLocale()
  const [actor, setActor] = useState<ActorRefFrom<
    typeof levelAchievementNoticeMachine
  > | null>(null)
  useEffect(() => {
    const opened = createActor(levelAchievementNoticeMachine, {
      input: { ids: [], paused: true },
    }).start()
    setActor(opened)
    return () => {
      opened.stop()
    }
  }, [])
  useEffect(() => {
    actor?.send({ type: "LEVEL_NOTICE.SOURCE_CHANGED", ids })
  }, [actor, ids])
  useEffect(() => {
    actor?.send({ type: "LEVEL_NOTICE.ACTIVITY_CHANGED", paused })
  }, [actor, paused])
  const snapshot = useActorSnapshot(actor)
  const notice =
    snapshot === null ? null : selectLevelAchievementNotice(snapshot)
  const message =
    notice === null || paused
      ? null
      : copy.gameplay.achievementUnlocked(
          copy.gameplay.levelAchievement(notice.level),
        )
  useEffect(() => {
    if (message !== null && Platform.OS === "ios")
      AccessibilityInfo.announceForAccessibilityWithOptions(message, {
        queue: true,
      })
  }, [message])
  if (message === null) return null
  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-3 bottom-3 z-40 items-end"
    >
      <NativeText
        accessible
        accessibilityLiveRegion="polite"
        className="font-native border-mapachito-charcoal bg-mapachito-violet shadow-mapachess-raised shadow-mapachito-charcoal max-w-96 rounded-lg border-3 px-4 py-3"
      >
        {message}
      </NativeText>
    </View>
  )
}
