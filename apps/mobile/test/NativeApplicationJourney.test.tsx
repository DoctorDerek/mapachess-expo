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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import loadCatalog from "@mapachess/localization/catalog"
import { LOCALE_LABELS } from "@mapachess/localization/locale"
import {
  selectHintStage,
  selectMatchTimeline,
} from "@mapachess/match/match-machine"
import { formatMatchMoveNotation } from "@mapachess/match/match-move"
import { keyboardBindingLabel } from "@mapachess/match/player-input"
import {
  TIME_CONTROL_PRESETS,
  timeControlLabel,
} from "@mapachess/match/time-control"
import createInitialPlayerData, {
  type MapachessPlayerData,
} from "@mapachess/profile/player-data"
import { createMapachessPortableBackup } from "@mapachess/profile/portable-backup"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import openNativeStockfishSession from "@mapachess/stockfish-native/open-session"
import HomeScreen from "@/app/index"
import openNativeApplicationRuntime, {
  type NativeApplicationRuntime,
} from "@/lib/gameplay/openNativeApplicationRuntime"
import openNativeMatchRuntime from "@/lib/gameplay/openNativeMatchRuntime"
import { MAPACHESS_ASYNC_STORAGE_NAMESPACE } from "@/lib/profile/AsyncStorageDurableStore"
import openNativeProfileRuntime from "@/lib/profile/openNativeProfileRuntime"
import cryptography from "./nativeCryptographyFixture"
import NativeEngineFixture from "./nativeEngineFixture"
import InMemoryAsyncStorage from "./nativeStorageFixture"

jest.mock("expo-font", () => ({ useFonts: () => [true, null] }))
jest.mock("@/lib/gameplay/openNativeApplicationRuntime", () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock("@/lib/gameplay/nativeApplicationActivity", () => ({
  __esModule: true,
  default: () => ({ isActive: () => true, subscribe: () => () => undefined }),
}))

let mockHardwareInput: ((event: unknown) => void) | undefined
jest.mock("expo", () => {
  const actual = jest.requireActual<typeof import("expo")>("expo")
  return {
    ...actual,
    requireOptionalNativeModule: (name: string) =>
      name === "MapachessInput"
        ? {
            addListener: (
              _event: string,
              listener: (event: unknown) => void,
            ) => {
              mockHardwareInput = listener
              return {
                remove: () => {
                  if (mockHardwareInput === listener)
                    mockHardwareInput = undefined
                },
              }
            },
          }
        : actual.requireOptionalNativeModule(name),
  }
})

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

async function readyApplication({
  introductionCompleted = true,
  storage = new InMemoryAsyncStorage(),
  bridge = new NativeEngineFixture(),
}: Readonly<{
  introductionCompleted?: boolean
  storage?: InMemoryAsyncStorage
  bridge?: NativeEngineFixture
}> = {}) {
  application = await actualOpen({
    profile: { storage },
    game: {
      openRuntime: (input) =>
        openNativeMatchRuntime({
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
  if (
    introductionCompleted &&
    !selectCurrentPlayerData(application.profile.actor.getSnapshot())
      ?.introductionCompleted
  ) {
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
  it("retries app and game initialization failures without overwriting the accepted profile", async () => {
    const runtime = await readyApplication()
    const before = selectCurrentPlayerData(runtime.profile.actor.getSnapshot())
    openApplication.mockRejectedValueOnce(
      new Error("Storage temporarily unavailable"),
    )
    jest.spyOn(runtime, "game").mockImplementationOnce(() => {
      throw new Error("Unable to initialize game session")
    })
    await render(<HomeScreen />)
    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent(
      copy.interface.webMapachessApplication.mapachessCouldNotReadLocalData,
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.interface.webMapachessApplication.tryAgain,
      }),
    )
    expect(
      await screen.findByText(copy.presentation.sessionFailure.start),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.interface.webGame.retry }),
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

  it("boots the actual first-arrival screen and accepts language/start without opening an engine", async () => {
    const runtime = await readyApplication({ introductionCompleted: false })
    await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", { name: LOCALE_LABELS["es-419"] }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.settings
          .locale,
      ).toBe("es-419"),
    )
    expect(
      screen.getByRole("button", {
        name: loadCatalog("es-419").introduction.start,
      }),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", { name: LOCALE_LABELS.en }),
    )
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
    for (const variant of ["standard", "chess960"] as const)
      for (const mode of ["story", "challenge"] as const)
        expect(
          screen.getByRole("button", {
            name: copy.setup.presentations[variant][mode].title,
          }),
        ).toBeOnTheScreen()
    expect(
      screen.getByRole("button", { name: copy.setup.customizeProfile }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole("button", { name: copy.setup.shareProfile }),
    ).toBeOnTheScreen()
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
    const bridge = new NativeEngineFixture()
    bridge.bootFailure = {
      ordinal: 1,
      error: new Error("Native engine is unavailable"),
    }
    const runtime = await readyApplication({ bridge })
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

  it("preserves a corrupt native save until the player explicitly confirms a reset", async () => {
    const storage = new InMemoryAsyncStorage()
    const key = MAPACHESS_ASYNC_STORAGE_NAMESPACE + "/current"
    const invalid = "unreadable original save"
    storage.values.set(key, invalid)
    application = await actualOpen({ profile: { storage } })
    openApplication.mockResolvedValue(application)
    await render(<HomeScreen />)
    const recovery = copy.interface.profileRecoveryPanel
    expect(
      await screen.findByRole("header", {
        name: recovery.yourSaveNeedsAttention,
      }),
    ).toBeOnTheScreen()
    const review = () =>
      fireEvent.press(
        screen.getByRole("button", { name: recovery.reviewFullLocalReset }),
      )
    await review()
    expect(
      screen.getByText(recovery.thisReplacesAllLocalPlayerDataIncluding),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.cancel }),
    )
    expect(storage.values.get(key)).toBe(invalid)
    await review()
    await fireEvent.press(
      screen.getByRole("button", { name: recovery.resetAllLocalPlayerData2 }),
    )
    expect(
      await screen.findByRole("button", { name: copy.introduction.start }),
    ).toBeOnTheScreen()
    expect(storage.values.get(key)).not.toBe(invalid)
  })

  it("offers the last verified native save and restores it only when chosen", async () => {
    const storage = new InMemoryAsyncStorage()
    const key = MAPACHESS_ASYNC_STORAGE_NAMESPACE + "/current"
    const profile = await openNativeProfileRuntime({ storage })
    await waitFor(() =>
      expect(profile.actor.getSnapshot().matches("ready")).toBe(true),
    )
    profile.actor.send({ type: "PROFILE.INTRODUCTION_COMPLETED", locale: "en" })
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(profile.actor.getSnapshot())
          ?.introductionCompleted,
      ).toBe(true),
    )
    const accepted = selectCurrentPlayerData(profile.actor.getSnapshot())
    await profile.close()
    const verified = storage.values.get(key)
    if (verified === undefined)
      throw new Error("Expected a verified save on disk")
    storage.values.set(
      MAPACHESS_ASYNC_STORAGE_NAMESPACE + "/last-known-good",
      verified,
    )
    storage.values.set(key, "corrupt-newer-revision")
    application = await actualOpen({ profile: { storage } })
    openApplication.mockResolvedValue(application)
    await render(<HomeScreen />)
    const restore = await screen.findByRole("button", {
      name: copy.interface.profileRecoveryPanel.restoreLastKnownGoodSave,
    })
    expect(storage.values.get(key)).toBe("corrupt-newer-revision")
    await fireEvent.press(restore)
    expect(
      await screen.findByRole("button", {
        name: copy.setup.presentations.standard.story.title,
      }),
    ).toBeOnTheScreen()
    const recovered = selectCurrentPlayerData(
      application.profile.actor.getSnapshot(),
    )
    expect(recovered).toMatchObject({
      introductionCompleted: true,
      ratings: accepted?.ratings,
      storyProgress: accepted?.storyProgress,
    })
  })

  it("accepts an earned Story backup and uses its unlocked animal without changing the recorded win", async () => {
    const runtime = await readyApplication()
    await render(<HomeScreen />)
    await screen.findByRole("button", {
      name: copy.setup.presentations.standard.story.title,
    })
    const earned = [
      { opponentId: "chicken-stockfish", highestMedal: "silver" },
    ] as const
    const rawBackup = await createMapachessPortableBackup({
      applicationVersion: "test",
      gddRevision: "test",
      playerData: {
        ...createInitialPlayerData(),
        introductionCompleted: true,
        storyProgress: { standard: earned, chess960: [] },
      },
      sha256: cryptography.sha256,
    })
    await act(() =>
      runtime.profile.actor.send({
        type: "PROFILE.IMPORT_PREVIEW_REQUESTED",
        rawBackup,
      }),
    )
    const preview = copy.interface.profileImportPreviewPanel
    await fireEvent.press(
      await screen.findByRole("button", {
        name: preview.replaceLocalPlayerData,
      }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(runtime.profile.actor.getSnapshot())
          ?.storyProgress.standard,
      ).toEqual(earned),
    )
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.setup.presentations.standard.story.title,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: new RegExp(`^${copy.interface.playerAnimalChoices.playAs}:`),
      }),
    )
    expect(
      screen.getByRole("button", {
        name: copy.animals.names["bunny-stockfish"],
      }),
    ).toBeDisabled()
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.animals.names["chicken-stockfish"],
      }),
    )
    await fireEvent.press(screen.getByRole("button", { name: copy.setup.done }))
    const accepted = () =>
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot())
    await waitFor(() =>
      expect(accepted()?.appearance.animal).toBe("chicken-stockfish"),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: new RegExp(`^${copy.setup.opponent}:`),
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.animals.opponent("chicken-stockfish"),
      }),
    )
    await fireEvent.press(screen.getByRole("button", { name: copy.setup.done }))
    await fireEvent.press(
      screen.getByRole("button", {
        name: new RegExp(`^${copy.setup.betterHints}:`),
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.setup.autoHints["no-auto-hints"].label,
      }),
    )
    await fireEvent.press(screen.getByRole("button", { name: copy.setup.done }))
    await waitFor(() =>
      expect(accepted()?.settings.autoHintMode).toBe("no-auto-hints"),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.startMatch }),
    )
    await waitFor(() =>
      expect(accepted()?.activeMatch?.opponentId).toBe("chicken-stockfish"),
    )
    expect(accepted()?.storyProgress.standard).toEqual(earned)
  })

  it("routes native hardware menu, controls, history and both hint stages through the real game", async () => {
    const runtime = await readyApplication()
    runtime.profile.actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "no-auto-hints",
    })
    await waitFor(() =>
      expect(runtime.profile.actor.getSnapshot().matches("ready")).toBe(true),
    )
    await render(<HomeScreen />)
    const start = await screen.findByRole("button", {
      name: copy.setup.presentations.standard.story.title,
    })
    const key = async (code: string) => {
      const receive = mockHardwareInput
      if (receive === undefined)
        throw new Error("Expected native hardware event subscription")
      await act(() =>
        receive({ kind: "keyboard", code, pressed: true, repeat: false }),
      )
    }
    await key("KeyM")
    expect(
      screen.getByRole("header", { name: copy.profile.settingsTitle }),
    ).toBeOnTheScreen()
    await key("Escape")
    await key("KeyC")
    expect(
      screen.getByRole("header", {
        name: copy.interface.inputBindingSettings.controls,
      }),
    ).toBeOnTheScreen()
    await key("Escape")
    await key("Escape")
    await fireEvent.press(start)
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.startMatch }),
    )
    await waitFor(() =>
      expect(runtime.game().actor.getSnapshot().matches("active")).toBe(true),
    )
    const session = runtime.game().actor.getSnapshot().context.session
    if (session === null) throw new Error("Expected a match")
    await waitFor(() =>
      expect(selectHintStage(session.actor.getSnapshot())).toBe("ready"),
    )
    await key("KeyH")
    await waitFor(() =>
      expect(selectHintStage(session.actor.getSnapshot())).toBe("piece-hints"),
    )
    await key("KeyH")
    await waitFor(() =>
      expect(selectHintStage(session.actor.getSnapshot())).toBe("move-hints"),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.shared.settingsControls.explainAutoHints,
      }),
    )
    expect(
      screen.getByText(
        copy.gameplay.hints.eligibility(
          copy.shared.story.medals.bronze,
          copy.shared.medalHintUse.bronze,
        ),
      ),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.shared.settingsControls.close }),
    )
    const timeline = () => selectMatchTimeline(session.actor.getSnapshot())
    const before = timeline().cursor
    const white = session.match.playerColor === "white"
    await fireEvent.press(
      screen.getByRole("button", { name: new RegExp(`^e${white ? 2 : 7},`) }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: new RegExp(`^e${white ? 4 : 5},.*legal destination`),
      }),
    )
    await waitFor(() => expect(timeline().cursor).toBeGreaterThan(before))
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: new RegExp(`^${copy.interface.matchCommands.undo}`),
        }),
      ).toBeEnabled(),
    )
    await key("KeyZ")
    await waitFor(() => expect(timeline().cursor).toBe(before))
    await key("KeyY")
    await waitFor(() => expect(timeline().cursor).toBeGreaterThan(before))
    const first = timeline().transitions[0]
    if (first === undefined) throw new Error("Expected a played move")
    await key("KeyM")
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.interface.webMatch.matchDetailsMoveHistory,
      }),
    )
    expect(
      screen.getByText(formatMatchMoveNotation(first.move)),
    ).toBeOnTheScreen()
    await key("Escape")
    expect(
      screen.getByRole("header", {
        name: copy.interface.matchCommands.matchMenu,
      }),
    ).toBeOnTheScreen()
    await key("Escape")
    await fireEvent.press(
      screen.getByRole("button", {
        name: new RegExp(`^${copy.gameplay.hints.autoLabel}`),
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.setup.autoHints["auto-piece-hints"].label,
      }),
    )
    await fireEvent.press(screen.getByRole("button", { name: copy.setup.done }))
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.settings
          .autoHintMode,
      ).toBe("auto-piece-hints"),
    )
    await key("KeyM")
    expect(
      screen.getByRole("header", {
        name: copy.interface.matchCommands.matchMenu,
      }),
    ).toBeOnTheScreen()
    await key("Escape")
    expect(
      screen.queryByRole("header", {
        name: copy.interface.matchCommands.matchMenu,
      }),
    ).toBeNull()
    expect(runtime.game().actor.getSnapshot().context.session).toBe(session)
    await key("KeyM")
    await fireEvent.press(
      screen.getByRole("button", { name: copy.interface.webGame.settings }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.setup.autoHints["no-auto-hints"].label,
      }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.settings
          .autoHintMode,
      ).toBe("no-auto-hints"),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.shared.settingsControls.close }),
    )
    const replay = screen.getByRole("button", {
      name: copy.interface.webGame.restartMatch,
    })
    await fireEvent.press(replay)
    await waitFor(() => {
      const snapshot = runtime.game().actor.getSnapshot()
      expect(snapshot.matches("active")).toBe(true)
      expect(snapshot.context.session).not.toBe(session)
    })
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

  it("commits an accepted appearance and its selected card-rating context together", async () => {
    const storage = new InMemoryAsyncStorage()
    const runtime = await readyApplication({ storage })
    const read = () =>
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot())
    const before = read()
    await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", { name: copy.setup.customizeProfile }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.gameplay.clock.category.blitz }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.shared.story.medals.silver }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.profile.dressing.categories.Weapons,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.profile.dressing.weapons.weapon5,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.profile.dressing.weaponColor(
          copy.profile.dressing.weapons.weapon5,
          4,
        ),
      }),
    )
    expect(read()).toEqual(before)
    const writes = jest
      .spyOn(storage, "multiSet")
      .mockRejectedValueOnce(new Error("Appearance write interrupted"))
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.interface.profileCardJourney.saveAppearance,
      }),
    )
    expect(
      await screen.findByText(
        copy.interface.profileDressingRoom.appearanceCouldNotBeSavedLocallyYour,
      ),
    ).toBeOnTheScreen()
    expect(read()).toEqual(before)
    await fireEvent.press(
      screen.getByRole("button", { name: copy.interface.webGame.retry }),
    )
    await waitFor(() =>
      expect(read()).toMatchObject({
        appearance: { weapon: "weapon5_c4" },
        settings: {
          cardRatingContext: { category: "blitz", assistance: "silver" },
        },
      }),
    )
    expect(read()?.ratings).toEqual(before?.ratings)
    expect(writes).toHaveBeenCalledTimes(2)
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

  it("keeps Settings reachable after saving a keyboard remap and visiting the chess reference panels", async () => {
    const runtime = await readyApplication()
    await render(<HomeScreen />)
    const press = async (name: string) => {
      await fireEvent.press(await screen.findByRole("button", { name }))
    }
    await press(copy.interface.webGame.settings)
    await press(copy.interface.inputBindingSettings.controls)
    await press(
      `${copy.controls.devices.keyboard}: ${keyboardBindingLabel("KeyH", copy.controls.keys)}`,
    )
    const receive = mockHardwareInput
    if (receive === undefined)
      throw new Error("Expected the hardware input subscription")
    await act(() =>
      receive({ kind: "keyboard", code: "KeyQ", pressed: true, repeat: false }),
    )
    await press(copy.interface.inputBindingSettings.saveControls)
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.settings
          .inputBindings.keyboard.hints,
      ).toBe("KeyQ"),
    )

    const classification =
      copy.interface.moveClassificationFaq.howAreMovesClassified
    const elo = copy.interface.profileSettingsPanel.aboutEloRatings
    for (const title of [classification, elo]) {
      await press(title)
      expect(screen.getByRole("header", { name: title })).toBeOnTheScreen()
      if (title === elo)
        expect(
          screen.getByText(copy.setup.webCalibrationDifficulty),
        ).toBeOnTheScreen()
      await press(copy.shared.settingsControls.back)
      expect(
        screen.getByRole("header", { name: copy.profile.settingsTitle }),
      ).toBeOnTheScreen()
    }
    await press(copy.shared.settingsControls.close)
    expect(
      screen.getByRole("button", {
        name: copy.setup.presentations.standard.story.title,
      }),
    ).toBeEnabled()
  })

  it("saves coach, pieces, board and hint preferences through the native Settings controls", async () => {
    const runtime = await readyApplication()
    await render(<HomeScreen />)
    const press = async (name: string | RegExp) => {
      await fireEvent.press(await screen.findByRole("button", { name }))
    }
    const expectSettings = async (
      settings: Partial<MapachessPlayerData["settings"]>,
    ) => {
      await waitFor(() => {
        const snapshot = runtime.profile.actor.getSnapshot()
        expect(snapshot.matches("ready")).toBe(true)
        expect(selectCurrentPlayerData(snapshot)?.settings).toMatchObject(
          settings,
        )
      })
    }
    const { customization } = copy.profile
    await press(copy.interface.webGame.settings)
    await press(customization.coach.change)
    await press(copy.profile.coachCollections.greyfox)
    await press(copy.setup.cancel)
    await expectSettings({ coachCollection: "mapachito" })

    await press(customization.coach.change)
    await press(copy.profile.coachCollections.greyfox)
    await press(copy.setup.done)
    await expectSettings({ coachCollection: "greyfox" })

    await press(customization.pieces.change)
    await press(copy.artwork.pieces["toffee-wood"])
    await press(copy.setup.done)
    await expectSettings({
      chessAppearance: { boardId: "current", pieceSetId: "toffee-wood" },
    })

    await press(new RegExp(`^${customization.board.change}:`))
    await press(copy.artwork.boards["toffee-ice"])
    await press(copy.setup.done)
    await expectSettings({
      chessAppearance: { boardId: "toffee-ice", pieceSetId: "toffee-wood" },
    })

    await press(copy.shared.settingsControls.explainAutoHints)
    await press(copy.shared.settingsControls.close)
    await press(copy.setup.autoHints["auto-piece-hints"].label)
    await expectSettings({ autoHintMode: "auto-piece-hints" })
    await press(copy.profile.moveReactionPlacement.options.bottom)
    await expectSettings({ moveReactionPlacement: "bottom" })
    await press(copy.shared.settingsControls.close)
    expect(
      screen.queryByRole("header", { name: copy.profile.settingsTitle }),
    ).toBeNull()
  })

  it("keeps native rating resets scoped to the selected variant, time and medal", async () => {
    const runtime = await readyApplication()
    await render(<HomeScreen />)
    const before = selectCurrentPlayerData(runtime.profile.actor.getSnapshot())
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.interface.webGame.settings,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.gameplay.clock.category.bullet }),
    )
    const label = copy.gameplay.clock.rating(
      copy.setup.variants.standard,
      copy.gameplay.clock.category.bullet,
      copy.shared.story.medals.bronze,
    )
    const openFirstReset = async () => {
      const reset = screen.getAllByRole("button", {
        name: copy.profile.resetAction,
      })[0]
      if (reset === undefined) throw new Error("Expected a Bullet rating reset")
      await fireEvent.press(reset)
    }
    await openFirstReset()
    expect(
      screen.getByRole("header", { name: copy.profile.resetQuestion(label) }),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.cancel }),
    )
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot()),
    ).toEqual(before)
    await openFirstReset()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.profile.resetSubmit }),
    )
    await waitFor(() =>
      expect(runtime.profile.actor.getSnapshot().matches("ready")).toBe(true),
    )
    expect(
      selectCurrentPlayerData(runtime.profile.actor.getSnapshot())?.ratings,
    ).toEqual(before?.ratings)
    expect(
      screen.getByRole("header", { name: copy.profile.settingsTitle }),
    ).toBeOnTheScreen()
  })

  it("offers recovery after a saved match fails to open, then resumes the same accepted position", async () => {
    const storage = new InMemoryAsyncStorage()
    const first = await readyApplication({ storage })
    const screenBeforeRestart = await render(<HomeScreen />)
    await fireEvent.press(
      await screen.findByRole("button", {
        name: copy.setup.presentations.standard.story.title,
      }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.startMatch }),
    )
    await screen.findByRole("button", {
      name: copy.interface.matchCommands.menu,
    })
    const before = selectCurrentPlayerData(first.profile.actor.getSnapshot())
    if (before?.activeMatch == null) throw new Error("Expected a durable match")
    await screenBeforeRestart.unmount()
    await first.close()

    const bridge = new NativeEngineFixture()
    bridge.bootFailure = {
      ordinal: 1,
      error: new Error("Engine not ready after restart"),
    }
    const reopened = await readyApplication({ storage, bridge })
    await render(<HomeScreen />)
    expect(await screen.findByRole("alert")).toHaveTextContent(
      copy.presentation.sessionFailure["open-current-match"],
    )
    expect(
      screen.getByRole("button", {
        name: copy.interface.profileSettingsPanel.exportPlayerData,
      }),
    ).toBeEnabled()
    expect(
      selectCurrentPlayerData(reopened.profile.actor.getSnapshot()),
    ).toEqual(before)
    await fireEvent.press(
      screen.getByRole("button", { name: copy.interface.webGame.retry }),
    )
    expect(
      await screen.findByRole("button", {
        name: copy.interface.matchCommands.menu,
      }),
    ).toBeEnabled()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(reopened.game().actor.getSnapshot().context.session?.match).toEqual(
      before.activeMatch,
    )
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
