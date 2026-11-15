import "@/test/nativeUiEnvironment"
import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"
import { Pressable, Text } from "react-native"
import * as Reanimated from "react-native-reanimated"
import Home from "@mapachess/application-ui/home"
import loadCatalog from "@mapachess/localization/catalog"
import battleSpritePlayback from "@mapachess/match-presentation/battle-sprite-playback"
import { BETTER_HINT_FRAME } from "@mapachess/match-presentation/better-hint-geometry"
import resolveOpponentPresentation, {
  resolveOpponentAttention,
} from "@mapachess/match-presentation/opponent-presentation"
import { coachPortraitSource } from "@mapachess/match-presentation/presentation-assets"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
} from "@mapachess/match/match-position"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import type { ProfileRuntime } from "@mapachess/profile/profile-runtime"
import NativeBattleFighter from "@/components/gameplay/NativeBattleFighter"
import NativeChessboard from "@/components/gameplay/NativeChessboard"
import nativeHomeElements from "@/components/gameplay/NativeHomeElements"
import NativeMatchSetup from "@/components/gameplay/NativeMatchSetup"
import NativeAnimal from "@/components/presentation/NativeAnimal"
import NativeRecoveryBoundary from "@/components/presentation/NativeRecoveryBoundary"
import NativeSpritePlayback from "@/components/presentation/NativeSpritePlayback"
import NativeCoachPortrait from "@/components/profile/NativeCoachPortrait"
import NativeLocaleProvider from "@/components/profile/NativeLocaleProvider"
import openNativeProfileRuntime from "@/lib/profile/openNativeProfileRuntime"
import InMemoryAsyncStorage from "@/test/nativeStorageFixture"

jest.mock("@/lib/presentation/nativeAssetManifest", () => {
  const { default: manifest } = jest.requireActual<
    typeof import("@/lib/presentation/nativeAssetManifest")
  >("@/lib/presentation/nativeAssetManifest")
  const { default: resolve, resolveOpponentAttention: attention } =
    jest.requireActual<
      typeof import("@mapachess/match-presentation/opponent-presentation")
    >("@mapachess/match-presentation/opponent-presentation")
  const { coachPortraitSource: portrait } = jest.requireActual<
    typeof import("@mapachess/match-presentation/presentation-assets")
  >("@mapachess/match-presentation/presentation-assets")
  const recipes = [
    resolve("tiger-stockfish", { family: "capture", role: "attacker" }),
    resolve("chicken-stockfish", { family: "defeat" }),
    resolve("raccoon-stockfish", { family: "defeat" }),
    resolve("squirrel-stockfish"),
  ]
  const sources = new Set([
    ...Object.keys(manifest.images),
    ...recipes.flatMap((recipe) =>
      recipe.kind === "sprite"
        ? recipe.steps.map(({ animation }) => animation.sourceId)
        : [],
    ),
    attention("squirrel-stockfish")?.animation.sourceId,
    portrait("neutral", "mapachito"),
    portrait("neutral", "greyfox"),
    portrait("happy_high", "greyfox"),
  ])
  return {
    __esModule: true,
    default: {
      ...manifest,
      images: Object.fromEntries(
        [...sources].flatMap((id, index) =>
          typeof id === "string" ? [[id, index + 1]] : [],
        ),
      ),
    },
  }
})

let profile: ProfileRuntime | undefined
afterEach(async () => {
  await profile?.close()
  profile = undefined
})
const copy = loadCatalog("en")

it("keeps native recovery actions reachable after a render error and restores the board on retry", async () => {
  const pause = jest.fn()
  const backup = jest.fn()
  const failure = new Error("Unable to display the board artwork")
  let artworkFailed = true
  function Board() {
    if (artworkFailed) throw failure
    return <Text>{copy.board.orientation("white")}</Text>
  }
  const title =
    copy.interface.profilePlayExperience.thisScreenCouldNotBeDisplayed
  const retry = copy.interface.recoverableView.tryAgain
  const exportLabel = copy.interface.profileSettingsPanel.exportPlayerData
  const reportUnexpectedError = console.error
  const reported = jest
    .spyOn(console, "error")
    .mockImplementation((...args: unknown[]) => {
      if (!args.includes(failure)) reportUnexpectedError(...args)
    })
  try {
    await render(
      <NativeRecoveryBoundary
        onRecovery={pause}
        title={title}
        description={
          copy.interface.profilePlayExperience.yourPlayerDataIsStillHeldIn
        }
        retryLabel={retry}
        recovery={
          <Pressable accessibilityRole="button" onPress={backup}>
            <Text>{exportLabel}</Text>
          </Pressable>
        }
      >
        <Board />
      </NativeRecoveryBoundary>,
    )
  } finally {
    reported.mockRestore()
  }
  expect(screen.getByRole("alert")).toHaveTextContent(title)
  expect(pause).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole("button", { name: exportLabel }))
  expect(backup).toHaveBeenCalledTimes(1)
  artworkFailed = false
  await fireEvent.press(screen.getByRole("button", { name: retry }))
  expect(screen.queryByRole("alert")).toBeNull()
  expect(screen.getByText(copy.board.orientation("white"))).toBeOnTheScreen()
})

async function readyProfile() {
  profile = await openNativeProfileRuntime({
    storage: new InMemoryAsyncStorage(),
  })
  await waitFor(() =>
    expect(profile?.actor.getSnapshot().matches("ready")).toBe(true),
  )
  const data = selectCurrentPlayerData(profile.actor.getSnapshot())
  if (data === null)
    throw new Error("The profile must be accepted before rendering play.")
  return { runtime: profile, data }
}

function nativeImage(sourceId: string) {
  return screen.getByTestId(sourceId, { includeHiddenElements: true })
}

function controlledTiming() {
  const completions: NonNullable<
    Parameters<typeof Reanimated.withTiming>[2]
  >[] = []
  const timing = jest
    .spyOn(Reanimated, "withTiming")
    .mockImplementation((target, _config, onComplete) => {
      if (onComplete !== undefined) completions.push(onComplete)
      return target
    })
  return { timing, completions }
}

describe("native animal presentation contract", () => {
  const placement = { kind: "battle", mobileScale: 3, desktopScale: 3 } as const

  it.each([false, true])(
    "plays a complete authored sequence before finishing or repeating: %s",
    async (repeatSequence) => {
      const { completions } = controlledTiming()
      const tiger = resolveOpponentPresentation("tiger-stockfish", {
        family: "capture",
        role: "attacker",
      })
      const approach = battleSpritePlayback(tiger, "approach", "right", false)
      const strike = battleSpritePlayback(tiger, "strike", "right", false)
      const playback = {
        ...approach,
        steps: [...approach.steps, ...strike.steps],
        repeatSequence,
      }
      expect(playback.steps.length).toBeGreaterThan(1)
      const complete = jest.fn()
      await render(
        <NativeSpritePlayback
          active
          identity="capture-sequence"
          playback={playback}
          placement={placement}
          reducedMotion={false}
          onComplete={complete}
        />,
      )
      for (const source of new Set(playback.sources))
        await fireEvent(nativeImage(source), "load")
      for (const index of playback.steps.keys()) {
        expect(complete).not.toHaveBeenCalled()
        const finish = completions[index]
        if (finish === undefined)
          throw new Error("Expected the next authored animation")
        await act(() => finish(true))
      }
      expect(complete).toHaveBeenCalledTimes(repeatSequence ? 0 : 1)
      expect(completions).toHaveLength(
        playback.steps.length + Number(repeatSequence),
      )
    },
  )

  it("loads the whole capture recipe and waits for both frame and travel completion", async () => {
    const { timing, completions } = controlledTiming()
    const tiger = resolveOpponentPresentation("tiger-stockfish", {
      family: "capture",
      role: "attacker",
    })
    const playback = battleSpritePlayback(tiger, "approach", "right", false)
    const sources = [...new Set(playback.sources)]
    const lastSource = sources.at(-1)
    if (lastSource === undefined || sources.length < 2)
      throw new Error("The capture fixture must require more than one image.")
    const complete = jest.fn()
    function CapturePlayback() {
      const position = Reanimated.useSharedValue(0)
      return (
        <NativeSpritePlayback
          active
          identity="capture-1"
          playback={playback}
          placement={placement}
          reducedMotion={false}
          fallback={<Text>Resting pose</Text>}
          travel={{ position, target: 1 }}
          onComplete={complete}
        />
      )
    }
    await render(<CapturePlayback />)
    for (const source of sources.slice(0, -1))
      await fireEvent(nativeImage(source), "load")
    expect(timing).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
    expect(screen.getByText("Resting pose")).toBeOnTheScreen()

    await fireEvent(nativeImage(lastSource), "load")
    expect(screen.queryByText("Resting pose")).toBeNull()
    expect(completions).toHaveLength(2)
    expect(complete).not.toHaveBeenCalled()
    await act(() => completions[1]?.(true))
    expect(complete).not.toHaveBeenCalled()
    await act(() => {
      completions[0]?.(true)
      completions[0]?.(true)
    })
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it("retains the ready pose and ignores an obsolete completion after replacement", async () => {
    const { completions } = controlledTiming()
    const chicken = battleSpritePlayback(
      resolveOpponentPresentation("chicken-stockfish", { family: "defeat" }),
      "conclusion",
      "left",
      false,
    )
    const raccoon = battleSpritePlayback(
      resolveOpponentPresentation("raccoon-stockfish", { family: "defeat" }),
      "conclusion",
      "left",
      false,
    )
    const oldSource = chicken.sources[0]
    const newSource = raccoon.sources[0]
    if (oldSource === undefined || newSource === undefined)
      throw new Error("Both endings need prepared artwork.")
    const obsolete = jest.fn()
    const current = jest.fn()
    const frame = (
      identity: string,
      playback: typeof chicken,
      onComplete: () => void,
    ) => (
      <NativeSpritePlayback
        active
        identity={identity}
        playback={playback}
        placement={placement}
        reducedMotion={false}
        onComplete={onComplete}
        fallback={<Text>Loading</Text>}
      />
    )
    const rendered = await render(frame("old-ending", chicken, obsolete))
    await fireEvent(nativeImage(oldSource), "load")
    expect(completions).toHaveLength(1)
    await rendered.rerender(frame("current-ending", raccoon, current))
    expect(nativeImage(oldSource)).toBeOnTheScreen()
    expect(screen.queryByText("Loading")).toBeNull()
    await act(() => {
      completions[0]?.(true)
    })
    expect(obsolete).not.toHaveBeenCalled()
    expect(current).not.toHaveBeenCalled()
    await fireEvent(nativeImage(newSource), "load")
    expect(completions).toHaveLength(2)
    await act(() => {
      completions[1]?.(true)
    })
    expect(current).toHaveBeenCalledTimes(1)
    expect(obsolete).not.toHaveBeenCalled()
  })

  it("settles a decoded Reduced Motion pose once without scheduling motion", async () => {
    const timing = jest.spyOn(Reanimated, "withTiming")
    const playback = battleSpritePlayback(
      resolveOpponentPresentation("chicken-stockfish", { family: "defeat" }),
      "conclusion",
      "left",
      true,
    )
    const source = playback.sources[0]
    if (source === undefined)
      throw new Error("The defeat fixture needs an image.")
    const complete = jest.fn()
    const frame = (active: boolean) => (
      <NativeSpritePlayback
        active={active}
        identity="still-ending"
        playback={playback}
        placement={placement}
        reducedMotion
        onComplete={complete}
      />
    )
    const rendered = await render(frame(true))
    expect(complete).not.toHaveBeenCalled()
    await fireEvent(nativeImage(source), "load")
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1))
    await rendered.rerender(frame(false))
    await rendered.rerender(frame(true))
    expect(timing).not.toHaveBeenCalled()
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it("loads an authored attention clip only for an opted-in active animal", async () => {
    const animal = "squirrel-stockfish"
    const attention = resolveOpponentAttention(animal)
    if (attention === null)
      throw new Error("Expected an authored attention clip.")
    const { timing } = controlledTiming()
    const rendered = await render(<NativeAnimal animal={animal} />)
    expect(screen.queryByTestId(attention.animation.sourceId)).toBeNull()
    await rendered.rerender(
      <NativeAnimal
        animal={animal}
        motion={{ active: true, reducedMotion: false, attention: true }}
      />,
    )
    await waitFor(() =>
      expect(nativeImage(attention.animation.sourceId)).toBeOnTheScreen(),
    )
    expect(timing).not.toHaveBeenCalled()
    await fireEvent(nativeImage(attention.animation.sourceId), "load")
    expect(timing).toHaveBeenCalled()
  })

  it("keeps the ready coach expression until a replacement loads or fails", async () => {
    const { runtime } = await readyProfile()
    const original = coachPortraitSource("neutral", "mapachito")
    const alternate = coachPortraitSource("happy_high", "greyfox")
    if (original === null || alternate === null)
      throw new Error("Expected both coach sources.")
    const frame = (collection: "mapachito" | "greyfox") => (
      <NativeLocaleProvider actor={runtime.actor}>
        <NativeCoachPortrait
          collection={collection}
          label={collection === "mapachito" ? "neutral" : "happy_high"}
        />
      </NativeLocaleProvider>
    )
    const originalLabel = `${copy.presentation.coach(copy.profile.coachCollections.mapachito)}: ${copy.shared.coachPortraitNames.neutral}`
    const alternateLabel = `${copy.presentation.coach(copy.profile.coachCollections.greyfox)}: ${copy.shared.coachPortraitNames.happy_high}`
    const rendered = await render(frame("mapachito"))
    await fireEvent(nativeImage(original), "load")
    await rendered.rerender(frame("greyfox"))
    expect(screen.getByLabelText(originalLabel)).toBeOnTheScreen()
    await fireEvent(nativeImage(alternate), "error")
    expect(screen.getByLabelText(originalLabel)).toBeOnTheScreen()
    await fireEvent(nativeImage(alternate), "load")
    expect(screen.getByLabelText(alternateLabel)).toBeOnTheScreen()
  })
})

describe("native gameplay surfaces", () => {
  it("settles a missing-artwork presentation once without blocking the accepted battle sequence", async () => {
    const presentation = resolveOpponentPresentation(
      "chicken-stockfish",
      { family: "defeat" },
      0,
      () => false,
    )
    expect(presentation.kind).toBe("authored-fallback")
    const complete = jest.fn()
    const scale = {
      integerScale: 1,
      visibleWidthPixels: 72,
      clearance: { above: 72, below: 0, horizontalRadius: 36 },
    }
    const geometry = { mobile: scale, desktop: scale }
    const props = {
      participant: "opponent" as const,
      displayName: copy.animals.names["chicken-stockfish"],
      presentation,
      opposing: presentation,
      geometry,
      opposingGeometry: geometry,
      recoilLimit: 10,
      beat: "conclusion" as const,
      phaseIndex: 3,
      sequence: 7,
      report: true,
      active: true,
      reducedMotion: true,
      onComplete: complete,
    }
    const rendered = await render(<NativeBattleFighter {...props} />)
    await waitFor(() => expect(complete).toHaveBeenCalledWith("opponent", 3, 7))
    await rendered.rerender(<NativeBattleFighter {...props} active={false} />)
    await rendered.rerender(<NativeBattleFighter {...props} />)
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it("offers all four real game modes and separate profile actions", async () => {
    const { runtime, data } = await readyProfile()
    const select = jest.fn()
    await render(
      <NativeLocaleProvider actor={runtime.actor}>
        <Home
          state={{
            playerData: data,
            disabled: false,
            settingsDisabled: false,
            settingsOpen: false,
            resumeMatch: null,
          }}
          commands={{
            selectMode: select,
            resume: jest.fn(),
            customize: jest.fn(),
            share: jest.fn(),
            settings: jest.fn(),
          }}
          copy={copy}
          locale="en"
          elements={nativeHomeElements}
          settingsFocusTarget={null}
        />
      </NativeLocaleProvider>,
    )
    for (const variant of ["standard", "chess960"] as const)
      for (const mode of ["story", "challenge"] as const) {
        await fireEvent.press(
          screen.getByRole("button", {
            name: copy.setup.presentations[variant][mode].title,
          }),
        )
        expect(select).toHaveBeenLastCalledWith({ mode, variant })
      }
    expect(
      screen.getByRole("button", { name: copy.setup.customizeProfile }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole("button", { name: copy.setup.shareProfile }),
    ).toBeOnTheScreen()
  })

  it("keeps locked player animals disabled and cancels choices without changing progress", async () => {
    const { runtime, data } = await readyProfile()
    const back = jest.fn()
    const initial = { mode: "story", variant: "standard" } as const
    await render(
      <NativeLocaleProvider actor={runtime.actor}>
        <NativeMatchSetup
          initial={initial}
          data={data}
          onAutoHintModeChanged={jest.fn()}
          onPlayerAnimalChanged={jest.fn()}
          disabled={false}
          navigation={{ back, open: jest.fn(), close: jest.fn() }}
          overlay="setup-player"
          onStart={jest.fn()}
        />
      </NativeLocaleProvider>,
    )
    expect(
      screen.getByRole("radio", {
        name: copy.animals.names["chicken-stockfish"],
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole("radio", {
        name: copy.animals.names["raccoon-stockfish"],
      }),
    ).toBeEnabled()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.cancel }),
    )
    expect(back).toHaveBeenCalledTimes(1)
    expect(
      selectCurrentPlayerData(runtime.actor.getSnapshot())?.appearance,
    ).toEqual(data.appearance)
  })

  it("selects legal moves through the actual chess rules without accepting blocked presses", async () => {
    const { runtime, data } = await readyProfile()
    const position = createInitialMatchPosition({
      variant: "standard",
      chess960PositionId: null,
    })
    const move = jest.fn()
    const props = {
      position,
      orientation: "white" as const,
      legalMoves: listLegalMatchMoves(position),
      disabled: false,
      appearance: data.settings.chessAppearance,
      hints: null,
      showMoveHints: false,
      lastMove: null,
      onMove: move,
    }
    const rendered = await render(
      <NativeLocaleProvider actor={runtime.actor}>
        <NativeChessboard {...props} />
      </NativeLocaleProvider>,
    )
    await fireEvent.press(
      screen.getByRole("button", { name: /^e2, White pawn/ }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: /^e4, empty, legal destination/ }),
    )
    expect(move).toHaveBeenCalledWith("e2e4")
    expect(move).toHaveBeenCalledTimes(1)
    await rendered.rerender(
      <NativeLocaleProvider actor={runtime.actor}>
        <NativeChessboard {...props} disabled />
      </NativeLocaleProvider>,
    )
    await fireEvent.press(
      screen.getByRole("button", { name: /^e2, White pawn/ }),
    )
    expect(move).toHaveBeenCalledTimes(1)
  })

  it.each(["queen", "rook", "bishop", "knight"] as const)(
    "requires an explicit %s promotion and supports canceling it",
    async (role) => {
      const { runtime, data } = await readyProfile()
      const parsed = reconstructMatchPosition(
        { variant: "standard", chess960PositionId: null },
        "7k/P7/8/8/8/8/8/7K w - - 0 1",
      )
      if (!parsed.ok)
        throw new Error("Promotion fixture must be a legal chess position.")
      const move = jest.fn()
      await render(
        <NativeLocaleProvider actor={runtime.actor}>
          <NativeChessboard
            position={parsed.position}
            orientation="white"
            legalMoves={listLegalMatchMoves(parsed.position)}
            disabled={false}
            appearance={data.settings.chessAppearance}
            hints={null}
            showMoveHints={false}
            lastMove={null}
            onMove={move}
          />
        </NativeLocaleProvider>,
      )
      await fireEvent.press(
        screen.getByRole("button", { name: /^a7, White pawn/ }),
      )
      await fireEvent.press(
        screen.getByRole("button", { name: /^a8, empty, legal destination/ }),
      )
      expect(move).not.toHaveBeenCalled()
      await fireEvent.press(
        screen.getByRole("button", { name: copy.board.cancelPromotion }),
      )
      expect(move).not.toHaveBeenCalled()
      await fireEvent.press(
        screen.getByRole("button", { name: /^a7, White pawn/ }),
      )
      await fireEvent.press(
        screen.getByRole("button", { name: /^a8, empty, legal destination/ }),
      )
      await fireEvent.press(
        screen.getByRole("button", { name: copy.board.promote(role) }),
      )
      const selected = listLegalMatchMoves(parsed.position).find(
        (entry) => entry.kind === "normal" && entry.promotion === role,
      )
      expect(move).toHaveBeenCalledWith(selected?.id)
    },
  )

  it("renders all six accepted native hints through real SVG leaves and preserves piece hints on selection", async () => {
    const { runtime, data } = await readyProfile()
    const position = createInitialMatchPosition({
      variant: "standard",
      chess960PositionId: null,
    })
    const hints = {
      positionFen: position.fen,
      requestId: "native-board-hints",
      player: [
        { color: "white", from: "e2", to: "e4", uci: "e2e4" },
        { color: "white", from: "d2", to: "d4", uci: "d2d4" },
        { color: "white", from: "g1", to: "f3", uci: "g1f3" },
      ],
      opponent: [
        { color: "black", from: "e7", to: "e5", uci: "e7e5" },
        { color: "black", from: "d7", to: "d5", uci: "d7d5" },
        { color: "black", from: "g8", to: "f6", uci: "g8f6" },
      ],
    } satisfies BetterHintsResult
    const props = {
      position,
      orientation: "white" as const,
      legalMoves: listLegalMatchMoves(position),
      appearance: data.settings.chessAppearance,
      disabled: false,
      hints,
      showMoveHints: true,
      lastMove: null,
      onMove: jest.fn(),
    }
    const view = await render(
      <NativeLocaleProvider actor={runtime.actor}>
        <NativeChessboard {...props} />
      </NativeLocaleProvider>,
    )
    const paths = () =>
      screen.container.queryAll(
        (node) => node.type === "RNSVGPath" && node.props.strokeLinejoin === 1,
      )
    expect(paths()).toHaveLength(6)
    const colors: unknown[] = paths().map((node) => node.props.fill)
    expect(colors[0]).toEqual({ type: 0, payload: expect.any(Number) })
    expect(colors[3]).toEqual({ type: 0, payload: expect.any(Number) })
    expect(colors.slice(0, 3)).toEqual([colors[0], colors[0], colors[0]])
    expect(colors.slice(3)).toEqual([colors[3], colors[3], colors[3]])
    expect(colors[0]).not.toEqual(colors[3])
    const lines = screen.container.queryAll((node) => node.type === "RNSVGLine")
    expect(lines).toHaveLength(6)
    for (const line of lines) {
      expect(line.props.strokeDasharray).toBeTruthy()
      expect(line.props.strokeLinecap).toBe(0)
    }
    await fireEvent.press(
      screen.getByRole("button", { name: /^e2, White pawn/ }),
    )
    expect(paths()).toHaveLength(6)
    expect(
      screen.getByRole("button", { name: /^e4, empty, legal destination/ })
        .props.accessibilityLabel,
    ).toContain(copy.board.moveHint("player", "e2"))
    await view.rerender(
      <NativeLocaleProvider actor={runtime.actor}>
        <NativeChessboard {...props} showMoveHints={false} />
      </NativeLocaleProvider>,
    )
    expect(paths()).toHaveLength(0)
    const frames = screen.container
      .queryAll((node) => node.type === "RNSVGRect")
      .filter(
        (node) =>
          node.props.strokeWidth === BETTER_HINT_FRAME.width ||
          node.props.strokeWidth === BETTER_HINT_FRAME.outlineWidth,
      )
    expect(frames).toHaveLength(12)
    expect(
      screen.getByRole("button", { name: /^e2, White pawn/ }).props
        .accessibilityLabel,
    ).toContain(copy.board.pieceHint("player"))
    expect(props.onMove).not.toHaveBeenCalled()
  })

  it("keeps a native promotion pending across a blocked write and discards it on a new position", async () => {
    const { runtime, data } = await readyProfile()
    const parsed = reconstructMatchPosition(
      { variant: "standard", chess960PositionId: null },
      "7k/P7/8/8/8/8/8/7K w - - 0 1",
    )
    if (!parsed.ok) throw new Error("Expected a legal promotion fixture")
    const move = jest.fn()
    const props = {
      position: parsed.position,
      orientation: "white" as const,
      legalMoves: listLegalMatchMoves(parsed.position),
      appearance: data.settings.chessAppearance,
      disabled: false,
      hints: null,
      showMoveHints: false,
      lastMove: null,
      onMove: move,
    }
    const view = await render(
      <NativeLocaleProvider actor={runtime.actor}>
        <NativeChessboard {...props} />
      </NativeLocaleProvider>,
    )
    await fireEvent.press(
      screen.getByRole("button", { name: /^a7, White pawn/ }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: /^a8, empty, legal destination/ }),
    )
    await view.rerender(
      <NativeLocaleProvider actor={runtime.actor}>
        <NativeChessboard {...props} disabled />
      </NativeLocaleProvider>,
    )
    const choice = screen.getByRole("button", {
      name: copy.board.promote("queen"),
    })
    expect(choice).toBeDisabled()
    await fireEvent.press(choice)
    expect(move).not.toHaveBeenCalled()
    await view.rerender(
      <NativeLocaleProvider actor={runtime.actor}>
        <NativeChessboard {...props} />
      </NativeLocaleProvider>,
    )
    expect(
      screen.getByRole("button", { name: copy.board.promote("queen") }),
    ).toBeEnabled()
    const fresh = createInitialMatchPosition({
      variant: "standard",
      chess960PositionId: null,
    })
    await view.rerender(
      <NativeLocaleProvider actor={runtime.actor}>
        <NativeChessboard
          {...props}
          position={fresh}
          legalMoves={listLegalMatchMoves(fresh)}
        />
      </NativeLocaleProvider>,
    )
    expect(
      screen.queryByRole("button", { name: copy.board.promote("queen") }),
    ).toBeNull()
    await fireEvent.press(
      screen.getByRole("button", { name: /^e2, White pawn/ }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: /^e4, empty, legal destination/ }),
    )
    expect(move).toHaveBeenCalledTimes(1)
    expect(move).toHaveBeenCalledWith("e2e4")
  })
})
