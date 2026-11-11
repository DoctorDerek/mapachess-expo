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
import { getRandomValues } from "expo-crypto"
import { AccessibilityInfo, AppState, type AppStateStatus } from "react-native"
import type { MatchSession } from "@mapachess/gameplay/match-session"
import loadCatalog from "@mapachess/localization/catalog"
import type { ShippedLocale } from "@mapachess/localization/locale"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import {
  MATCH_MODES,
  type MatchMode,
} from "@mapachess/match/durable-match-record"
import {
  selectIsPlayerTurn,
  selectMatchPosition,
  selectMatchTimeline,
} from "@mapachess/match/match-machine"
import {
  formatMatchMoveNotation,
  listLegalMatchMoves,
} from "@mapachess/match/match-move"
import {
  MATCH_VARIANTS,
  type MatchVariant,
} from "@mapachess/match/match-variant"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import openNativeStockfishSession from "@mapachess/stockfish-native/open-session"
import HomeScreen from "@/app/index"
import openNativeApplicationRuntime, {
  type NativeApplicationRuntime,
} from "@/lib/gameplay/openNativeApplicationRuntime"
import openNativeMatchRuntime, {
  type NativeMatchRuntime,
} from "@/lib/gameplay/openNativeMatchRuntime"
import cryptography from "./nativeCryptographyFixture"
import NativeEngineFixture from "./nativeEngineFixture"
import InMemoryAsyncStorage from "./nativeStorageFixture"

jest.mock("expo-font", () => ({ useFonts: () => [true, null] }))
jest.mock("@/lib/gameplay/openNativeApplicationRuntime", () => ({
  __esModule: true,
  default: jest.fn(),
}))
const actualOpen = jest.requireActual<
  typeof import("@/lib/gameplay/openNativeApplicationRuntime")
>("@/lib/gameplay/openNativeApplicationRuntime").default
const originalActivity = AppState.currentState
let application: NativeApplicationRuntime | undefined
beforeEach(() => {
  AppState.currentState = "active"
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.mocked(getRandomValues).mockImplementation((values) => {
    values.fill(1)
    return values
  })
})
afterEach(async () => {
  jest.useRealTimers()
  AppState.currentState = originalActivity
  await application?.close()
  application = undefined
})

function data(runtime: NativeApplicationRuntime) {
  const current = selectCurrentPlayerData(runtime.profile.actor.getSnapshot())
  if (current === null) throw new Error("Expected an accepted native profile")
  return current
}

async function open(
  variant: MatchVariant,
  mode: MatchMode,
  locale: ShippedLocale = "en",
) {
  const bridge = new NativeEngineFixture()
  const runtime = await actualOpen({
    profile: { storage: new InMemoryAsyncStorage() },
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
  application = runtime
  await waitFor(() =>
    expect(runtime.profile.actor.getSnapshot().matches("ready")).toBe(true),
  )
  runtime.profile.actor.send({ type: "PROFILE.INTRODUCTION_COMPLETED", locale })
  await waitFor(() => expect(data(runtime).introductionCompleted).toBe(true))
  jest.mocked(openNativeApplicationRuntime).mockResolvedValue(runtime)
  await render(<HomeScreen />)
  const copy = loadCatalog(locale)
  await fireEvent.press(
    await screen.findByRole("button", {
      name: copy.setup.presentations[variant][mode].title,
    }),
  )
  const layout = parseChess960PositionId(518)
  if (!layout.ok) throw new Error("Expected a valid Chess960 setup")
  await act(() =>
    runtime.game().actor.send({
      type: "MATCH_SESSION.MATCH_REQUESTED",
      setup:
        mode === "story"
          ? { mode, variant }
          : {
              mode,
              challengeSetup: {
                opponentId: "chicken-stockfish",
                difficultyTargetElo: 100,
                playerColor: "black",
                ...(variant === "standard"
                  ? { variant, chess960PositionId: null }
                  : { variant, chess960PositionId: layout.positionId }),
              },
            },
    }),
  )
  await waitFor(() =>
    expect(runtime.game().actor.getSnapshot().context.session).not.toBeNull(),
  )
  const session = runtime.game().actor.getSnapshot().context.session
  if (session === null) throw new Error("Expected the accepted native match")
  await waitFor(() =>
    expect(selectIsPlayerTurn(session.actor.getSnapshot())).toBe(true),
  )
  return { runtime, session, copy }
}

function currentReactionLabels(
  runtime: NativeApplicationRuntime,
  session: MatchSession<NativeMatchRuntime>,
  copy: ReturnType<typeof loadCatalog>,
) {
  const timeline = selectMatchTimeline(session.actor.getSnapshot())
  return (data(runtime).activeMatch?.moveFeedback ?? [])
    .filter(({ ply }) => ply > timeline.cursor - 2 && ply <= timeline.cursor)
    .map((record) => {
      const transition = timeline.transitions[record.ply - 1]
      if (transition === undefined)
        throw new Error("Expected classified move on the accepted timeline")
      return copy.board.dismissReaction(
        record.mover,
        formatMatchMoveNotation(transition.move),
        copy.shared.moveGrades[record.grade],
      )
    })
}

async function visibleReactionLabels(
  runtime: NativeApplicationRuntime,
  session: MatchSession<NativeMatchRuntime>,
  copy: ReturnType<typeof loadCatalog>,
) {
  await waitFor(() => {
    const labels = currentReactionLabels(runtime, session, copy)
    expect(labels).toHaveLength(2)
    for (const name of labels)
      expect(screen.getByRole("button", { name })).toBeOnTheScreen()
  })
  return currentReactionLabels(runtime, session, copy)
}

async function playOneMove(session: MatchSession<NativeMatchRuntime>) {
  const position = selectMatchPosition(session.actor.getSnapshot())
  const move = listLegalMatchMoves(position).find(
    (candidate) => candidate.kind === "normal" && candidate.promotion === null,
  )
  if (move === undefined)
    throw new Error("Expected an ordinary legal player move")
  await fireEvent.press(
    screen.getByRole("button", { name: new RegExp(`^${move.from},`) }),
  )
  await fireEvent.press(
    screen.getByRole("button", { name: new RegExp(`^${move.to},`) }),
  )
  return move
}

async function activity(state: AppStateStatus) {
  await act(() => {
    AppState.currentState = state
    for (const [event, listener] of jest.mocked(AppState.addEventListener).mock
      .calls)
      if (event === "change") listener(state)
  })
}

describe("native accepted move-feedback journeys", () => {
  it.each(
    MATCH_VARIANTS.flatMap((variant) =>
      MATCH_MODES.map((mode) => ({ variant, mode })),
    ),
  )(
    "presents accepted $variant $mode feedback without reclassifying or losing history on expiry",
    async ({ variant, mode }) => {
      const { runtime, session, copy } = await open(variant, mode)
      const startCursor = selectMatchTimeline(
        session.actor.getSnapshot(),
      ).cursor
      await playOneMove(session)
      await waitFor(() =>
        expect(
          data(runtime).activeMatch?.moveFeedback?.some(
            (record) => record.ply === startCursor + 2,
          ),
        ).toBe(true),
      )
      const timeline = selectMatchTimeline(session.actor.getSnapshot())
      const records =
        data(runtime).activeMatch?.moveFeedback?.filter(
          (record) => record.ply > startCursor,
        ) ?? []
      expect(records).toHaveLength(2)
      const labels = records.map((record) => {
        const transition = timeline.transitions[record.ply - 1]
        if (transition === undefined)
          throw new Error("Expected classified move on the accepted timeline")
        return copy.board.dismissReaction(
          record.mover,
          formatMatchMoveNotation(transition.move),
          copy.shared.moveGrades[record.grade],
        )
      })
      for (const name of labels)
        expect(await screen.findByRole("button", { name })).toBeOnTheScreen()
      expect(
        screen
          .getAllByRole("button")
          .map((card) => card.props.accessibilityLabel)
          .filter((name) => labels.includes(name)),
      ).toEqual(
        session.match.playerColor === records[0]?.mover
          ? labels
          : [...labels].reverse(),
      )
      const retained = data(runtime).activeMatch?.moveFeedback
      jest.useFakeTimers()
      for (const name of labels)
        await fireEvent(screen.getByRole("button", { name }), "layout", {
          nativeEvent: { layout: { x: 0, y: 0, width: 150, height: 48 } },
        })
      await act(async () => jest.advanceTimersByTimeAsync(5_000))
      for (const name of labels)
        expect(screen.queryByRole("button", { name })).toBeNull()
      expect(data(runtime).activeMatch?.moveFeedback).toEqual(retained)
    },
  )

  it("clears on menu boundaries without replaying or deleting classified history", async () => {
    const { runtime, session, copy } = await open(
      "standard",
      "challenge",
      "es-419",
    )
    await playOneMove(session)
    const firstLabels = await visibleReactionLabels(runtime, session, copy)
    const retained = data(runtime).activeMatch?.moveFeedback
    await fireEvent.press(
      screen.getByRole("button", { name: copy.interface.matchCommands.menu }),
    )
    for (const name of firstLabels)
      expect(screen.queryByRole("button", { name })).toBeNull()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.shared.settingsControls.close }),
    )
    for (const name of firstLabels)
      expect(screen.queryByRole("button", { name })).toBeNull()
    expect(data(runtime).activeMatch?.moveFeedback).toEqual(retained)
  })

  it("clears on background and history changes without replaying feedback on return", async () => {
    const { runtime, session, copy } = await open("standard", "challenge")
    await playOneMove(session)
    const nextLabels = await visibleReactionLabels(runtime, session, copy)
    const retained = data(runtime).activeMatch?.moveFeedback
    await activity("background")
    for (const name of nextLabels)
      expect(screen.queryByRole("button", { name })).toBeNull()
    await activity("active")
    for (const name of nextLabels)
      expect(screen.queryByRole("button", { name })).toBeNull()
    expect(
      data(runtime).activeMatch?.moveFeedback?.slice(0, retained?.length),
    ).toEqual(retained)
    for (const placement of ["middle", "bottom", "top"] as const) {
      await act(() =>
        runtime.profile.actor.send({
          type: "PROFILE.MOVE_REACTION_PLACEMENT_CHANGED",
          placement,
        }),
      )
      await waitFor(() =>
        expect(data(runtime).settings.moveReactionPlacement).toBe(placement),
      )
      for (const name of nextLabels)
        expect(screen.queryByRole("button", { name })).toBeNull()
    }
    const cursor = selectMatchTimeline(session.actor.getSnapshot()).cursor
    await fireEvent.press(
      screen.getByRole("button", { name: copy.interface.matchCommands.undo }),
    )
    await waitFor(() =>
      expect(
        selectMatchTimeline(session.actor.getSnapshot()).cursor,
      ).toBeLessThan(cursor),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.interface.matchCommands.redo }),
    )
    await waitFor(() =>
      expect(selectMatchTimeline(session.actor.getSnapshot()).cursor).toBe(
        cursor,
      ),
    )
    for (const name of nextLabels)
      expect(screen.queryByRole("button", { name })).toBeNull()
  })
})
