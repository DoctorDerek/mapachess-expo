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
