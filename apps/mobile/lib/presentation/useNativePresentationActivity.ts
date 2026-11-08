import { useEffect, useState, useSyncExternalStore } from "react"
import { AccessibilityInfo } from "react-native"
import nativeApplicationActivity from "../gameplay/nativeApplicationActivity"

export default function useNativePresentationActivity() {
  const [activity] = useState(nativeApplicationActivity)
  const active = useSyncExternalStore(
    activity.subscribe,
    activity.isActive,
    () => false,
  )
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null)
  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (mounted) setReducedMotion(value)
      },
      () => {
        if (mounted) setReducedMotion(true)
      },
    )
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    )
    return () => {
      mounted = false
      motion.remove()
    }
  }, [])
  return {
    active: active && reducedMotion !== null,
    reducedMotion: reducedMotion ?? true,
  }
}
