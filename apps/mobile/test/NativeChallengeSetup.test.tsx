import "./nativeUiEnvironment"
import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"
import { getRandomValues } from "expo-crypto"
import loadCatalog from "@mapachess/localization/catalog"
import { DEFAULT_CHALLENGE_SETUP } from "@mapachess/match/challenge-setup"
import createMatchSetupForMode, {
  type MatchSetup,
} from "@mapachess/match/match-setup"
import type { MatchVariant } from "@mapachess/match/match-variant"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import type { ProfileRuntime } from "@mapachess/profile/profile-runtime"
import NativeMatchSetup from "@/components/gameplay/NativeMatchSetup"
import NativeLocaleProvider from "@/components/profile/NativeLocaleProvider"
import openNativeProfileRuntime from "@/lib/profile/openNativeProfileRuntime"
import InMemoryAsyncStorage from "./nativeStorageFixture"

const copy = loadCatalog("en")
let profile: ProfileRuntime | undefined
afterEach(async () => {
  await profile?.close()
  profile = undefined
})

async function renderSetup(variant: MatchVariant = "standard") {
  jest.mocked(getRandomValues).mockImplementation((words) => {
    if (words instanceof Uint32Array) words[0] = 1
    return words
  })
  const runtime = await openNativeProfileRuntime({
    storage: new InMemoryAsyncStorage(),
  })
  profile = runtime
  await waitFor(() =>
    expect(runtime.actor.getSnapshot().matches("ready")).toBe(true),
  )
  const data = selectCurrentPlayerData(runtime.actor.getSnapshot())
  if (data === null) throw new Error("Expected an accepted player profile.")
  const start = jest.fn<(setup: MatchSetup) => void>()
  const open = jest.fn()
  await render(
    <NativeLocaleProvider actor={runtime.actor}>
      <NativeMatchSetup
        data={{
          ...data,
          challengeHistory: {
            ...data.challengeHistory,
            standard: {
              animals: [],
              difficulties: [
                {
                  targetElo: 100,
                  highestMedal: "gold",
                  lastPlayedAnimal: "bunny-stockfish",
                },
              ],
            },
          },
        }}
        disabled={false}
        initial={createMatchSetupForMode(
          { mode: "challenge", variant },
          DEFAULT_CHALLENGE_SETUP,
        )}
        navigation={{ back: jest.fn(), open, close: jest.fn() }}
        onStart={start}
        overlay={undefined}
        profileActor={runtime.actor}
      />
    </NativeLocaleProvider>,
  )
  return { start, open, data, runtime }
}

const exactInput = () => screen.getByLabelText(copy.setup.opponentElo)
const range = () =>
  screen.getByRole("adjustable", { name: copy.setup.adjustOpponentElo })
const startButton = () =>
  screen.getByRole("button", { name: copy.setup.startMatch })

describe("native inline Challenge Elo", () => {
  it("shows a passive preview and launches the displayed random Chess960 position", async () => {
    const { start } = await renderSetup("chess960")
    const positionInput = () =>
      screen.getByLabelText(copy.setup.positionNumber(959))
    await fireEvent.changeText(positionInput(), "518")
    expect(
      screen.getByRole("image", { name: copy.setup.positionPreview(518) }),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.setup.randomize }),
    )
    const displayed = Number(positionInput().props.value)
    expect(
      screen.getByRole("image", {
        name: copy.setup.positionPreview(displayed),
      }),
    ).toBeOnTheScreen()
    await fireEvent.press(startButton())
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        displayedChess960PositionId: displayed,
        challengeSetup: expect.objectContaining({ chess960PositionId: null }),
      }),
    )
  })

  it("keeps earned history inline and updates it with native adjustment actions", async () => {
    const { start, open, data, runtime } = await renderSetup()
    expect(screen.getByText(copy.setup.bestDifficultyMedal)).toBeOnTheScreen()
    expect(
      screen.getByText(copy.animals.opponent("bunny-stockfish")),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(copy.animals.opponent("chicken-stockfish")),
    ).toBeOnTheScreen()
    expect(range().props.accessibilityValue).toEqual({
      min: 100,
      max: 2350,
      now: 100,
    })
    await fireEvent(range(), "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    })
    expect(exactInput()).toHaveDisplayValue("125")
    expect(range().props.accessibilityValue).toEqual({
      min: 100,
      max: 2350,
      now: 125,
    })
    expect(screen.getByText(copy.setup.noDifficultyHistory)).toBeOnTheScreen()
    expect(screen.queryByText(copy.setup.bestDifficultyMedal)).toBeNull()
    await fireEvent(range(), "accessibilityAction", {
      nativeEvent: { actionName: "decrement" },
    })
    expect(screen.getByText(copy.setup.bestDifficultyMedal)).toBeOnTheScreen()
    expect(open).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
    expect(selectCurrentPlayerData(runtime.actor.getSnapshot())).toBe(data)
  })

  it("maps an actual slider track press to the nearest 25 Elo only after layout", async () => {
    const { start } = await renderSetup()
    const track = range().queryAll(
      (node) =>
        typeof node.props.onLayout === "function" &&
        node.props.importantForAccessibility === "no",
    )[0]
    if (track === undefined) throw new Error("Expected the adjustable track")
    await fireEvent.press(track, { nativeEvent: { locationX: 149 } })
    expect(exactInput()).toHaveDisplayValue("100")
    await fireEvent(track, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 48 } },
    })
    await fireEvent.press(track, { nativeEvent: { locationX: 149 } })
    expect(exactInput()).toHaveDisplayValue("1225")
    expect(range().props.accessibilityValue).toMatchObject({ now: 1225 })
    await fireEvent.press(track, { nativeEvent: { locationX: 900 } })
    expect(exactInput()).toHaveDisplayValue("2350")
    await fireEvent.press(startButton())
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeSetup: expect.objectContaining({ difficultyTargetElo: 2350 }),
      }),
    )
  })

  it.each(["standard", "chess960"] as const)(
    "rejects an off-step entry and starts %s only at the exact accepted target",
    async (variant) => {
      const { start } = await renderSetup(variant)
      await fireEvent.changeText(exactInput(), "1012")
      await fireEvent.press(startButton())
      expect(start).not.toHaveBeenCalled()
      expect(exactInput()).toHaveDisplayValue("1012")
      expect(
        screen.getByText(copy.setup.invalidOpponentElo(100, 2350, 25)),
      ).toBeOnTheScreen()
      expect(range().props.accessibilityValue).toMatchObject({ now: 100 })

      await fireEvent.changeText(exactInput(), "2325")
      await fireEvent(exactInput(), "submitEditing")
      expect(start).not.toHaveBeenCalled()
      expect(range().props.accessibilityValue).toMatchObject({ now: 2325 })
      await fireEvent.press(startButton())
      expect(start).toHaveBeenCalledTimes(1)
      expect(start).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "challenge",
          challengeSetup: expect.objectContaining({
            variant,
            difficultyTargetElo: 2325,
            opponentId: "chicken-stockfish",
          }),
        }),
      )
    },
  )
})
