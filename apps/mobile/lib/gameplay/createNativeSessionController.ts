import { AppState, Platform } from "react-native"
import type { OpenMatchRuntime } from "@mapachess/gameplay/match-runtime"
import { challengeDifficultyTargets } from "@mapachess/gameplay/opponent-policy"
import createMatchSessionController, {
  type ApplicationActivity,
  type MatchSessionController,
} from "@mapachess/gameplay/session-controller"
import type { MonotonicClock } from "@mapachess/match/match-clock"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import openNativeMatchRuntime, {
  type NativeMatchRuntime,
} from "./openNativeMatchRuntime"

function nativeApplicationActivity(): ApplicationActivity {
  let focused = true
  return {
    isActive: () => focused && AppState.currentState === "active",
    subscribe: (listener) => {
      const subscriptions = [AppState.addEventListener("change", listener)]
      if (Platform.OS === "android") {
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
      }
      return () => {
        for (const subscription of subscriptions) subscription.remove()
      }
    },
  }
}

export default function createNativeSessionController(
  profileActor: ProfileActor,
  input: Readonly<{
    openRuntime?: OpenMatchRuntime<NativeMatchRuntime>
    activity?: ApplicationActivity
    monotonicClock?: MonotonicClock
  }> = {},
): MatchSessionController<NativeMatchRuntime> {
  return createMatchSessionController({
    profileActor,
    openRuntime: input.openRuntime ?? openNativeMatchRuntime,
    monotonicClock: input.monotonicClock ?? { now: () => performance.now() },
    challengeDifficultyTargets,
    activity: input.activity ?? nativeApplicationActivity(),
  })
}
