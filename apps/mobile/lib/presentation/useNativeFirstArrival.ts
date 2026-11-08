import {
  lazy,
  useCallback,
  useEffect,
  useState,
  type ComponentType,
} from "react"
import { AppState } from "react-native"
import useNativePresentationActivity from "./useNativePresentationActivity"

export const DeferredNativeArrivalAnimation = lazy<
  ComponentType<Readonly<{ onUnavailable: () => void }>>
>(() =>
  import("@/components/profile/NativeArrivalAnimation").catch(() => ({
    default: () => null,
  })),
)

export default function useNativeFirstArrival(painted: boolean) {
  const activity = useNativePresentationActivity()
  const [ready, setReady] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const cancel = useCallback(() => setCancelled(true), [])
  useEffect(() => {
    if (!painted || cancelled || !activity.active || activity.reducedMotion)
      return
    let disposed = false
    const start = (): void => {
      if (!disposed) setReady(true)
    }
    const idle = requestIdleCallback(start, { timeout: 2000 })
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") cancel()
    })
    return () => {
      disposed = true
      cancelIdleCallback(idle)
      subscription.remove()
    }
  }, [painted, cancelled, activity.active, activity.reducedMotion, cancel])
  return {
    visible: ready && !cancelled && activity.active && !activity.reducedMotion,
    cancel,
  }
}
