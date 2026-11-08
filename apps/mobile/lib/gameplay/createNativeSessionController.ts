import type { OpenMatchRuntime } from "@mapachess/gameplay/match-runtime"
import { challengeDifficultyTargets } from "@mapachess/gameplay/opponent-policy"
import createMatchSessionController, {
  type ApplicationActivity,
  type MatchSessionController,
} from "@mapachess/gameplay/session-controller"
import type { MonotonicClock } from "@mapachess/match/match-clock"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import nativeApplicationActivity from "./nativeApplicationActivity"
import openNativeMatchRuntime, {
  type NativeMatchRuntime,
} from "./openNativeMatchRuntime"

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
