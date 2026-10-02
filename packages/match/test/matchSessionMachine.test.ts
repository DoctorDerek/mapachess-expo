import { describe, expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import createMatchSessionMachine, {
  selectCanHandleMatchSessionBack,
  selectMatchNavigationDestination,
  type MatchSessionIdentity,
  type MatchSessionOperations,
} from "../src/matchSessionMachine.js"

const session = Object.freeze({
  match: Object.freeze({ matchId: "portable-owned-match" }),
  setup: Object.freeze({ mode: "story", variant: "standard" }),
  platformHandle: Symbol("platform-owned-runtime"),
}) satisfies MatchSessionIdentity & Readonly<{ platformHandle: symbol }>

const machine = createMatchSessionMachine<typeof session>()
const operations = (): MatchSessionOperations<typeof session> => ({
  canNavigate: () => true,
  openCurrentMatch: vi.fn(async () => session),
  openFreshMatch: vi.fn(async () => session),
  returnToMenu: vi.fn(async () => undefined),
})

describe("portable match session navigation", () => {
  it("replaces the concluding match menu with rewards instead of reopening it after dismissal", async () => {
    const actor = createActor(machine, {
      input: { activeMatchExists: true, operations: operations() },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("active"))
    actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay: "match-menu" })
    actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay: "rewards" })
    expect(actor.getSnapshot().context.overlays).toEqual(["rewards"])
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().context.overlays).toEqual([])
    actor.stop()
  })

  it("invalidates consumed rewards when the owned result reopens", async () => {
    const actor = createActor(machine, {
      input: { activeMatchExists: true, operations: operations() },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("active"))
    actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay: "rewards" })
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    actor.send({
      type: "MATCH_SESSION.REWARDS_REPLAY_REQUESTED",
      matchId: session.match.matchId,
    })
    actor.send({ type: "MATCH_SESSION.RESULT_REOPENED", matchId: "unowned" })
    expect(actor.getSnapshot().context.rewardsReplaySequence).toBe(1)
    actor.send({
      type: "MATCH_SESSION.RESULT_REOPENED",
      matchId: session.match.matchId,
    })
    expect(actor.getSnapshot().context).toMatchObject({
      overlays: [],
      rewardsReplaySequence: 0,
      resultReopened: true,
      presentedRewardMatchId: null,
      dismissedRewardMatchId: null,
    })
    actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay: "rewards" })
    expect(actor.getSnapshot().context.overlays).toEqual(["rewards"])
    actor.stop()
  })
  it("opens explicit rewards replay without reviving consumed history or invoking lifecycle operations", async () => {
    const ops = operations()
    const actor = createActor(machine, {
      input: { activeMatchExists: true, operations: ops },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("active"))
    actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay: "rewards" })
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    actor.send({
      type: "MATCH_SESSION.REWARDS_REPLAY_REQUESTED",
      matchId: "stale-match",
    })
    expect(actor.getSnapshot().context.rewardsReplaySequence).toBe(0)
    actor.send({
      type: "MATCH_SESSION.REWARDS_REPLAY_REQUESTED",
      matchId: session.match.matchId,
    })
    expect(actor.getSnapshot().context.overlays).toEqual(["rewards"])
    expect(actor.getSnapshot().context.rewardsReplaySequence).toBe(1)
    actor.send({
      type: "MATCH_SESSION.REWARDS_REPLAY_REQUESTED",
      matchId: session.match.matchId,
    })
    expect(actor.getSnapshot().context.rewardsReplaySequence).toBe(1)
    const replayDestination = selectMatchNavigationDestination(
      actor.getSnapshot(),
    )
    if (replayDestination === null)
      throw new Error("Missing replay destination")
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    actor.send({
      type: "MATCH_SESSION.NAVIGATION_RESTORED",
      destination: replayDestination,
    })
    expect(actor.getSnapshot().context.overlays).toEqual([])
    expect(actor.getSnapshot().context.rewardsReplaySequence).toBe(1)
    actor.send({
      type: "MATCH_SESSION.REWARDS_REPLAY_REQUESTED",
      matchId: session.match.matchId,
    })
    expect(actor.getSnapshot().context.rewardsReplaySequence).toBe(2)
    expect(ops.openCurrentMatch).toHaveBeenCalledTimes(1)
    expect(ops.openFreshMatch).not.toHaveBeenCalled()
    expect(ops.returnToMenu).not.toHaveBeenCalled()
    actor.stop()
  })
  it.each(["system-back", "stale-forward"] as const)(
    "settles a restart safely after %s",
    async (navigation) => {
      type Session = MatchSessionIdentity & Readonly<{ platformHandle: symbol }>
      const gate = Promise.withResolvers<Session>()
      const replacement: Session = {
        ...session,
        match: { matchId: "restarted-match" },
      }
      const actor = createActor(createMatchSessionMachine<Session>(), {
        input: {
          activeMatchExists: false,
          operations: {
            canNavigate: () => true,
            openCurrentMatch: async () => session,
            openFreshMatch: vi
              .fn<MatchSessionOperations<Session>["openFreshMatch"]>()
              .mockResolvedValueOnce(session)
              .mockImplementationOnce(() => gate.promise),
            returnToMenu: async () => undefined,
          },
        },
      }).start()
      actor.send({
        type: "MATCH_SESSION.SETUP_REQUESTED",
        setup: session.setup,
      })
      actor.send({
        type: "MATCH_SESSION.MATCH_REQUESTED",
        setup: session.setup,
      })
      await waitFor(actor, (snapshot) => snapshot.matches("active"))
      const destination = selectMatchNavigationDestination(actor.getSnapshot())
      if (destination === null) throw new Error("Expected match destination")
      actor.send({ type: "MATCH_SESSION.RESTART_REQUESTED" })
      if (navigation === "system-back")
        actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
      else
        actor.send({ type: "MATCH_SESSION.NAVIGATION_RESTORED", destination })
      gate.resolve(replacement)
      await waitFor(actor, (snapshot) =>
        snapshot.matches({
          menu: navigation === "system-back" ? "setup" : "choosingMode",
        }),
      )
      expect(actor.getSnapshot().context.session).toBe(replacement)
      actor.stop()
    },
  )

  it.each(["menu", "setup"] as const)(
    "settles opening at the latest %s destination without cancelling it",
    async (screen) => {
      const gate = Promise.withResolvers<typeof session>()
      let signal: AbortSignal | null = null
      const ops = {
        ...operations(),
        openFreshMatch: vi.fn(
          (_previous, _setup, openingSignal: AbortSignal) => {
            signal = openingSignal
            return gate.promise
          },
        ),
      } satisfies MatchSessionOperations<typeof session>
      const actor = createActor(machine, {
        input: { activeMatchExists: false, operations: ops },
      }).start()
      actor.send({
        type: "MATCH_SESSION.SETUP_REQUESTED",
        setup: session.setup,
      })
      const setup = selectMatchNavigationDestination(actor.getSnapshot())
      if (setup === null) throw new Error("Expected setup destination")
      actor.send({
        type: "MATCH_SESSION.MATCH_REQUESTED",
        setup: session.setup,
      })
      actor.send({
        type: "MATCH_SESSION.NAVIGATION_RESTORED",
        destination: { ...setup, screen: "menu" },
      })
      if (screen === "setup")
        actor.send({
          type: "MATCH_SESSION.NAVIGATION_RESTORED",
          destination: setup,
        })
      expect(actor.getSnapshot().matches("openingFreshMatch")).toBe(true)
      expect(signal).toHaveProperty("aborted", false)
      gate.resolve(session)
      await waitFor(actor, (snapshot) =>
        snapshot.matches({
          menu: screen === "setup" ? "setup" : "choosingMode",
        }),
      )
      expect(actor.getSnapshot().context.session).toBe(session)
      expect(actor.getSnapshot().context.deferredNavigation).toBeNull()
      expect(ops.openFreshMatch).toHaveBeenCalledOnce()
      expect(ops.returnToMenu).not.toHaveBeenCalled()
      actor.stop()
    },
  )

  it.each([1, 2])(
    "retains %i system Back requests during opening in the portable owner",
    async (count) => {
      const gate = Promise.withResolvers<typeof session>()
      const actor = createActor(machine, {
        input: {
          activeMatchExists: false,
          operations: { ...operations(), openFreshMatch: () => gate.promise },
        },
      }).start()
      actor.send({
        type: "MATCH_SESSION.SETUP_REQUESTED",
        setup: session.setup,
      })
      actor.send({
        type: "MATCH_SESSION.MATCH_REQUESTED",
        setup: session.setup,
      })
      for (let index = 0; index < count; index++)
        actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
      expect(actor.getSnapshot().matches("openingFreshMatch")).toBe(true)
      gate.resolve(session)
      await waitFor(actor, (snapshot) =>
        snapshot.matches({ menu: count === 1 ? "setup" : "choosingMode" }),
      )
      expect(actor.getSnapshot().context.session).toBe(session)
      actor.stop()
    },
  )

  it("retains navigation intent through opening failure and applies it only after retry succeeds", async () => {
    const gate = Promise.withResolvers<typeof session>()
    const openCurrentMatch = vi
      .fn<MatchSessionOperations<typeof session>["openCurrentMatch"]>()
      .mockImplementationOnce(() => gate.promise)
      .mockResolvedValueOnce(session)
    const actor = createActor(machine, {
      input: {
        activeMatchExists: true,
        operations: { ...operations(), openCurrentMatch },
      },
    }).start()
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    gate.reject(new Error("Unavailable runtime"))
    await waitFor(actor, (snapshot) => snapshot.matches("failed"))
    expect(actor.getSnapshot().context.deferredNavigation?.screen).toBe("menu")
    actor.send({ type: "MATCH_SESSION.RETRY_REQUESTED" })
    await waitFor(actor, (snapshot) =>
      snapshot.matches({ menu: "choosingMode" }),
    )
    expect(actor.getSnapshot().context.session).toBe(session)
    expect(openCurrentMatch).toHaveBeenCalledTimes(2)
    actor.stop()
  })

  it("rejects old Forward destinations after an explicit return completes", async () => {
    const gate = Promise.withResolvers<void>()
    const actor = createActor(machine, {
      input: {
        activeMatchExists: true,
        operations: { ...operations(), returnToMenu: () => gate.promise },
      },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("active"))
    const destination = selectMatchNavigationDestination(actor.getSnapshot())
    if (destination === null) throw new Error("Expected match destination")
    actor.send({ type: "MATCH_SESSION.RETURN_TO_MENU_REQUESTED" })
    actor.send({ type: "MATCH_SESSION.NAVIGATION_RESTORED", destination })
    expect(actor.getSnapshot().matches("returningToMenu")).toBe(true)
    gate.resolve()
    await waitFor(actor, (snapshot) =>
      snapshot.matches({ menu: "choosingMode" }),
    )
    expect(actor.getSnapshot().context.session).toBeNull()
    expect(actor.getSnapshot().context.deferredNavigation).toBeNull()
    actor.stop()
  })

  it("restores the pre-match setup and retains the session through Back and Forward", async () => {
    const ops = operations()
    const actor = createActor(machine, {
      input: { activeMatchExists: false, operations: ops },
    }).start()
    actor.send({ type: "MATCH_SESSION.SETUP_REQUESTED", setup: session.setup })
    const predecessor = selectMatchNavigationDestination(actor.getSnapshot())
    if (predecessor === null) throw new Error("Expected setup destination")
    expect(predecessor.matchId).toBeNull()
    actor.send({ type: "MATCH_SESSION.MATCH_REQUESTED", setup: session.setup })
    await waitFor(actor, (snapshot) => snapshot.matches("active"))
    const match = selectMatchNavigationDestination(actor.getSnapshot())
    if (match === null) throw new Error("Expected match destination")
    actor.send({
      type: "MATCH_SESSION.NAVIGATION_RESTORED",
      destination: predecessor,
    })
    expect(actor.getSnapshot().matches({ menu: "setup" })).toBe(true)
    expect(actor.getSnapshot().context.session).toBe(session)
    actor.send({
      type: "MATCH_SESSION.NAVIGATION_RESTORED",
      destination: match,
    })
    expect(actor.getSnapshot().matches("active")).toBe(true)
    actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay: "match-menu" })
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().matches("active")).toBe(true)
    expect(actor.getSnapshot().context.overlays).toEqual([])
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().matches({ menu: "setup" })).toBe(true)
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(true)
    actor.send({ type: "MATCH_SESSION.RESUME_REQUESTED" })
    expect(actor.getSnapshot().context.session).toBe(session)
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(true)
    expect(ops.openFreshMatch).toHaveBeenCalledOnce()
    expect(ops.openCurrentMatch).not.toHaveBeenCalled()
    expect(ops.returnToMenu).not.toHaveBeenCalled()
    actor.stop()
  })

  it("admits only the latest match's setup predecessor and invalidates it on profile replacement", async () => {
    type Session = MatchSessionIdentity & Readonly<{ platformHandle: symbol }>
    const replacement: Session = {
      ...session,
      match: { matchId: "replacement-match" },
    }
    const actor = createActor(createMatchSessionMachine<Session>(), {
      input: {
        activeMatchExists: false,
        operations: {
          canNavigate: () => true,
          openCurrentMatch: async () => session,
          returnToMenu: async () => undefined,
          openFreshMatch: vi
            .fn<MatchSessionOperations<Session>["openFreshMatch"]>()
            .mockResolvedValueOnce(session)
            .mockResolvedValueOnce(replacement),
        },
      },
    }).start()
    actor.send({ type: "MATCH_SESSION.SETUP_REQUESTED", setup: session.setup })
    const original = selectMatchNavigationDestination(actor.getSnapshot())
    if (original === null) throw new Error("Expected original setup")
    actor.send({ type: "MATCH_SESSION.MATCH_REQUESTED", setup: session.setup })
    await waitFor(actor, (snapshot) => snapshot.matches("active"))
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    const latest = selectMatchNavigationDestination(actor.getSnapshot())
    if (latest === null) throw new Error("Expected replacement setup")
    actor.send({ type: "MATCH_SESSION.MATCH_REQUESTED", setup: session.setup })
    await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches("active") && snapshot.context.session === replacement,
    )
    actor.send({
      type: "MATCH_SESSION.NAVIGATION_RESTORED",
      destination: original,
    })
    expect(actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(true)
    actor.send({
      type: "MATCH_SESSION.NAVIGATION_RESTORED",
      destination: latest,
    })
    expect(actor.getSnapshot().matches({ menu: "setup" })).toBe(true)
    expect(actor.getSnapshot().context.session).toBe(replacement)
    actor.send({
      type: "MATCH_SESSION.PROFILE_REPLACED",
      activeMatchExists: false,
    })
    actor.send({
      type: "MATCH_SESSION.NAVIGATION_RESTORED",
      destination: latest,
    })
    expect(actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(true)
    expect(actor.getSnapshot().context.matchSetupPredecessor).toBeNull()
    expect(actor.getSnapshot().context.session).toBeNull()
    actor.stop()
  })

  it("protects recovery from both system Back and restored destinations through the injected canonical policy", async () => {
    let navigationAllowed = true
    const actor = createActor(machine, {
      input: {
        activeMatchExists: true,
        operations: { ...operations(), canNavigate: () => navigationAllowed },
      },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("active"))
    const destination = selectMatchNavigationDestination(actor.getSnapshot())
    if (destination === null) throw new Error("Expected owned destination")
    actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay: "settings" })
    navigationAllowed = false
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    actor.send({
      type: "MATCH_SESSION.NAVIGATION_RESTORED",
      destination: { ...destination, screen: "menu" },
    })
    expect(actor.getSnapshot().matches("active")).toBe(true)
    expect(actor.getSnapshot().context.overlays).toEqual(["settings"])
    expect(selectCanHandleMatchSessionBack(actor.getSnapshot())).toBe(true)
    navigationAllowed = true
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().context.overlays).toEqual([])
    expect(actor.getSnapshot().context.session).toBe(session)
    actor.stop()
  })
  it("closes surfaces before leaving play, retains the platform session, and permits root departure", async () => {
    const ops = operations()
    const actor = createActor(machine, {
      input: { activeMatchExists: true, operations: ops },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("active"))
    for (const overlay of [
      "match-menu",
      "settings",
      "classifications",
    ] as const)
      actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay })
    expect(selectCanHandleMatchSessionBack(actor.getSnapshot())).toBe(true)
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().context.overlays).toEqual([
      "match-menu",
      "settings",
    ])
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().matches("active")).toBe(true)
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(true)
    expect(actor.getSnapshot().context.session).toBe(session)
    expect(actor.getSnapshot().context.session?.platformHandle).toBe(
      session.platformHandle,
    )
    expect(selectCanHandleMatchSessionBack(actor.getSnapshot())).toBe(false)
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(true)
    actor.send({ type: "MATCH_SESSION.RESUME_REQUESTED" })
    expect(actor.getSnapshot().context.session).toBe(session)
    expect(actor.getSnapshot().matches("active")).toBe(true)
    expect(ops.openCurrentMatch).toHaveBeenCalledOnce()
    expect(ops.openFreshMatch).not.toHaveBeenCalled()
    expect(ops.returnToMenu).not.toHaveBeenCalled()
    actor.stop()
  })

  it("returns from setup without losing choices or invoking a match operation", () => {
    const ops = operations()
    const actor = createActor(machine, {
      input: { activeMatchExists: false, operations: ops },
    }).start()
    const setup = { mode: "story", variant: "chess960" } as const
    actor.send({ type: "MATCH_SESSION.SETUP_REQUESTED", setup })
    actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay: "setup-hints" })
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().matches({ menu: "setup" })).toBe(true)
    expect(actor.getSnapshot().context.overlays).toEqual([])
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(true)
    expect(actor.getSnapshot().context.requestedSetup).toBe(setup)
    expect(selectCanHandleMatchSessionBack(actor.getSnapshot())).toBe(false)
    expect(ops.openCurrentMatch).not.toHaveBeenCalled()
    expect(ops.openFreshMatch).not.toHaveBeenCalled()
    expect(ops.returnToMenu).not.toHaveBeenCalled()
    actor.stop()
  })

  it("consumes dismissed rewards and rejects stale restoration without browser APIs", async () => {
    const actor = createActor(machine, {
      input: { activeMatchExists: true, operations: operations() },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("active"))
    actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay: "rewards" })
    const destination = selectMatchNavigationDestination(actor.getSnapshot())
    if (destination === null)
      throw new Error("Expected owned match destination")
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    actor.send({ type: "MATCH_SESSION.NAVIGATION_RESTORED", destination })
    expect(actor.getSnapshot().context.overlays).toEqual([])
    expect(actor.getSnapshot().context.dismissedRewardMatchId).toBe(
      session.match.matchId,
    )
    actor.send({
      type: "MATCH_SESSION.NAVIGATION_RESTORED",
      destination: {
        ...destination,
        matchId: "replaced",
        overlays: ["match-menu"],
      },
    })
    expect(actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(true)
    expect(actor.getSnapshot().context.overlays).toEqual([])
    expect(actor.getSnapshot().context.session).toBe(session)
    actor.stop()
  })

  it("does not let system Back bypass an opening or failed lifecycle operation", async () => {
    const gate = Promise.withResolvers<typeof session>()
    const actor = createActor(machine, {
      input: {
        activeMatchExists: true,
        operations: { ...operations(), openCurrentMatch: () => gate.promise },
      },
    }).start()
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().matches("openingCurrentMatch")).toBe(true)
    expect(selectCanHandleMatchSessionBack(actor.getSnapshot())).toBe(true)
    gate.reject(new Error("Unavailable platform runtime"))
    await waitFor(actor, (snapshot) => snapshot.matches("failed"))
    actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(actor.getSnapshot().matches("failed")).toBe(true)
    expect(selectCanHandleMatchSessionBack(actor.getSnapshot())).toBe(true)
    actor.stop()
  })
})
