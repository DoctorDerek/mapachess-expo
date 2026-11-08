import "./nativeUiEnvironment"
import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"
import loadCatalog from "@mapachess/localization/catalog"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
} from "@mapachess/match/match-position"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import type { ProfileRuntime } from "@mapachess/profile/profile-runtime"
import NativeChessboard from "@/components/gameplay/NativeChessboard"
import NativeHome from "@/components/gameplay/NativeHome"
import NativeMatchSetup from "@/components/gameplay/NativeMatchSetup"
import NativeLocaleProvider from "@/components/profile/NativeLocaleProvider"
import openNativeProfileRuntime from "@/lib/profile/openNativeProfileRuntime"
import InMemoryAsyncStorage from "./nativeStorageFixture"

let profile: ProfileRuntime | undefined
afterEach(async () => {
  await profile?.close()
  profile = undefined
})
const copy = loadCatalog("en")

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

describe("native gameplay surfaces", () => {
  it("offers all four real game modes and separate profile actions", async () => {
    const { runtime, data } = await readyProfile()
    const select = jest.fn()
    await render(
      <NativeLocaleProvider actor={runtime.actor}>
        <NativeHome
          data={data}
          disabled={false}
          onSelect={select}
          onResume={jest.fn()}
          onCustomize={jest.fn()}
          onShare={jest.fn()}
          onSettings={jest.fn()}
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
          profileActor={runtime.actor}
          disabled={false}
          navigation={{ back, open: jest.fn(), close: jest.fn() }}
          overlay="setup-player"
          onStart={jest.fn()}
        />
      </NativeLocaleProvider>,
    )
    expect(
      screen.getByRole("button", {
        name: copy.animals.names["chicken-stockfish"],
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", {
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

  it("requires an explicit promotion choice and supports canceling it", async () => {
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
      screen.getByRole("button", { name: copy.board.cancelMove }),
    )
    expect(move).not.toHaveBeenCalled()
    await fireEvent.press(
      screen.getByRole("button", { name: /^a8, empty, legal destination/ }),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: copy.board.promote("queen") }),
    )
    expect(move).toHaveBeenCalledWith("a7a8q")
  })
})
