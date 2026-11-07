import type { TestContext } from "vitest"
import { createActor } from "xstate"
import webMatchSessionMachine from "../lib/gameplay/webMatchSessionMachine"

export function browsingSession(onTestFinished: TestContext["onTestFinished"]) {
  const noMatch = async (): Promise<never> => {
    throw new Error("No engine is available in this browser fixture.")
  }
  const actor = createActor(webMatchSessionMachine, {
    input: {
      activeMatchExists: false,
      operations: {
        canNavigate: () => true,
        openCurrentMatch: noMatch,
        openFreshMatch: noMatch,
        returnToMenu: async () => undefined,
      },
    },
  }).start()
  onTestFinished(() => {
    actor.stop()
  })
  return actor
}
