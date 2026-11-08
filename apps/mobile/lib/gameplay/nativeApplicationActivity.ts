import { AppState, Platform } from "react-native"
import type { ApplicationActivity } from "@mapachess/gameplay/session-controller"

export default function nativeApplicationActivity(): ApplicationActivity {
  let focused = true
  return {
    isActive: () => focused && AppState.currentState === "active",
    subscribe: (listener) => {
      const subscriptions = [AppState.addEventListener("change", listener)]
      if (Platform.OS === "android")
        subscriptions.push(
          AppState.addEventListener("blur", () => {
            focused = false
            listener()
          }),
          AppState.addEventListener("focus", () => {
            focused = true
            listener()
          }),
        )
      return () => {
        for (const subscription of subscriptions) subscription.remove()
      }
    },
  }
}
