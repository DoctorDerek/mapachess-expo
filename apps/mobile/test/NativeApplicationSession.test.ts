import { describe, expect, it, jest } from "@jest/globals"
import { waitFor } from "@testing-library/react-native"
import type { OpenMatchRuntime } from "@mapachess/gameplay/match-runtime"
import { selectMatchTimeline } from "@mapachess/match/match-machine"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import createNativeStockfishSession from "@mapachess/stockfish-native/open-session"
import createNativeSessionController from "@/lib/gameplay/createNativeSessionController"
import openNativeMatchRuntime, {
  type NativeMatchRuntime,
} from "@/lib/gameplay/openNativeMatchRuntime"
import openNativeProfileRuntime from "@/lib/profile/openNativeProfileRuntime"
import cryptography from "./nativeCryptographyFixture"
import NativeEngineFixture from "./nativeEngineFixture"
import InMemoryAsyncStorage from "./nativeStorageFixture"

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => {
    const { createHash } =
      jest.requireActual<typeof import("node:crypto")>("node:crypto")
    return createHash("sha256").update(value).digest("hex")
  }),
  digest: jest.fn(),
  getRandomValues: jest.fn(),
}))

describe("native application session ownership", () => {
  it("persists and resumes the same accepted match across native runtime disposal", async () => {
    const storage = new InMemoryAsyncStorage()
    const bridge = new NativeEngineFixture()
    const openRuntime: OpenMatchRuntime<NativeMatchRuntime> = (input) =>
      openNativeMatchRuntime({
        ...input,
        cryptography,
        openSession: (configuration) =>
          createNativeStockfishSession(configuration, bridge),
      })
    const profile = await openNativeProfileRuntime({ storage })
    await waitFor(() =>
      expect(profile.actor.getSnapshot().matches("ready")).toBe(true),
    )
    profile.actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "no-auto-hints",
    })
    await waitFor(() =>
      expect(profile.actor.getSnapshot().matches("ready")).toBe(true),
    )
    const removeActivity = jest.fn<() => void>()
    const controller = createNativeSessionController(profile.actor, {
      openRuntime,
      activity: { isActive: () => true, subscribe: () => removeActivity },
      monotonicClock: { now: () => 1234 },
    })
    const setup = { mode: "story", variant: "standard" } as const
    controller.actor.send({ type: "MATCH_SESSION.SETUP_REQUESTED", setup })
    expect(controller.actor.getSnapshot().matches({ menu: "setup" })).toBe(true)
    controller.actor.send({ type: "MATCH_SESSION.MATCH_REQUESTED", setup })
    await waitFor(() =>
      expect(controller.actor.getSnapshot().matches("active")).toBe(true),
    )
    const first = controller.actor.getSnapshot().context.session
    if (first === null) throw new Error("The native match must be accepted.")
    const matchId = first.match.matchId
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch
          ?.matchId,
      ).toBe(matchId),
    )
    const cursor = selectMatchTimeline(first.actor.getSnapshot()).cursor
    await controller.close()
    await profile.close()
    expect(removeActivity).toHaveBeenCalledTimes(1)
    expect(bridge.closedSessions).toHaveLength(3)

    const resumedProfile = await openNativeProfileRuntime({ storage })
    await waitFor(() =>
      expect(resumedProfile.actor.getSnapshot().matches("ready")).toBe(true),
    )
    const resumedController = createNativeSessionController(
      resumedProfile.actor,
      {
        openRuntime,
        activity: { isActive: () => true, subscribe: () => removeActivity },
        monotonicClock: { now: () => 1234 },
      },
    )
    try {
      resumedController.actor.send({ type: "MATCH_SESSION.RESUME_REQUESTED" })
      await waitFor(() =>
        expect(resumedController.actor.getSnapshot().matches("active")).toBe(
          true,
        ),
      )
      const resumed = resumedController.actor.getSnapshot().context.session
      expect(resumed?.match.matchId).toBe(matchId)
      if (resumed === null) throw new Error("The native match must resume.")
      expect(selectMatchTimeline(resumed.actor.getSnapshot()).cursor).toBe(
        cursor,
      )
      expect(
        selectCurrentPlayerData(resumedProfile.actor.getSnapshot())?.ratings,
      ).toEqual(selectCurrentPlayerData(profile.actor.getSnapshot())?.ratings)
    } finally {
      await resumedController.close()
      await resumedProfile.close()
    }
    expect(bridge.allocated).toHaveLength(6)
    expect(new Set(bridge.closedSessions)).toEqual(new Set(bridge.allocated))
  })

  it("keeps Back stepwise while preserving the active native match", async () => {
    const storage = new InMemoryAsyncStorage()
    const profile = await openNativeProfileRuntime({ storage })
    await waitFor(() =>
      expect(profile.actor.getSnapshot().matches("ready")).toBe(true),
    )
    const bridge = new NativeEngineFixture()
    const controller = createNativeSessionController(profile.actor, {
      openRuntime: (input) =>
        openNativeMatchRuntime({
          ...input,
          cryptography,
          openSession: (configuration) =>
            createNativeStockfishSession(configuration, bridge),
        }),
      activity: {
        isActive: () => true,
        subscribe: () => jest.fn<() => void>(),
      },
    })
    try {
      const setup = { mode: "story", variant: "standard" } as const
      controller.actor.send({ type: "MATCH_SESSION.SETUP_REQUESTED", setup })
      controller.actor.send({ type: "MATCH_SESSION.MATCH_REQUESTED", setup })
      await waitFor(() =>
        expect(controller.actor.getSnapshot().matches("active")).toBe(true),
      )
      const matchId =
        controller.actor.getSnapshot().context.session?.match.matchId
      controller.actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
      expect(controller.actor.getSnapshot().matches({ menu: "setup" })).toBe(
        true,
      )
      controller.actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
      expect(
        controller.actor.getSnapshot().matches({ menu: "choosingMode" }),
      ).toBe(true)
      expect(
        selectCurrentPlayerData(profile.actor.getSnapshot())?.activeMatch
          ?.matchId,
      ).toBe(matchId)
    } finally {
      await controller.close()
      await profile.close()
    }
  })
})
