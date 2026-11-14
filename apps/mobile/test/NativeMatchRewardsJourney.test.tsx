import "@/test/nativeUiEnvironment"
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
import {
  AccessibilityInfo,
  AppState,
  BackHandler,
  type AppStateStatus,
} from "react-native"
import loadCatalog from "@mapachess/localization/catalog"
import type { MatchMode } from "@mapachess/match/durable-match-record"
import type { MatchOpponent } from "@mapachess/match/match-machine"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import {
  TIME_CONTROL_PRESETS,
  timeControlLabel,
} from "@mapachess/match/time-control"
import SerializedPlayerDataStore from "@mapachess/profile/durable-store"
import createInitialPlayerData from "@mapachess/profile/player-data"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import openNativeStockfishSession from "@mapachess/stockfish-native/open-session"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import HomeScreen from "@/app/index"
import openNativeApplicationRuntime, {
  type NativeApplicationRuntime,
} from "@/lib/gameplay/openNativeApplicationRuntime"
import openNativeMatchRuntime from "@/lib/gameplay/openNativeMatchRuntime"
import AsyncStorageDurableStore from "@/lib/profile/AsyncStorageDurableStore"
import cryptography from "@/test/nativeCryptographyFixture"
import NativeEngineFixture from "@/test/nativeEngineFixture"
import InMemoryAsyncStorage from "@/test/nativeStorageFixture"

jest.mock("expo-font", () => ({ useFonts: () => [true, null] }))
jest.mock("@/lib/gameplay/openNativeApplicationRuntime", () => ({
  __esModule: true,
  default: jest.fn(),
}))

const actualOpen = jest.requireActual<
  typeof import("@/lib/gameplay/openNativeApplicationRuntime")
>("@/lib/gameplay/openNativeApplicationRuntime").default
const copy = loadCatalog("en")
const reviewBoard = copy.interface.matchCelebration.reviewBoard
const viewRewards = copy.interface.webMatch.viewRewards
const stageLabel = copy.interface.reactiveBattleStage.reactiveBattleStage
const savedLocally = copy.interface.matchSaveConfirmation.savedLocally
const originalAppState = AppState.currentState
let application: NativeApplicationRuntime | undefined

beforeEach(() => {
  AppState.currentState = "active"
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})

afterEach(async () => {
  AppState.currentState = originalAppState
  jest.useRealTimers()
  await application?.close()
  application = undefined
})

function playerData(runtime: NativeApplicationRuntime) {
  const data = selectCurrentPlayerData(runtime.profile.actor.getSnapshot())
  if (data === null) throw new Error("Expected an accepted native profile.")
  return data
}

async function openApplication(
  storage: InMemoryAsyncStorage,
  storyOpponent?: MatchOpponent,
) {
  const bridge = new NativeEngineFixture()
  const runtime = await actualOpen({
    profile: { storage },
    game: {
      openRuntime: async (input) => {
        const runtime = await openNativeMatchRuntime({
          ...input,
          cryptography,
          ...(storyOpponent === undefined
            ? {}
            : {
                matchSeed: parseDeterministicRandomSeed(
                  "00000000000000000000000000000001",
                  "Native Story checkmate",
                ),
              }),
          openSession: (configuration) =>
            openNativeStockfishSession(configuration, bridge),
        })
        return storyOpponent === undefined
          ? runtime
          : { ...runtime, opponent: storyOpponent }
      },
      activity: { isActive: () => true, subscribe: () => () => undefined },
    },
  })
  application = runtime
  await waitFor(() =>
    expect(runtime.profile.actor.getSnapshot().matches("ready")).toBe(true),
  )
  if (!playerData(runtime).introductionCompleted) {
    runtime.profile.actor.send({
      type: "PROFILE.INTRODUCTION_COMPLETED",
      locale: "en",
    })
    await waitFor(() =>
      expect(playerData(runtime).introductionCompleted).toBe(true),
    )
  }
  jest.mocked(openNativeApplicationRuntime).mockResolvedValue(runtime)
  return runtime
}

async function pressButton(name: string | RegExp): Promise<void> {
  await fireEvent.press(await screen.findByRole("button", { name }))
}

async function startStory(): Promise<void> {
  await pressButton(copy.setup.presentations.standard.story.title)
  await pressButton(copy.setup.startMatch)
  await screen.findByLabelText(stageLabel)
}

async function resign(): Promise<void> {
  await pressButton(copy.interface.matchCommands.menu)
  await pressButton(copy.interface.matchCommands.resign)
}

function expectNoCelebration(): void {
  expect(screen.queryByRole("button", { name: reviewBoard })).toBeNull()
  expect(screen.queryByLabelText(savedLocally)).toBeNull()
}

async function setAppState(state: AppStateStatus): Promise<void> {
  await act(() => {
    AppState.currentState = state
    for (const [type, listener] of jest.mocked(AppState.addEventListener).mock
      .calls)
      if (type === "change") listener(state)
  })
}

function expectResultAction(mode: MatchMode, elo: number): void {
  const target = copy.gameplay.opponentAndElo(
    copy.animals.opponent("chicken-stockfish"),
    elo,
  )
  expect(
    screen.getByRole("button", {
      name: `${copy.gameplay.resultActions.replay} ${target}`,
    }),
  ).toBeOnTheScreen()
  if (mode === "challenge") {
    expect(
      screen.queryByRole("button", {
        name: new RegExp(copy.gameplay.resultActions.next),
      }),
    ).toBeNull()
  }
}

async function storageNearLevelAchievement() {
  const storage = new InMemoryAsyncStorage()
  const store = new SerializedPlayerDataStore(
    new AsyncStorageDurableStore(storage),
    cryptography.sha256,
  )
  const seeded = await store.commitCurrent(await store.load(), {
    ...createInitialPlayerData(),
    totalXp: 4,
    introductionCompleted: true,
  })
  if (!seeded.ok) throw new Error("Expected a valid accepted Level fixture")
  return storage
}

describe("native accepted rewards", () => {
  it("announces an accepted Level unlock after dismissal without repeating it on replay, Undo/Redo, or resume", async () => {
    const storage = await storageNearLevelAchievement()
    const runtime = await openApplication(storage)
    const view = await render(<HomeScreen />)
    await startStory()
    await resign()
    await screen.findByRole("button", { name: reviewBoard })
    const notice = copy.gameplay.achievementUnlocked(
      copy.gameplay.levelAchievement(5),
    )
    expect(
      playerData(runtime).lastAcceptedResultReward?.unlockedAchievementIds,
    ).toEqual(["reach-level-5"])
    expect(screen.getAllByText(notice)).toHaveLength(1)
    const accepted = playerData(runtime)
    const writes = jest.spyOn(storage, "multiSet")
    jest.useFakeTimers()
    await pressButton(reviewBoard)
    expect(screen.getByText(notice)).toBeOnTheScreen()
    await act(async () => jest.advanceTimersByTimeAsync(4_000))
    await pressButton(viewRewards)
    expect(screen.queryByText(notice)).toBeNull()
    await act(async () => jest.advanceTimersByTimeAsync(10_000))
    await pressButton(reviewBoard)
    expect(screen.getByText(notice)).toBeOnTheScreen()
    await act(async () => jest.advanceTimersByTimeAsync(5_000))
    expect(screen.queryByText(notice)).toBeNull()
    await pressButton(viewRewards)
    await pressButton(reviewBoard)
    expect(screen.queryByText(notice)).toBeNull()
    expect(playerData(runtime)).toEqual(accepted)
    expect(writes).not.toHaveBeenCalled()
    jest.useRealTimers()
    await pressButton(copy.interface.matchCommands.undo)
    await waitFor(() =>
      expect(playerData(runtime).activeMatch?.conclusion).toBeNull(),
    )
    await pressButton(copy.interface.matchCommands.redo)
    await pressButton(reviewBoard)
    expect(playerData(runtime).unlockedAchievementIds).toContain(
      "reach-level-5",
    )
    expect(
      playerData(runtime).lastAcceptedResultReward?.unlockedAchievementIds,
    ).toEqual([])
    expect(screen.queryByText(notice)).toBeNull()
    await view.unmount()
    await runtime.close()
    await openApplication(storage)
    await render(<HomeScreen />)
    await screen.findByRole("button", { name: viewRewards })
    expect(screen.queryByText(notice)).toBeNull()
  })

  it("awards Gold for an unassisted Story checkmate and opens the newly unlocked opponent", async () => {
    const replies = ["e7e5", "a7a6", "b7b6"]
    const runtime = await openApplication(new InMemoryAsyncStorage(), {
      async selectMove({ legalMoves }) {
        const reply = replies.shift()
        const move = legalMoves.find(({ id }) => id === reply)
        if (move === undefined) throw new Error(`Expected legal reply ${reply}`)
        return move.id
      },
    })
    runtime.profile.actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "no-auto-hints",
    })
    await waitFor(() =>
      expect(playerData(runtime).settings.autoHintMode).toBe("no-auto-hints"),
    )
    await render(<HomeScreen />)
    await startStory()
    const stage = screen.getByLabelText(stageLabel)
    const move = async (from: string, to: string, cursor: number) => {
      const fromSquare = new RegExp(`^${from},`)
      await waitFor(() =>
        expect(screen.getByRole("button", { name: fromSquare })).toBeEnabled(),
      )
      await pressButton(fromSquare)
      await pressButton(new RegExp(`^${to},`))
      await waitFor(() =>
        expect(playerData(runtime).activeMatch?.cursor).toBe(cursor),
      )
    }
    await move("e2", "e4", 2)
    await move("f1", "c4", 4)
    await move("d1", "h5", 6)
    await move("h5", "f7", 7)

    const next = new RegExp(`^${copy.gameplay.resultActions.next}`)
    expect(await screen.findByRole("button", { name: next })).toBeEnabled()
    expect(screen.getByLabelText(stageLabel)).toBe(stage)
    const accepted = playerData(runtime)
    expect(accepted.activeMatch?.conclusion).toEqual({
      type: "checkmate",
      winner: "white",
    })
    expect(accepted.lastAcceptedResultReward?.ratedElo?.assistance).toBe("gold")
    expect(screen.getByText(copy.shared.story.medals.gold)).toBeOnTheScreen()
    await pressButton(reviewBoard)
    expect(screen.getByText(copy.shared.story.medals.gold)).toBeOnTheScreen()
    await pressButton(viewRewards)
    await pressButton(next)
    const bunny = STOCKFISH_OPPONENTS.find(({ id }) => id === "bunny-stockfish")
    if (bunny === undefined)
      throw new Error("Expected Bunny in the Story roster")
    expect(
      await screen.findByText(
        copy.gameplay.opponentAndElo(
          copy.animals.opponent(bunny.id),
          bunny.storyTargetElo,
        ),
      ),
    ).toBeOnTheScreen()
    expect(playerData(runtime).totalXp).toBe(accepted.totalXp)
  })

  it("withholds reward facts during a pending and failed write, then presents the retry once", async () => {
    const storage = await storageNearLevelAchievement()
    const notice = copy.gameplay.achievementUnlocked(
      copy.gameplay.levelAchievement(5),
    )
    const runtime = await openApplication(storage)
    await render(<HomeScreen />)
    await startStory()
    const writeGate = Promise.withResolvers<void>()
    const writes = jest
      .spyOn(storage, "multiSet")
      .mockImplementationOnce(async () => {
        await writeGate.promise
        throw new Error("The test could not write local storage.")
      })
    try {
      await resign()
      await waitFor(() => expect(writes).toHaveBeenCalledTimes(1))
      expect(playerData(runtime).lastAcceptedResultReward).toBeNull()
      expectNoCelebration()
      expect(screen.queryByText(notice)).toBeNull()
    } finally {
      await act(() => writeGate.resolve())
    }

    expect(
      await screen.findByRole("header", {
        name: copy.interface.localSaveError.localSaveError,
      }),
    ).toBeOnTheScreen()
    expectNoCelebration()
    expect(screen.queryByText(notice)).toBeNull()
    await pressButton(copy.interface.profilePersistenceFailurePanel.retrySave)
    expect(
      await screen.findByRole("button", { name: reviewBoard }),
    ).toBeOnTheScreen()
    const receipt = playerData(runtime).lastAcceptedResultReward
    expect(receipt?.awardedXp).toBe(4)
    expect(writes).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText(savedLocally)).toBeOnTheScreen()
    expect(await screen.findByText(copy.gameplay.level(5))).toBeOnTheScreen()
    expect(
      screen.getByRole("progressbar", {
        name: copy.gameplay.levelProgress(5, 0, 2),
      }),
    ).toBeOnTheScreen()
    expectResultAction("story", 100)
    await pressButton(reviewBoard)
    expectNoCelebration()
    expect(screen.getByText(notice)).toBeOnTheScreen()
    expect(playerData(runtime).lastAcceptedResultReward).toEqual(receipt)
    expect(writes).toHaveBeenCalledTimes(2)
  })

  it("keeps one Stage and replays normal-motion XP without writing, then restores focus after Back", async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(false)
    const back = jest.spyOn(BackHandler, "addEventListener")
    const storage = new InMemoryAsyncStorage()
    const runtime = await openApplication(storage)
    await render(<HomeScreen />)
    await startStory()
    const stage = screen.getByLabelText(stageLabel)
    jest.useFakeTimers()
    await resign()
    const review = await screen.findByRole("button", { name: reviewBoard })
    expect(review.props.className).toContain("outline-mapachito-orange")
    expect(screen.getByLabelText(stageLabel)).toBe(stage)
    expect(screen.getByText(copy.gameplay.level(1))).toBeOnTheScreen()
    await setAppState("background")
    await act(async () => jest.advanceTimersByTimeAsync(3_800))
    expect(screen.getByText(copy.gameplay.level(1))).toBeOnTheScreen()
    expect(screen.getByRole("button", { name: reviewBoard })).toBeOnTheScreen()
    await setAppState("active")
    await act(async () => jest.advanceTimersByTimeAsync(3_800))
    expect(screen.getByText(copy.gameplay.level(3))).toBeOnTheScreen()
    expect(screen.getByLabelText(savedLocally)).toBeOnTheScreen()
    await act(async () => jest.advanceTimersByTimeAsync(1_300))
    expect(screen.queryByLabelText(savedLocally)).toBeNull()
    await pressButton(reviewBoard)
    expect(screen.getByLabelText(stageLabel)).toBe(stage)
    const accepted = playerData(runtime)
    const writes = jest.spyOn(storage, "multiSet")

    await pressButton(viewRewards)
    expect(
      await screen.findByRole("button", { name: reviewBoard }),
    ).toBeOnTheScreen()
    expect(screen.queryByRole("button", { name: viewRewards })).toBeNull()
    expect(screen.getByLabelText(stageLabel)).toBe(stage)
    expect(screen.getByText(copy.gameplay.level(1))).toBeOnTheScreen()
    expect(screen.queryByLabelText(savedLocally)).toBeNull()
    expect(
      runtime.game().actor.getSnapshot().context.rewardsReplaySequence,
    ).toBe(1)
    expect(playerData(runtime)).toEqual(accepted)
    expect(writes).not.toHaveBeenCalled()

    const handleBack = back.mock.calls.findLast(
      ([event]) => event === "hardwareBackPress",
    )?.[1]
    if (handleBack === undefined)
      throw new Error("The native Back handler was not registered.")
    await act(() =>
      expect(
        handleBack({ type: "hardwareBackPress", timeStamp: performance.now() }),
      ).toBe(true),
    )
    expectNoCelebration()
    expect(screen.getByLabelText(stageLabel)).toBe(stage)
    expect(
      screen.getByRole("button", { name: viewRewards }).props.className,
    ).toContain("outline-mapachito-orange")
    expect(writes).not.toHaveBeenCalled()
  })

  it("resumes a completed match without auto-replay, removes the result on Undo and uses the Redo receipt", async () => {
    const storage = new InMemoryAsyncStorage()
    const first = await openApplication(storage)
    const view = await render(<HomeScreen />)
    await startStory()
    await resign()
    await pressButton(reviewBoard)
    const accepted = playerData(first).lastAcceptedResultReward
    await view.unmount()
    await first.close()

    const resumed = await openApplication(storage)
    await render(<HomeScreen />)
    expect(
      await screen.findByRole("button", { name: viewRewards }),
    ).toBeOnTheScreen()
    expectNoCelebration()
    await act(() =>
      resumed.game().actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" }),
    )
    await pressButton(new RegExp(copy.interface.webGame.resumeMatch))
    expect(
      await screen.findByRole("button", { name: viewRewards }),
    ).toBeOnTheScreen()
    expectNoCelebration()
    expect(playerData(resumed).lastAcceptedResultReward).toEqual(accepted)
    await pressButton(copy.interface.matchCommands.undo)
    await waitFor(() =>
      expect(playerData(resumed).activeMatch?.conclusion).toBeNull(),
    )
    expect(screen.queryByRole("button", { name: viewRewards })).toBeNull()
    await pressButton(copy.interface.matchCommands.redo)
    expect(
      await screen.findByRole("button", { name: reviewBoard }),
    ).toBeOnTheScreen()
    expect(playerData(resumed).totalXp).toBe(4)
    expect(playerData(resumed).lastAcceptedResultReward?.awardedXp).toBe(4)
  })

  it("keeps accepted rewards dismissible during an unrelated profile save", async () => {
    const storage = new InMemoryAsyncStorage()
    const runtime = await openApplication(storage)
    await render(<HomeScreen />)
    await startStory()
    await resign()
    const review = await screen.findByRole("button", { name: reviewBoard })
    const receipt = playerData(runtime).lastAcceptedResultReward
    const placement = playerData(runtime).settings.moveReactionPlacement
    const save = storage.multiSet.bind(storage)
    const pending = Promise.withResolvers<void>()
    const writes = jest
      .spyOn(storage, "multiSet")
      .mockImplementationOnce(async (entries) => {
        await pending.promise
        await save(entries)
      })
    try {
      await act(() =>
        runtime.profile.actor.send({
          type: "PROFILE.MOVE_REACTION_PLACEMENT_CHANGED",
          placement: placement === "bottom" ? "top" : "bottom",
        }),
      )
      await waitFor(() => expect(writes).toHaveBeenCalledTimes(1))
      expect(screen.getByRole("button", { name: reviewBoard })).toBe(review)
      expect(
        screen.getByRole("button", {
          name: new RegExp(copy.gameplay.resultActions.replay),
        }),
      ).toBeDisabled()
      await pressButton(reviewBoard)
      expectNoCelebration()
    } finally {
      await act(() => pending.resolve())
    }
    await waitFor(() =>
      expect(runtime.profile.actor.getSnapshot().matches("ready")).toBe(true),
    )
    expectNoCelebration()
    expect(screen.getByRole("button", { name: viewRewards })).toBeEnabled()
    expect(playerData(runtime).lastAcceptedResultReward).toEqual(receipt)
  })

  it("retains the actual timed Challenge target for Replay opponent without Story advancement", async () => {
    const runtime = await openApplication(new InMemoryAsyncStorage())
    await render(<HomeScreen />)
    await pressButton(copy.setup.presentations.standard.challenge.title)
    const targetElo = 175
    const timeControl = TIME_CONTROL_PRESETS[1].control
    await act(() =>
      runtime.game().actor.send({
        type: "MATCH_SESSION.MATCH_REQUESTED",
        setup: {
          mode: "challenge",
          timeControl,
          challengeSetup: {
            variant: "standard",
            chess960PositionId: null,
            opponentId: "chicken-stockfish",
            playerColor: "white",
            difficultyTargetElo: targetElo,
          },
        },
      }),
    )
    await screen.findByLabelText(stageLabel)
    await resign()
    expect(
      await screen.findByRole("button", { name: reviewBoard }),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(timeControlLabel(timeControl, copy.gameplay.clock)),
    ).toBeOnTheScreen()
    expectResultAction("challenge", targetElo)
    await pressButton(reviewBoard)
    expectResultAction("challenge", targetElo)
  })
})
