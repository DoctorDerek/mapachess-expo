import { createHash } from "node:crypto"
import { describe, expect, it, vi, type TestContext } from "vitest"
import { createActor, waitFor } from "xstate"
import { DEFAULT_CHALLENGE_SETUP } from "@mapachess/match/challenge-setup"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import matchMachine, {
  selectAutoHintMode,
} from "@mapachess/match/match-machine"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import createMatchSessionMachine from "@mapachess/match/match-session-machine"
import createMatchSetupForMode, {
  MATCH_MODE_CHOICES,
  type MatchSetup,
} from "@mapachess/match/match-setup"
import { TIME_CONTROL_PRESETS } from "@mapachess/match/time-control"
import SerializedPlayerDataStore, {
  durableStoreSnapshotsEqual,
  EMPTY_DURABLE_STORE_SNAPSHOT,
  type DurableStoreSnapshot,
} from "@mapachess/profile/durable-store"
import createInitialPlayerData from "@mapachess/profile/player-data"
import { decodeMapachessPortableBackup } from "@mapachess/profile/portable-backup"
import profileMachine, {
  selectCurrentPlayerData,
} from "@mapachess/profile/profile-machine"
import createMatchSetupDraft, {
  canAcceptSetupEditor,
  createMatchSetupCommands,
  prepareMatchSetupSubmission,
  selectMatchSetup,
  selectSetupEditor,
  type SetupEditorValues,
} from "../src/matchSetup.js"
import matchSetupMachine, {
  setupEditorMachine,
} from "../src/matchSetupMachine.js"

const data = createInitialPlayerData()
const source = {
  storyProgress: data.storyProgress,
  challengeHistory: data.challengeHistory,
  autoHintMode: data.settings.autoHintMode,
  playerAppearance: data.appearance,
  ratings: data.ratings,
}
const parsed = parseChess960PositionId(37)
if (!parsed.ok) throw new Error("Expected a valid setup fixture position.")
const position = parsed.positionId
const generatePosition = vi.fn(() => position)
const input = (initial: MatchSetup) => ({
  initial,
  storyProgress: data.storyProgress,
  generatePosition,
})

async function commandsFixture(test: TestContext, retained = false) {
  const sha256 = async (text: string) =>
    createHash("sha256").update(text).digest("hex")
  let saved: DurableStoreSnapshot = EMPTY_DURABLE_STORE_SNAPSHOT
  const store = new SerializedPlayerDataStore(
    {
      read: async () => saved,
      compareAndSwapVerified: async ({ expected, next }) => {
        if (!durableStoreSnapshotsEqual(saved, expected))
          return { ok: false, type: "PROFILE.STORAGE_CONFLICT", actual: saved }
        saved = next
        return { ok: true, snapshot: next }
      },
    },
    sha256,
  )
  const profile = createActor(profileMachine, {
    input: {
      store,
      decodePortableBackup: (raw) => decodeMapachessPortableBackup(raw, sha256),
    },
  }).start()
  await waitFor(profile, (snapshot) => snapshot.matches("ready"))
  const setup: MatchSetup = {
    mode: "story",
    variant: "standard",
    opponentId: "chicken-stockfish",
  }
  const match = createActor(matchMachine, {
    input: {
      autoHintMode: "no-auto-hints",
      durability: { type: "ephemeral" },
      matchId: "setup-fixture",
      initialPosition: createInitialMatchPosition({
        variant: "standard",
        chess960PositionId: null,
      }),
      playerColor: "white",
      opponent: {
        selectMove: async () => {
          throw new Error("Setup must not search.")
        },
      },
    },
  }).start()
  const session = { match: { matchId: "setup-fixture" }, setup, actor: match }
  const open = vi.fn(async () => session)
  const actor = createActor(createMatchSessionMachine<typeof session>(), {
    input: {
      activeMatchExists: retained,
      operations: {
        openCurrentMatch: async () => session,
        openFreshMatch: open,
        returnToMenu: async () => undefined,
        canNavigate: () => profile.getSnapshot().matches("ready"),
      },
    },
  }).start()
  if (retained) await waitFor(actor, (snapshot) => snapshot.matches("active"))
  test.onTestFinished(() => {
    actor.stop()
    profile.stop()
    match.stop()
  })
  const navigation = {
    back: () => actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" }),
    open: (
      overlay: Parameters<
        ReturnType<typeof createMatchSetupCommands>["openEditor"]
      >[0],
    ) =>
      actor.send({
        type: "MATCH_SESSION.OVERLAY_OPENED",
        overlay: `setup-${overlay}`,
      }),
    close: vi.fn(),
  }
  const commands = createMatchSetupCommands({
    profileActor: profile,
    sessionActor: actor,
    navigation: {
      ...navigation,
      open: (overlay) =>
        actor.send({ type: "MATCH_SESSION.OVERLAY_OPENED", overlay }),
    },
  })
  return { profile, actor, match, open, commands, setup }
}

describe("shared match setup draft and acceptance", () => {
  it.each(MATCH_MODE_CHOICES)(
    "prepares $variant $mode without mutating the profile",
    (choice) => {
      const initial = createMatchSetupForMode(choice, DEFAULT_CHALLENGE_SETUP)
      const actor = createActor(matchSetupMachine, {
        input: input(initial),
      }).start()
      const before = structuredClone(source)
      actor.send({
        type: "MATCH_SETUP.TIME_CONTROL_SELECTED",
        control: TIME_CONTROL_PRESETS[1].control,
      })
      const view = selectMatchSetup(actor.getSnapshot().context, source)
      expect(view.available).toBe(true)
      expect(view.category).toBe("bullet")
      expect(view.rating?.value).toBe(100)
      const result = prepareMatchSetupSubmission(
        actor.getSnapshot().context,
        source,
        false,
      )
      expect(result.type).toBe("ready")
      if (result.type !== "ready")
        throw new Error("Expected an accepted setup.")
      expect(result.setup.timeControl).toEqual(TIME_CONTROL_PRESETS[1].control)
      expect(result.setup.mode).toBe(choice.mode)
      expect(source).toEqual(before)
      expect(
        prepareMatchSetupSubmission(actor.getSnapshot().context, source, true),
      ).toEqual({ type: "blocked" })
      actor.stop()
    },
  )

  it("retains invalid exact text, recovers on the same tick and preserves the displayed position", () => {
    const initial = createMatchSetupForMode(
      { mode: "challenge", variant: "chess960" },
      DEFAULT_CHALLENGE_SETUP,
    )
    const actor = createActor(matchSetupMachine, {
      input: input(initial),
    }).start()
    actor.send({
      type: "MATCH_SETUP.DIFFICULTY_EDITED",
      edit: { type: "typed", text: "1012" },
    })
    expect(
      prepareMatchSetupSubmission(actor.getSnapshot().context, source, false),
    ).toEqual({ type: "difficulty" })
    actor.send({
      type: "MATCH_SETUP.DIFFICULTY_EDITED",
      edit: { type: "committed" },
    })
    expect(
      selectMatchSetup(actor.getSnapshot().context, source).difficulty,
    ).toMatchObject({ exactText: "1012", showError: true, rangeValue: 100 })
    actor.send({
      type: "MATCH_SETUP.DIFFICULTY_EDITED",
      edit: { type: "typed", text: "2325" },
    })
    actor.send({ type: "MATCH_SETUP.COLOR_SELECTED", color: "black" })
    actor.send({ type: "MATCH_SETUP.POSITION_TYPED", value: "518" })
    expect(
      prepareMatchSetupSubmission(actor.getSnapshot().context, source, false),
    ).toMatchObject({
      type: "ready",
      setup: {
        displayedChess960PositionId: 518,
        challengeSetup: {
          difficultyTargetElo: 2325,
          playerColor: "black",
          chess960PositionId: 518,
        },
      },
    })
    actor.send({ type: "MATCH_SETUP.POSITION_TYPED", value: "960" })
    expect(
      prepareMatchSetupSubmission(actor.getSnapshot().context, source, false),
    ).toEqual({ type: "invalid" })
    actor.send({ type: "MATCH_SETUP.SUBMISSION_REJECTED" })
    expect(actor.getSnapshot().context.invalidSetup).toBe(true)
    actor.send({ type: "MATCH_SETUP.POSITION_RANDOMIZED" })
    expect(actor.getSnapshot().context.invalidSetup).toBe(false)
    expect(
      prepareMatchSetupSubmission(actor.getSnapshot().context, source, false),
    ).toMatchObject({
      type: "ready",
      setup: {
        displayedChess960PositionId: position,
        challengeSetup: { chess960PositionId: null },
      },
    })
    actor.stop()
  })

  it("prefers explicit and retained positions over randomness and rejects unavailable animals", () => {
    const initial = createMatchSetupForMode(
      { mode: "challenge", variant: "chess960" },
      DEFAULT_CHALLENGE_SETUP,
    )
    if (initial.mode !== "challenge") throw new Error("Expected Challenge.")
    const generate = vi.fn(() => position)
    const retained = createMatchSetupDraft({
      ...input({ ...initial, displayedChess960PositionId: position }),
      generatePosition: generate,
    })
    expect(retained.positionText).toBe(String(position))
    expect(generate).not.toHaveBeenCalled()
    const explicit = createMatchSetupDraft({
      ...input({
        ...initial,
        challengeSetup: {
          ...initial.challengeSetup,
          variant: "chess960",
          chess960PositionId: position,
        },
      }),
      generatePosition: generate,
    })
    expect(explicit.numberedPosition).toBe(true)
    expect(generate).not.toHaveBeenCalled()
    expect(
      prepareMatchSetupSubmission(
        { ...retained, opponentId: "dragonfly-stockfish" },
        source,
        false,
      ),
    ).toEqual({ type: "blocked" })
    const story = createMatchSetupDraft(
      input({ mode: "story", variant: "standard" }),
    )
    expect(
      prepareMatchSetupSubmission(
        { ...story, opponentId: "dragonfly-stockfish" },
        source,
        false,
      ),
    ).toEqual({ type: "blocked" })
    expect(
      selectMatchSetup(story, {
        ...source,
        playerAppearance: undefined,
        ratings: undefined,
      }),
    ).toMatchObject({ playerAnimal: null, rating: null })
  })

  it("keeps selector candidates private and projects overlay occlusion without losing the editor", () => {
    const values: SetupEditorValues = {
      player: "raccoon-stockfish",
      opponent: "chicken-stockfish",
      hints: "no-auto-hints",
      "time-control": { type: "untimed" },
    }
    const actor = createActor(setupEditorMachine, { input: values }).start()
    actor.send({
      type: "SETUP_EDITOR.PLAYER_SELECTED",
      player: "chicken-stockfish",
    })
    actor.send({
      type: "SETUP_EDITOR.OPPONENT_SELECTED",
      opponent: "bunny-stockfish",
    })
    actor.send({
      type: "SETUP_EDITOR.HINTS_SELECTED",
      hints: "auto-move-hints",
    })
    actor.send({
      type: "SETUP_EDITOR.TIME_CONTROL_SELECTED",
      control: TIME_CONTROL_PRESETS[2].control,
    })
    expect(values.hints).toBe("no-auto-hints")
    expect(
      canAcceptSetupEditor(
        "player",
        actor.getSnapshot().context,
        "standard",
        "story",
        data.storyProgress,
      ),
    ).toBe(false)
    expect(
      canAcceptSetupEditor(
        "opponent",
        actor.getSnapshot().context,
        "standard",
        "challenge",
        data.storyProgress,
      ),
    ).toBe(false)
    expect(
      canAcceptSetupEditor(
        "hints",
        actor.getSnapshot().context,
        "standard",
        "story",
        data.storyProgress,
      ),
    ).toBe(true)
    expect(selectSetupEditor([])).toEqual({ editor: null, active: false })
    expect(selectSetupEditor(["setup-player", "settings"])).toEqual({
      editor: "player",
      active: false,
    })
    expect(selectSetupEditor(["setup-opponent"])).toEqual({
      editor: "opponent",
      active: true,
    })
    expect(selectSetupEditor(["setup-time-control"])).toEqual({
      editor: "time-control",
      active: true,
    })
    expect(selectSetupEditor(["setup-hints"])).toEqual({
      editor: "hints",
      active: true,
    })
    actor.stop()
  })

  it("rechecks current readiness, overlays and unlocks before starting once", async (test) => {
    const fixture = await commandsFixture(test)
    fixture.commands.start(fixture.setup)
    expect(fixture.open).not.toHaveBeenCalled()
    fixture.actor.send({
      type: "MATCH_SESSION.SETUP_REQUESTED",
      setup: fixture.setup,
    })
    fixture.commands.openEditor("hints")
    fixture.commands.start(fixture.setup)
    expect(fixture.open).not.toHaveBeenCalled()
    fixture.commands.closeEditor()
    fixture.commands.start({
      ...fixture.setup,
      mode: "story",
      variant: "standard",
      opponentId: "dragonfly-stockfish",
    })
    expect(fixture.open).not.toHaveBeenCalled()
    fixture.commands.changePlayer("dragonfly-stockfish")
    expect(
      selectCurrentPlayerData(fixture.profile.getSnapshot())?.appearance.animal,
    ).toBe("raccoon-stockfish")
    fixture.commands.start(fixture.setup)
    fixture.commands.start(fixture.setup)
    await waitFor(fixture.actor, (snapshot) => snapshot.matches("active"))
    expect(fixture.open).toHaveBeenCalledTimes(1)
  })

  it("routes hints to the retained match rather than writing standalone defaults", async (test) => {
    const fixture = await commandsFixture(test, true)
    const before = selectCurrentPlayerData(fixture.profile.getSnapshot())
    fixture.commands.changeHints("auto-piece-hints")
    expect(selectAutoHintMode(fixture.match.getSnapshot())).toBe(
      "auto-piece-hints",
    )
    expect(selectCurrentPlayerData(fixture.profile.getSnapshot())).toBe(before)
  })

  it("uses accepted profile mutations for standalone hints and player appearance", async (test) => {
    const fixture = await commandsFixture(test)
    fixture.commands.changeHints("no-auto-hints")
    await waitFor(
      fixture.profile,
      (snapshot) =>
        snapshot.matches("ready") &&
        selectCurrentPlayerData(snapshot)?.settings.autoHintMode ===
          "no-auto-hints",
    )
    fixture.commands.changePlayer("raccoon-stockfish")
    await waitFor(fixture.profile, (snapshot) => snapshot.matches("ready"))
    expect(
      selectCurrentPlayerData(fixture.profile.getSnapshot())?.appearance.animal,
    ).toBe("raccoon-stockfish")
  })
})
