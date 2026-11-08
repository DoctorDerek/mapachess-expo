import type { MatchSessionController } from "@mapachess/gameplay/session-controller"
import type { ProfileRuntime } from "@mapachess/profile/profile-runtime"
import openNativeProfileRuntime from "../profile/openNativeProfileRuntime"
import createNativeSessionController from "./createNativeSessionController"
import type { NativeMatchRuntime } from "./openNativeMatchRuntime"

export type NativeApplicationRuntime = Readonly<{
  profile: ProfileRuntime
  game: () => MatchSessionController<NativeMatchRuntime>
  pause: () => void
  close: () => Promise<void>
}>

export default async function openNativeApplicationRuntime(
  input: Readonly<{
    profile?: Parameters<typeof openNativeProfileRuntime>[0]
    game?: Parameters<typeof createNativeSessionController>[1]
  }> = {},
): Promise<NativeApplicationRuntime> {
  const profile = await openNativeProfileRuntime(input.profile)
  let controller: MatchSessionController<NativeMatchRuntime> | undefined
  let closing: Promise<void> | undefined
  return {
    profile,
    pause: () => {
      const session = controller?.actor.getSnapshot().context.session
      if (session?.actor.getSnapshot().status === "active")
        session.actor.send({ type: "MATCH.CLOCK_PAUSE_REQUESTED" })
    },
    game: () => {
      if (closing !== undefined)
        throw new Error("A closed native application cannot reopen gameplay.")
      controller ??= createNativeSessionController(profile.actor, input.game)
      return controller
    },
    close: () => {
      closing ??= (async () => {
        let sessionFailure: unknown
        try {
          await controller?.close()
        } catch (error: unknown) {
          sessionFailure = error
        }
        try {
          await profile.close()
        } catch (error: unknown) {
          if (sessionFailure !== undefined)
            throw new AggregateError(
              [sessionFailure, error],
              "Native application cleanup did not complete.",
              { cause: error },
            )
          throw error
        }
        if (sessionFailure !== undefined) throw sessionFailure
      })()
      return closing
    },
  }
}
