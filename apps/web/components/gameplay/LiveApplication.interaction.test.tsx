// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { selectStoryPlayerColor } from "@mapachess/gameplay/match-identity"
import loadCatalog from "@mapachess/localization/catalog"
import createInitialPlayerData from "@mapachess/profile/player-data"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import type { OpenWebMatchRuntimeInput } from "../../lib/gameplay/openWebMatchRuntime"
import type { WebMatchSessionActor } from "../../lib/gameplay/webMatchSessionMachine"
import type createWebOpponent from "../../lib/gameplay/webOpponent"
import { createWebPlayerDataBackup } from "../../lib/profile/webPlayerDataFiles"
import { bootApplication, savedProfile } from "../../test/applicationHarness"
import { installDomHarness } from "../../test/domHarness"
import engineHarness, { type EngineScenario } from "../../test/engineHarness"
import WebMapachessApplication from "../profile/WebMapachessApplication"

const scenario = vi.hoisted((): EngineScenario & { sequence: number } => ({
  failedWorker: null,
  replies: [],
  bootFailure: false,
  closes: 0,
  sequence: 0,
}))
const sessionOwner = vi.hoisted(() => ({
  current: null as WebMatchSessionActor | null,
}))
vi.mock("../../lib/gameplay/useWebMatchSession", async (original) => {
  const actual =
    await original<typeof import("../../lib/gameplay/useWebMatchSession")>()
  return {
    ...actual,
    default: (...args: Parameters<typeof actual.default>) => {
      const owner = actual.default(...args)
      sessionOwner.current = owner
      return owner
    },
  }
})
vi.mock("../../lib/gameplay/webOpponent", async (original) => {
  const actual =
    await original<typeof import("../../lib/gameplay/webOpponent")>()
  return {
    ...actual,
    default: (
      ...[engine, cryptography, seed, policy]: Parameters<
        typeof createWebOpponent
      >
    ) =>
      actual.default(engine, cryptography, seed, {
        ...policy,
        randomMoveProbabilityBasisPoints: 0,
      }),
  }
})
vi.mock("../../lib/gameplay/openWebMatchRuntime", async (original) => {
  const actual =
    await original<typeof import("../../lib/gameplay/openWebMatchRuntime")>()
  return {
    ...actual,
    default: (input: OpenWebMatchRuntimeInput = {}) => {
      let seed = parseDeterministicRandomSeed(
        String(++scenario.sequence).padStart(32, "0"),
        "Application integration",
      )
      while (selectStoryPlayerColor(seed) !== "white")
        seed = parseDeterministicRandomSeed(
          String(++scenario.sequence).padStart(32, "0"),
          "Application integration",
        )
      return actual.default({
        ...input,
        matchSeed: input.matchSeed ?? seed,
        openSession: (_configuration, options) =>
          engineHarness(scenario, options?.workerName ?? "opponent"),
      })
    },
  }
})
installDomHarness()
beforeEach(() => {
  scenario.failedWorker = null
  scenario.replies = []
  scenario.bootFailure = false
  scenario.closes = 0
  scenario.sequence = 0
})
const copy = loadCatalog("en")

async function start(mode: "story" | "challenge" = "challenge", timed = false) {
  const view = await bootApplication()
  const modeButton = screen.getByRole("button", {
    name: new RegExp(copy.setup.presentations.standard[mode].title),
  })
  await waitFor(() => expect(modeButton).toHaveProperty("disabled", false))
  fireEvent.click(modeButton)
  fireEvent.click(
    await screen.findByRole("button", { name: copy.setup.changeHints }),
  )
  let dialog = within(
    screen.getByRole("dialog", { name: copy.setup.betterHints }),
  )
  fireEvent.click(
    dialog.getByRole("radio", {
      name: copy.setup.autoHints["no-auto-hints"].label,
    }),
  )
  fireEvent.click(dialog.getByRole("button", { name: copy.setup.done }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  await waitFor(async () =>
    expect((await savedProfile(view.indexedDb)).settings.autoHintMode).toBe(
      "no-auto-hints",
    ),
  )
  if (timed) {
    fireEvent.click(
      screen.getByRole("button", { name: copy.gameplay.clock.change }),
    )
    dialog = within(
      screen.getByRole("dialog", { name: copy.gameplay.clock.timeControl }),
    )
    fireEvent.click(dialog.getByRole("radio", { name: /Blitz.*3\+2/ }))
    fireEvent.click(dialog.getByRole("button", { name: copy.setup.done }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  }
  const startMatch = screen.getByRole("button", {
    name: new RegExp(copy.setup.startMatch),
  })
  await waitFor(() => expect(startMatch).toHaveProperty("disabled", false))
  fireEvent.click(startMatch)
  await screen.findByRole("grid", {}, { timeout: 5000 })
  return view
}

async function move(
  from: string,
  to: string,
  indexedDb: Parameters<typeof savedProfile>[0],
  cursor: number,
) {
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: copy.gameplay.clock.resume }) !==
        null ||
        screen
          .getByRole("gridcell", { name: new RegExp(`^${from},`) })
          .getAttribute("aria-disabled") !== "true",
    ).toBe(true),
  )
  const resumeClock = screen.queryByRole("button", {
    name: copy.gameplay.clock.resume,
  })
  if (resumeClock !== null) fireEvent.click(resumeClock)
  await waitFor(() => {
    const match = sessionOwner.current
      ?.getSnapshot()
      .context.session?.actor.getSnapshot()
    expect(
      screen
        .getByRole("gridcell", { name: new RegExp(`^${from},`) })
        .getAttribute("aria-disabled"),
      JSON.stringify({ state: match?.value, clock: match?.context.clock }),
    ).not.toBe("true")
  })
  fireEvent.click(
    screen.getByRole("gridcell", { name: new RegExp(`^${from},`) }),
  )
  fireEvent.click(screen.getByRole("gridcell", { name: new RegExp(`^${to},`) }))
  await waitFor(async () =>
    expect((await savedProfile(indexedDb)).activeMatch?.cursor).toBe(cursor),
  )
}

describe("full application with real sessions, hints, rules, and persistence", () => {
  it("releases the owned engine when a confirmed profile import replaces its active match", async () => {
    const view = await start()
    const oldMatchId = (await savedProfile(view.indexedDb)).activeMatch?.matchId
    const closesBefore = scenario.closes
    const imported = {
      ...createInitialPlayerData(),
      introductionCompleted: true,
      totalXp: 4,
    }
    const backup = await createWebPlayerDataBackup(imported, crypto.subtle)
    fireEvent.click(
      screen.getByText(copy.interface.matchCommands.menu, { exact: true }),
    )
    fireEvent.click(
      screen.getByRole("button", { name: copy.interface.webGame.settings }),
    )
    const fileInput = view.container.querySelector('input[type="file"]')
    if (!(fileInput instanceof HTMLInputElement))
      throw new Error("Profile settings must own an import input.")
    const file = new File([backup], "replacement.json", {
      type: "application/json",
    })
    Object.defineProperty(file, "text", { value: async () => backup })
    fireEvent.change(fileInput, { target: { files: [file] } })
    fireEvent.click(
      await screen.findByRole("button", {
        name: copy.interface.profileImportPreviewPanel.replaceLocalPlayerData,
      }),
    )
    await screen.findByRole("button", {
      name: new RegExp(copy.setup.presentations.standard.story.title),
    })
    await waitFor(() => expect(scenario.closes).toBeGreaterThan(closesBefore))
    const saved = await savedProfile(view.indexedDb)
    expect(oldMatchId).toBeTruthy()
    expect(saved.activeMatch).toBeNull()
    expect(saved.totalXp).toBe(4)
    expect(screen.queryByRole("grid")).toBeNull()
  }, 15000)
  it("retries a failed initial engine boot without accepting a half-open saved match", async () => {
    const { indexedDb } = await bootApplication()
    const before = await savedProfile(indexedDb)
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(copy.setup.presentations.standard.story.title),
      }),
    )
    const startMatch = screen.getByRole("button", {
      name: new RegExp(copy.setup.startMatch),
    })
    await waitFor(() => expect(startMatch).toHaveProperty("disabled", false))
    scenario.bootFailure = true
    fireEvent.click(startMatch)
    await screen.findByRole("heading", {
      name: copy.presentation.sessionFailure.start,
    })
    expect((await savedProfile(indexedDb)).activeMatch).toBeNull()
    expect((await savedProfile(indexedDb)).ratings).toEqual(before.ratings)
    fireEvent.click(
      screen.getByRole("button", { name: copy.interface.webGame.retry }),
    )
    await screen.findByRole("grid")
    expect((await savedProfile(indexedDb)).activeMatch).not.toBeNull()
    expect((await savedProfile(indexedDb)).totalXp).toBe(before.totalXp)
  }, 15000)

  it("retains the current saved match when restart boot fails, then replaces it only after a successful retry", async () => {
    const { indexedDb } = await start()
    const before = await savedProfile(indexedDb)
    fireEvent.click(
      screen.getByText(copy.interface.matchCommands.menu, { exact: true }),
    )
    scenario.bootFailure = true
    fireEvent.click(
      screen.getByRole("button", { name: copy.interface.webGame.restartMatch }),
    )
    await screen.findByRole("heading", {
      name: copy.presentation.sessionFailure["restart-match"],
    })
    expect((await savedProfile(indexedDb)).activeMatch?.matchId).toBe(
      before.activeMatch?.matchId,
    )
    fireEvent.click(
      screen.getByRole("button", { name: copy.interface.webGame.retry }),
    )
    await waitFor(async () =>
      expect((await savedProfile(indexedDb)).activeMatch?.matchId).not.toBe(
        before.activeMatch?.matchId,
      ),
    )
    expect((await savedProfile(indexedDb)).totalXp).toBe(before.totalXp)
    expect((await savedProfile(indexedDb)).ratings).toEqual(before.ratings)
  }, 15000)

  it("returns to setup by clearing only the requested active match and closing its owned runtimes, then opens all modes", async () => {
    const { indexedDb } = await start()
    const before = await savedProfile(indexedDb)
    fireEvent.click(
      screen.getByText(copy.interface.matchCommands.menu, { exact: true }),
    )
    fireEvent.click(
      screen.getByRole("button", { name: copy.interface.webGame.returnToMenu }),
    )
    await screen.findByRole("heading", {
      name: copy.setup.presentations.standard.challenge.title,
    })
    expect((await savedProfile(indexedDb)).activeMatch).toBeNull()
    expect((await savedProfile(indexedDb)).ratings).toEqual(before.ratings)
    expect((await savedProfile(indexedDb)).totalXp).toBe(before.totalXp)
    expect(scenario.closes).toBe(3)
    fireEvent.click(screen.getByRole("button", { name: copy.setup.allModes }))
    await screen.findByRole("button", {
      name: new RegExp(copy.setup.presentations.standard.story.title),
    })
    expect(screen.queryByRole("button", { name: /Resume match/i })).toBeNull()
  }, 15000)
  it("starts a timed match, reveals both hint stages, configures Auto-Hints, returns Home, and resumes the saved board", async () => {
    const { indexedDb, unmount } = await start("challenge", true)
    expect((await savedProfile(indexedDb)).activeMatch?.timeControl).toEqual({
      type: "fischer",
      baseSeconds: 180,
      incrementSeconds: 2,
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(copy.gameplay.hints.controls.ready),
      }),
    )
    await screen.findByRole("button", {
      name: new RegExp(copy.gameplay.hints.controls["piece-hints"]),
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(copy.gameplay.hints.controls["piece-hints"]),
      }),
    )
    await waitFor(async () =>
      expect((await savedProfile(indexedDb)).activeMatch?.moveHintsUsed).toBe(
        true,
      ),
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.shared.settingsControls.explainAutoHints,
      }),
    )
    expect(await screen.findByText(/Bronze.*Move Hints used/i)).toBeTruthy()
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: copy.shared.settingsControls.close,
      }),
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    fireEvent.click(screen.getByRole("button", { name: /Auto Hints:.*Off/i }))
    const auto = within(screen.getByRole("dialog"))
    fireEvent.click(
      auto.getByRole("radio", {
        name: copy.setup.autoHints["auto-piece-hints"].label,
      }),
    )
    fireEvent.click(
      auto.getByRole("button", { name: copy.shared.settingsControls.close }),
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await move("e2", "e4", indexedDb, 2)
    const match = (await savedProfile(indexedDb)).activeMatch
    act(() =>
      sessionOwner.current?.send({ type: "MATCH_SESSION.MAIN_MENU_REQUESTED" }),
    )
    const resume = await screen.findByRole("button", { name: /Resume match/i })
    expect(scenario.closes).toBe(0)
    fireEvent.click(resume)
    await screen.findByRole("grid")
    expect((await savedProfile(indexedDb)).activeMatch?.moveIds).toEqual(
      match?.moveIds,
    )
    expect((await savedProfile(indexedDb)).activeMatch?.currentFen).toBe(
      match?.currentFen,
    )
    unmount()
    await waitFor(() => expect(scenario.closes).toBe(3))
    render(<WebMapachessApplication />)
    await screen.findByRole("grid", {}, { timeout: 5000 })
    expect((await savedProfile(indexedDb)).activeMatch?.currentFen).toBe(
      match?.currentFen,
    )
    fireEvent.click(
      screen.getByText(copy.interface.matchCommands.menu, { exact: true }),
    )
    fireEvent.click(
      screen.getByRole("button", { name: copy.interface.webGame.settings }),
    )
    const settings = within(
      screen.getByRole("dialog", { name: copy.profile.settingsTitle }),
    )
    fireEvent.click(
      settings.getByRole("radio", {
        name: copy.setup.autoHints["auto-move-hints"].label,
      }),
    )
    fireEvent.click(
      settings.getByRole("button", {
        name: copy.interface.profileSettingsPanel.closeSettings,
      }),
    )
    await waitFor(async () =>
      expect((await savedProfile(indexedDb)).activeMatch?.autoHintMode).toBe(
        "auto-move-hints",
      ),
    )
  }, 20000)

  it("wins Story through legal moves, shows accepted rewards, and opens the next opponent setup", async () => {
    scenario.replies = ["e7e5", "a7a6", "b7b6"]
    const { indexedDb } = await start("story")
    await move("e2", "e4", indexedDb, 2)
    await move("f1", "c4", indexedDb, 4)
    await move("d1", "h5", indexedDb, 6)
    await move("h5", "f7", indexedDb, 7)
    const next = await screen.findByRole("button", { name: /Next opponent/i })
    const won = await savedProfile(indexedDb)
    expect(won.activeMatch?.conclusion).toEqual({
      type: "checkmate",
      winner: "white",
    })
    expect(won.lastAcceptedResultReward?.ratedElo?.assistance).toBe("gold")
    fireEvent.click(next)
    await screen.findByRole("heading", {
      name: copy.setup.presentations.standard.story.title,
    })
    expect(
      screen.getAllByText("Bunny Stockfish", { exact: true }).length,
    ).toBeGreaterThan(0)
    expect((await savedProfile(indexedDb)).totalXp).toBe(won.totalXp)
  }, 20000)

  it("restarts a concluded Challenge from its rewards action without repeating the old award", async () => {
    const { indexedDb } = await start()
    fireEvent.click(
      screen.getByText(copy.interface.matchCommands.menu, { exact: true }),
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(copy.interface.matchCommands.resign),
      }),
    )
    const replay = await screen.findByRole("button", {
      name: /Replay opponent/i,
    })
    const previous = await savedProfile(indexedDb)
    fireEvent.click(replay)
    await screen.findByRole("grid")
    await waitFor(async () =>
      expect((await savedProfile(indexedDb)).activeMatch?.matchId).not.toBe(
        previous.activeMatch?.matchId,
      ),
    )
    expect((await savedProfile(indexedDb)).totalXp).toBe(previous.totalXp)
    expect((await savedProfile(indexedDb)).activeMatch?.conclusion).toBeNull()
  }, 15000)

  it.each(["evaluation", "opponent", "better-hints"])(
    "recovers an interrupted %s search through its actual retry control",
    async (worker) => {
      if (worker === "evaluation") scenario.failedWorker = worker
      const { indexedDb } = await start()
      if (worker !== "evaluation") scenario.failedWorker = worker
      if (worker === "better-hints")
        fireEvent.click(
          screen.getByRole("button", {
            name: new RegExp(copy.gameplay.hints.controls.ready),
          }),
        )
      else if (worker === "opponent") await move("e2", "e4", indexedDb, 1)
      const retry = await screen.findByRole("button", {
        name: /Retry.*hint|Retry.*evaluation|Try.*again|Retry.*turn/i,
      })
      fireEvent.click(retry)
      if (worker === "opponent")
        await waitFor(async () =>
          expect((await savedProfile(indexedDb)).activeMatch?.cursor).toBe(2),
        )
      if (worker === "better-hints")
        await screen.findByRole("button", {
          name: new RegExp(copy.gameplay.hints.controls["piece-hints"]),
        })
      expect((await savedProfile(indexedDb)).activeMatch).not.toBeNull()
    },
    15000,
  )
})
