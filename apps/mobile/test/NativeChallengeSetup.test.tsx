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
import type { MatchSetup } from "@mapachess/match/match-setup"
import type { MatchVariant } from "@mapachess/match/match-variant"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import type { ProfileRuntime } from "@mapachess/profile/profile-runtime"
import NativeMatchSetup from "@/components/gameplay/NativeMatchSetup"
import NativeLocaleProvider from "@/components/profile/NativeLocaleProvider"
import openNativeProfileRuntime from "@/lib/profile/openNativeProfileRuntime"
import cryptography from "./nativeCryptographyFixture"
import InMemoryAsyncStorage from "./nativeStorageFixture"

const copy = loadCatalog("en")
let profile: ProfileRuntime | undefined
afterEach(async () => {
  await profile?.close()
  profile = undefined
})

async function renderSetup(variant: MatchVariant = "standard") {
  jest.mocked(getRandomValues).mockImplementation((words) =>
    words instanceof Uint32Array ? cryptography.fillRandomWords(words) : words,
  )
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
        initial={{
          mode: "challenge",
          challengeSetup: { ...DEFAULT_CHALLENGE_SETUP, variant },
        }}
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
