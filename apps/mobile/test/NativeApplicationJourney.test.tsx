import "./nativeUiEnvironment"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import loadCatalog from "@mapachess/localization/catalog"
import { LOCALE_LABELS } from "@mapachess/localization/locale"
import { selectHintStage } from "@mapachess/match/match-machine"
import {
  TIME_CONTROL_PRESETS,
  timeControlLabel,
} from "@mapachess/match/time-control"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import openNativeStockfishSession from "@mapachess/stockfish-native/open-session"
import HomeScreen from "@/app/index"
import openNativeApplicationRuntime, {
  type NativeApplicationRuntime,
} from "@/lib/gameplay/openNativeApplicationRuntime"
import openNativeMatchRuntime from "@/lib/gameplay/openNativeMatchRuntime"
import cryptography from "./nativeCryptographyFixture"
import NativeEngineFixture from "./nativeEngineFixture"
import InMemoryAsyncStorage from "./nativeStorageFixture"

jest.mock("expo-font", () => ({ useFonts: () => [true, null] }))
jest.mock("@/lib/gameplay/openNativeApplicationRuntime", () => ({
  __esModule: true,
  default: jest.fn(),
}))

const openApplication = jest.mocked(openNativeApplicationRuntime)
const actualOpen = jest.requireActual<
  typeof import("@/lib/gameplay/openNativeApplicationRuntime")
>("@/lib/gameplay/openNativeApplicationRuntime").default
const copy = loadCatalog("en")
let application: NativeApplicationRuntime | undefined
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(async () => {
  await application?.close()
  application = undefined
})

async function readyApplication(
  introductionCompleted = true,
  unavailableEngine = false,
) {
  const bridge = new NativeEngineFixture()
  const storage = new InMemoryAsyncStorage()
  application = await actualOpen({
    profile: { storage },
    game: {
      openRuntime: (input) =>
        unavailableEngine
          ? Promise.reject(new Error("Native engine is unavailable"))
          : openNativeMatchRuntime({
              ...input,
              cryptography,
              openSession: (configuration) =>
                openNativeStockfishSession(configuration, bridge),
            }),
      activity: { isActive: () => true, subscribe: () => () => undefined },
    },
  })
  await waitFor(() =>
    expect(application?.profile.actor.getSnapshot().matches("ready")).toBe(
      true,
    ),
  )
  if (introductionCompleted) {
    application.profile.actor.send({
      type: "PROFILE.INTRODUCTION_COMPLETED",
      locale: "en",
    })
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(application!.profile.actor.getSnapshot())
          ?.introductionCompleted,
      ).toBe(true),
    )
  }
  openApplication.mockResolvedValue(application)
  return application
}

describe("native production application journeys", () => {
  it("boots the actual first-arrival screen and accepts language/start without opening an engine", async () => {
    const runtime = await readyApplication(false)
    await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", { name: copy.introduction.start }),
    )
    expect(
      await screen.findByRole("button", {
        name: copy.setup.presentations.standard.story.title,
      }),
    ).toBeOnTheScreen()
    expect(runtime.profile.actor.getSnapshot().matches("ready")).toBe(true)
    expect(runtime.game().actor.getSnapshot().context.session).toBeNull()
  })

  it("opens real setup and an accepted native match, and Close dismisses expanded History once", async () => {
    const runtime = await readyApplication()
    await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.setup.presentations.standard.story.title,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.startMatch }),
    )
    await waitFor(() =>
      expect(runtime.game().actor.getSnapshot().matches("active")).toBe(true),
    )
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.interface.matchCommands.menu,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.interface.webMatch.matchDetailsMoveHistory,
      }),
    )
    expect(
      screen.getByRole("header", {
        name: copy.interface.classifiedMoveHistory.moveHistory,
      }),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.shared.settingsControls.close }),
    )
    expect(runtime.game().actor.getSnapshot().context.overlays).toEqual([])
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.activeMatch,
    ).not.toBeNull()
  })

  it("allows an unavailable engine to return to setup and Home without deleting player data", async () => {
    const runtime = await readyApplication(true, true)
    await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.setup.presentations.standard.story.title,
      }),
    )
    const before = selectCurrentPlayerData(runtime.profile.actor.getSnapshot())
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.startMatch }),
    )
    await waitFor(() =>
      expect(runtime.game().actor.getSnapshot().matches("failed")).toBe(true),
    )
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.interface.profileCardJourney.back,
      }),
    )
    expect(runtime.game().actor.getSnapshot().matches({ menu: "setup" })).toBe(
      true,
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.allModes }),
    )
    expect(
      await screen.findByRole("button", {
        name: copy.setup.presentations.standard.story.title,
      }),
    ).toBeOnTheScreen()
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot()),
    ).toEqual(before)
  })

  it("accepts a result once and reverses/reapplies it through the real native Undo/Redo buttons", async () => {
    const runtime = await readyApplication()
    await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.setup.presentations.standard.story.title,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.startMatch }),
    )
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.interface.matchCommands.menu,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.interface.matchCommands.resign }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.totalXp,
      ).toBe(4),
    )
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.interface.matchCelebration.reviewBoard,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.interface.matchCommands.undo }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(runtime.profile.actor.getSnapshot())
          ?.activeMatch?.conclusion,
      ).toBeNull(),
    )
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.totalXp,
    ).toBe(0)
    await fireEvent.press(
      screen.getByRole("button", { name: copy.interface.matchCommands.redo }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.totalXp,
      ).toBe(4),
    )
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot())
        ?.lastAcceptedResultReward?.awardedXp,
    ).toBe(4)
  })

  it("exposes all six customization categories and cancels a changed weapon without saving it", async () => {
    const runtime = await readyApplication()
    await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", { name: copy.setup.customizeProfile }),
    )
    for (const category of Object.values(copy.profile.dressing.categories))
      expect(
        await screen.findByRole("button", { name: category }),
      ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.profile.dressing.categories.Weapons,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.profile.dressing.weapons.weapon1,
      }),
    )
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.appearance
        .weapon,
    ).toBe("none")
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.cancel }),
    )
    expect(
      await screen.findByRole("button", { name: copy.setup.customizeProfile }),
    ).toBeOnTheScreen()
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.appearance
        .weapon,
    ).toBe("none")
  })

  it("opens a dedicated Credits view and persists the chosen locale without replacing progress", async () => {
    const runtime = await readyApplication()
    await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.interface.webGame.settings,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.shared.creditControls.title }),
    )
    expect(
      screen.getByRole("header", { name: copy.shared.creditControls.title }),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.shared.settingsControls.back }),
    )
    expect(
      screen.getByRole("header", { name: copy.profile.settingsTitle }),
    ).toBeOnTheScreen()
    const before = selectCurrentPlayerData(runtime.profile.actor.getSnapshot())
    await fireEvent.press(
      screen.getByRole("button", { name: LOCALE_LABELS["es-419"] }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.settings
          .locale,
      ).toBe("es-419"),
    )
    expect(
      screen.getByRole("header", {
        name: loadCatalog("es-419").profile.settingsTitle,
      }),
    ).toBeOnTheScreen()
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.ratings,
    ).toEqual(before?.ratings)
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.totalXp,
    ).toEqual(before?.totalXp)
  })

  it("returns Home with the retained match out of the visible controls and resumes that same match", async () => {
    const runtime = await readyApplication()
    await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.setup.presentations.standard.story.title,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.startMatch }),
    )
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.interface.matchCommands.menu,
      }),
    )
    const matchId = runtime.game().actor.getSnapshot().context.session
      ?.match.matchId
    await fireEvent.press(
      screen.getByRole("button", { name: copy.interface.webGame.returnToMenu }),
    )
    expect(
      await screen.findByRole("button", {
        name: copy.setup.presentations.standard.story.title,
      }),
    ).toBeOnTheScreen()
    expect(
      screen.queryByRole("button", { name: copy.interface.matchCommands.menu }),
    ).toBeNull()
    await fireEvent.press(
      screen.getByRole("button", {
        name: new RegExp(copy.interface.webGame.resumeMatch),
      }),
    )
    expect(
      await screen.findByRole("button", {
        name: copy.interface.matchCommands.menu,
      }),
    ).toBeOnTheScreen()
    expect(
      runtime.game().actor.getSnapshot().context.session?.match.matchId,
    ).toBe(matchId)
  })

  it("opens the actual card export preview, switches formats, and returns without changing progress", async () => {
    const runtime = await readyApplication()
    const before = selectCurrentPlayerData(runtime.profile.actor.getSnapshot())
    await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", { name: copy.setup.shareProfile }),
    )
    expect(
      await screen.findByRole("header", { name: copy.setup.shareProfile }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole("button", { name: copy.profile.cardFormats.GIF }),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.profile.cardFormats.PNG }),
    )
    expect(
      screen.getByRole("button", { name: copy.profile.shareFormat("PNG") }),
    ).toBeDisabled()
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.interface.profileCardJourney.back,
      }),
    )
    expect(
      await screen.findByRole("button", { name: copy.setup.shareProfile }),
    ).toBeOnTheScreen()
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot()),
    ).toEqual(before)
  })

  it("keeps unsaved card choices recoverable when native Back leaves the overview", async () => {
    const runtime = await readyApplication()
    await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", { name: copy.setup.customizeProfile }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.gameplay.clock.category.blitz }),
    )
    await fireEvent(
      screen.getByRole("header", { name: copy.setup.customizeProfile }),
      "requestClose",
    )
    expect(
      await screen.findByRole("header", {
        name: copy.interface.profileCardJourney.keepYourAppearanceChanges,
      }),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.interface.profileCardJourney.keepEditing,
      }),
    )
    expect(
      screen.getByRole("button", { name: copy.gameplay.clock.category.blitz }),
    ).toBeSelected()
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.settings
        .cardRatingContext.category,
    ).toBe("untimed")
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.cancel }),
    )
    expect(
      await screen.findByRole("button", { name: copy.setup.customizeProfile }),
    ).toBeOnTheScreen()
  })

  it("plays Bullet with both manual hint stages and requires an explicit clock Resume after the menu closes", async () => {
    const runtime = await readyApplication()
    runtime.profile.actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "no-auto-hints",
    })
    await waitFor(() =>
      expect(runtime.profile.actor.getSnapshot().matches("ready")).toBe(true),
    )
    await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.setup.presentations.standard.story.title,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: new RegExp(copy.gameplay.clock.timeControl),
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: timeControlLabel(
          TIME_CONTROL_PRESETS[1].control,
          copy.gameplay.clock,
        ),
      }),
    )
    await fireEvent.press(screen.getByRole("button", { name: copy.setup.done }))
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.startMatch }),
    )
    await waitFor(() =>
      expect(runtime.game().actor.getSnapshot().matches("active")).toBe(true),
    )
    const session = runtime.game().actor.getSnapshot().context.session
    if (session === null) throw new Error("Timed native match must open")
    expect(session.match.timeControl).toEqual(TIME_CONTROL_PRESETS[1].control)
    expect(screen.getAllByRole("timer")).toHaveLength(2)
    await waitFor(() =>
      expect(selectHintStage(session.actor.getSnapshot())).toBe("ready"),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: new RegExp(copy.gameplay.hints.getHint),
      }),
    )
    await waitFor(() =>
      expect(selectHintStage(session.actor.getSnapshot())).toBe("piece-hints"),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: new RegExp(copy.gameplay.hints.getHint),
      }),
    )
    await waitFor(() =>
      expect(selectHintStage(session.actor.getSnapshot())).toBe("move-hints"),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.interface.matchCommands.menu }),
    )
    await waitFor(() =>
      expect(session.actor.getSnapshot().matches("paused")).toBe(true),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.shared.settingsControls.close }),
    )
    expect(session.actor.getSnapshot().matches("paused")).toBe(true)
    await fireEvent.press(
      screen.getByRole("button", { name: copy.gameplay.clock.resume }),
    )
    await waitFor(() =>
      expect(session.actor.getSnapshot().context.clock?.paused).toBe(false),
    )
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.activeMatch
        ?.timeControl,
    ).toEqual(TIME_CONTROL_PRESETS[1].control)
  })
})
