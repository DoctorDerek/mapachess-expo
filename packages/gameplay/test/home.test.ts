import { createHash } from "node:crypto"
import { describe, expect, it, vi, type TestContext } from "vitest"
import { createActor, waitFor } from "xstate"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import createMatchSessionMachine from "@mapachess/match/match-session-machine"
import {
  MATCH_MODE_CHOICES,
  type MatchSetup,
} from "@mapachess/match/match-setup"
import { TIME_CONTROL_PRESETS } from "@mapachess/match/time-control"
import SerializedPlayerDataStore, {
  durableStoreSnapshotsEqual,
  EMPTY_DURABLE_STORE_SNAPSHOT,
  type DurableStoreAdapter,
  type DurableStoreSnapshot,
} from "@mapachess/profile/durable-store"
import createInitialPlayerData, {
  type MapachessPlayerData,
} from "@mapachess/profile/player-data"
import { decodeMapachessPortableBackup } from "@mapachess/profile/portable-backup"
import profileMachine, {
  selectCanNavigateProfile,
  selectCurrentPlayerData,
} from "@mapachess/profile/profile-machine"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import { buildFreshMatch } from "../src/durableMatch.js"
import createHomeCommands, {
  profileAllowsMatchOpening,
  selectHome,
} from "../src/home.js"
import { createMatchId, selectStoryPlayerColor } from "../src/matchIdentity.js"

const sha256 = async (text: string) =>
  createHash("sha256").update(text).digest("hex")
const positionId = parseChess960PositionId(37)
if (!positionId.ok)
  throw new Error("The Home fixture requires a valid position.")
const generatedPosition = positionId.positionId

function retainedMatch() {
  const matchSeed = parseDeterministicRandomSeed(
    "00000001000000020000000300000004",
  )
  const startingPosition = {
    variant: "standard",
    chess960PositionId: null,
  } as const
  return buildFreshMatch({
    autoHintMode: "no-auto-hints",
    playerEloAtStart: 100,
    timeControl: TIME_CONTROL_PRESETS[1].control,
    runtime: {
      matchId: createMatchId(matchSeed, startingPosition),
      matchSeed,
      startingPosition,
      playerColor: selectStoryPlayerColor(matchSeed),
      opponentId: "chicken-stockfish",
      opponentTargetElo: 100,
      opponentPolicyFingerprint: "home-fixture",
      ratedOpponentElo: null,
    },
  })
}

async function fixture(
  test: TestContext,
  initial: MapachessPlayerData = createInitialPlayerData(),
  restoring = false,
) {
  let saved: DurableStoreSnapshot = EMPTY_DURABLE_STORE_SNAPSHOT
  let writeGate: Promise<void> | undefined
  const adapter: DurableStoreAdapter = {
    read: async () => saved,
    compareAndSwapVerified: async ({ expected, next }) => {
      await writeGate
      if (!durableStoreSnapshotsEqual(saved, expected))
        return { ok: false, type: "PROFILE.STORAGE_CONFLICT", actual: saved }
      saved = next
      return { ok: true, snapshot: saved }
    },
  }
  const store = new SerializedPlayerDataStore(adapter, sha256)
  const seeded = await store.commitCurrent(await store.load(), initial)
  if (!seeded.ok)
    throw new Error("The Home fixture requires an accepted profile.")
  const profile = createActor(profileMachine, {
    input: {
      store,
      decodePortableBackup: (raw) => decodeMapachessPortableBackup(raw, sha256),
    },
  }).start()
  test.onTestFinished(() => {
    profile.stop()
  })
  await waitFor(profile, (snapshot) => snapshot.matches("ready"))
  const match = initial.activeMatch ?? retainedMatch()
  const setup: MatchSetup = {
    mode: "story",
    variant: "standard",
    opponentId: "chicken-stockfish",
  }
  const session = { match, setup }
  const opening = Promise.withResolvers<typeof session>()
  const openCurrentMatch = vi.fn(async () =>
    restoring ? opening.promise : session,
  )
  const actor = createActor(createMatchSessionMachine<typeof session>(), {
    input: {
      activeMatchExists: initial.activeMatch !== null,
      operations: {
        openCurrentMatch,
        openFreshMatch: async () => session,
        returnToMenu: async () => undefined,
        canNavigate: () => selectCanNavigateProfile(profile.getSnapshot()),
      },
    },
  }).start()
  test.onTestFinished(() => {
    actor.stop()
  })
  const navigation = { back: vi.fn(), open: vi.fn(), close: vi.fn() }
  const generate = vi.fn(() => generatedPosition)
  let externalSettings = false
  const commands = createHomeCommands({
    profileActor: profile,
    sessionActor: actor,
    navigation,
    generateChess960Position: generate,
    settingsOpen: () => externalSettings,
  })
  return {
    profile,
    actor,
    commands,
    navigation,
    generate,
    openCurrentMatch,
    opening,
    blockSettings: (value: boolean) => {
      externalSettings = value
    },
    holdWrite: () => {
      const gate = Promise.withResolvers<void>()
      writeGate = gate.promise
      test.onTestFinished(() => gate.resolve())
      return gate
    },
  }
}

describe("shared Home state and commands", () => {
  it.for(MATCH_MODE_CHOICES)(
    "opens $variant $mode from the accepted profile without starting an engine",
    async (choice, test) => {
      const home = await fixture(test)
      const before = selectCurrentPlayerData(home.profile.getSnapshot())
      expect(
        selectHome(home.profile.getSnapshot(), home.actor.getSnapshot())
          .resumeMatch,
      ).toBeNull()
      home.commands.selectMode(choice)
      const selected = home.actor.getSnapshot()
      expect(selected.matches({ menu: "setup" })).toBe(true)
      if (selected.context.requestedSetup.mode === "story") {
        expect(selected.context.requestedSetup).toEqual({
          mode: "story",
          variant: choice.variant,
          opponentId: "chicken-stockfish",
        })
      } else {
        expect(selected.context.requestedSetup.challengeSetup).toEqual({
          ...before?.settings.challengeSetup,
          variant: choice.variant,
          chess960PositionId: null,
        })
        expect(
          selected.context.requestedSetup.displayedChess960PositionId,
        ).toBe(choice.variant === "chess960" ? generatedPosition : undefined)
      }
      expect(home.generate).toHaveBeenCalledTimes(
        choice.mode === "challenge" && choice.variant === "chess960" ? 1 : 0,
      )
      expect(home.openCurrentMatch).not.toHaveBeenCalled()
      expect(selectCurrentPlayerData(home.profile.getSnapshot())).toBe(before)
    },
  )

  it("blocks stale activations while a changed appearance is pending, then uses the accepted profile", async (test) => {
    const home = await fixture(test)
    const gate = home.holdWrite()
    const current = selectCurrentPlayerData(home.profile.getSnapshot())
    if (current === null)
      throw new Error("A ready Home requires accepted data.")
    const appearance = { ...current.appearance, weapon: "weapon1" } as const
    home.profile.send({ type: "PROFILE.APPEARANCE_SAVE_REQUESTED", appearance })
    const pending = selectHome(
      home.profile.getSnapshot(),
      home.actor.getSnapshot(),
    )
    expect(pending.playerData?.appearance).toEqual(appearance)
    expect(pending.disabled).toBe(true)
    home.commands.selectMode({ mode: "story", variant: "standard" })
    home.commands.customize()
    home.commands.share()
    expect(home.actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(
      true,
    )
    expect(home.navigation.open).not.toHaveBeenCalled()
    gate.resolve()
    await waitFor(home.profile, (snapshot) => snapshot.matches("ready"))
    expect(profileAllowsMatchOpening(home.profile.getSnapshot())).toBe(true)
    home.commands.selectMode({ mode: "story", variant: "standard" })
    expect(home.actor.getSnapshot().matches({ menu: "setup" })).toBe(true)
  })

  it("preserves web availability for a pending standalone Auto-Hints preference", async (test) => {
    const home = await fixture(test)
    const gate = home.holdWrite()
    home.profile.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "no-auto-hints",
    })
    const pending = selectHome(
      home.profile.getSnapshot(),
      home.actor.getSnapshot(),
    )
    expect(pending.playerData?.settings.autoHintMode).toBe("no-auto-hints")
    expect(pending.disabled).toBe(false)
    home.commands.selectMode({ mode: "challenge", variant: "chess960" })
    expect(home.actor.getSnapshot().matches({ menu: "setup" })).toBe(true)
    gate.resolve()
  })

  it("reads fresh external and actor-owned overlay state for every control", async (test) => {
    const home = await fixture(test)
    home.blockSettings(true)
    home.commands.selectMode({ mode: "story", variant: "standard" })
    home.commands.customize()
    home.commands.share()
    expect(home.navigation.open).not.toHaveBeenCalled()
    home.blockSettings(false)
    home.commands.customize()
    home.commands.share()
    home.commands.settings()
    expect(home.navigation.open.mock.calls).toEqual([
      ["dressing-room"],
      ["profile-card"],
      ["settings"],
    ])
    home.actor.send({
      type: "MATCH_SESSION.OVERLAY_OPENED",
      overlay: "settings",
    })
    expect(
      selectHome(home.profile.getSnapshot(), home.actor.getSnapshot())
        .settingsOpen,
    ).toBe(true)
    home.commands.selectMode({ mode: "story", variant: "standard" })
    expect(home.actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(
      true,
    )
  })

  it("retains the actual timed match through Home and resumes it without another open or write", async (test) => {
    const home = await fixture(test, {
      ...createInitialPlayerData(),
      activeMatch: retainedMatch(),
    })
    await waitFor(home.actor, (snapshot) => snapshot.matches("active"))
    home.actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    const before = selectCurrentPlayerData(home.profile.getSnapshot())
    const session = home.actor.getSnapshot().context.session
    expect(
      selectHome(home.profile.getSnapshot(), home.actor.getSnapshot())
        .resumeMatch,
    ).toEqual({ timeControl: TIME_CONTROL_PRESETS[1].control, disabled: false })
    home.commands.resume()
    expect(home.actor.getSnapshot().matches("active")).toBe(true)
    expect(home.actor.getSnapshot().context.session).toBe(session)
    expect(home.openCurrentMatch).toHaveBeenCalledOnce()
    expect(selectCurrentPlayerData(home.profile.getSnapshot())).toBe(before)
  })

  it("keeps restore-time facts truthful and blocks commands until the session arrives", async (test) => {
    const home = await fixture(
      test,
      { ...createInitialPlayerData(), activeMatch: retainedMatch() },
      true,
    )
    const state = selectHome(
      home.profile.getSnapshot(),
      home.actor.getSnapshot(),
    )
    expect(state.disabled).toBe(true)
    expect(state.settingsDisabled).toBe(true)
    expect(state.resumeMatch).toEqual({
      timeControl: TIME_CONTROL_PRESETS[1].control,
      disabled: true,
    })
    home.commands.resume()
    home.commands.settings()
    expect(home.navigation.open).not.toHaveBeenCalled()
    const match = state.playerData?.activeMatch
    if (match === undefined || match === null)
      throw new Error("The restoring fixture requires its accepted match.")
    home.opening.resolve({
      match,
      setup: {
        mode: "story",
        variant: "standard",
        opponentId: "chicken-stockfish",
      },
    })
    await waitFor(home.actor, (snapshot) => snapshot.matches("active"))
  })

  it("keeps Resume available after a failed restore returns Home without an in-memory session", async (test) => {
    const match = retainedMatch()
    const home = await fixture(
      test,
      { ...createInitialPlayerData(), activeMatch: match },
      true,
    )
    home.opening.reject(new Error("The engine is temporarily unavailable."))
    await waitFor(home.actor, (snapshot) => snapshot.matches("failed"))
    home.actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" })
    expect(home.actor.getSnapshot().context.session).toBeNull()
    expect(
      selectHome(home.profile.getSnapshot(), home.actor.getSnapshot())
        .resumeMatch,
    ).toEqual({ timeControl: match.timeControl, disabled: false })
    home.openCurrentMatch.mockResolvedValueOnce({
      match,
      setup: {
        mode: "story",
        variant: "standard",
        opponentId: "chicken-stockfish",
      },
    })
    home.commands.resume()
    await waitFor(home.actor, (snapshot) => snapshot.matches("active"))
    expect(home.actor.getSnapshot().context.session?.match).toBe(match)
    expect(home.openCurrentMatch).toHaveBeenCalledTimes(2)
    expect(
      selectCurrentPlayerData(home.profile.getSnapshot())?.activeMatch,
    ).toEqual(match)
  })
})
