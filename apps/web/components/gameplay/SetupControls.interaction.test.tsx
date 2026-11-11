// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useRef, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import challengeDifficultyGrid, {
  createChallengeDifficultyDraft,
  editChallengeDifficulty,
  projectChallengeDifficulty,
} from "@mapachess/gameplay/challenge-difficulty"
import loadCatalog from "@mapachess/localization/catalog"
import createInitialPlayerData from "@mapachess/profile/player-data"
import { installDomHarness } from "../../test/domHarness"
import gamepadHarness from "../../test/gamepadHarness"
import PlayerInputProvider from "../input/PlayerInputProvider"
import ChallengeDifficultyChoices from "./ChallengeDifficultyChoices"
import Chess960PositionChoice from "./Chess960PositionChoice"

installDomHarness()
const copy = loadCatalog("en")

function Difficulty({ initial = 100 }: Readonly<{ initial?: number }>) {
  const grid = challengeDifficultyGrid("standard")
  const [draft, setDraft] = useState(() =>
    createChallengeDifficultyDraft(grid, initial),
  )
  const exactInput = useRef<HTMLInputElement>(null)
  const history = createInitialPlayerData().challengeHistory
  const control = projectChallengeDifficulty("standard", draft, {
    ...history,
    standard: {
      animals: [],
      difficulties: [
        {
          targetElo: 500,
          lastPlayedAnimal: "bunny-stockfish",
          highestMedal: "gold",
        },
      ],
    },
  })
  return (
    <PlayerInputProvider profileActor={null}>
      <ChallengeDifficultyChoices
        control={control}
        disabled={false}
        exactInput={exactInput}
        onEdit={(edit) =>
          setDraft((current) => editChallengeDifficulty(grid, current, edit))
        }
      />
    </PlayerInputProvider>
  )
}

function Position({
  initial = "518",
  onChanged = vi.fn(),
  disabled = false,
}: {
  initial?: string
  onChanged?: (value: string) => void
  disabled?: boolean
}) {
  const [value, setValue] = useState(initial)
  return (
    <PlayerInputProvider profileActor={null}>
      <Chess960PositionChoice
        value={value}
        disabled={disabled}
        orientation="white"
        onChanged={(next) => {
          setValue(next)
          onChanged(next)
        }}
        onRandomize={() => {
          setValue("0")
          onChanged("0")
        }}
      />
    </PlayerInputProvider>
  )
}

describe("controller-accessible match setup controls", () => {
  it("edits a Chess960 position in a private controller draft, then accepts it explicitly", () => {
    const pad = gamepadHarness()
    const changed = vi.fn()
    render(<Position onChanged={changed} />)
    const number = screen.getByRole("spinbutton")
    act(() => number.focus())
    pad.press(0)
    pad.press(12)
    pad.press(15)
    expect((number as HTMLInputElement).value).toBe("529")
    expect(changed).not.toHaveBeenCalled()
    expect(
      screen.getByRole("img", { name: copy.setup.positionPreview(518) }),
    ).toBeTruthy()
    pad.press(0)
    expect(changed).toHaveBeenCalledExactlyOnceWith("529")
    expect(
      screen.getByRole("img", { name: copy.setup.positionPreview(529) }),
    ).toBeTruthy()
    expect(screen.queryByRole("grid")).toBeNull()
  })

  it.each([
    { initial: "0", direction: 14, expected: "0" },
    { initial: "959", direction: 15, expected: "959" },
    { initial: "invalid", direction: 12, expected: "1" },
  ])(
    "bounds controller editing for $initial without publishing intermediate changes",
    ({ initial, direction, expected }) => {
      const pad = gamepadHarness()
      const changed = vi.fn()
      render(<Position initial={initial} onChanged={changed} />)
      const number = screen.getByRole("spinbutton")
      act(() => number.focus())
      pad.press(0)
      pad.press(direction)
      expect((number as HTMLInputElement).value).toBe(expected)
      pad.press(1)
      expect((number as HTMLInputElement).value).toBe(
        initial === "invalid" ? "" : initial,
      )
      expect(changed).not.toHaveBeenCalled()
    },
  )

  it("drops a controller draft on blur and accepts direct numeric input and randomization", () => {
    const pad = gamepadHarness()
    const changed = vi.fn()
    render(<Position onChanged={changed} />)
    const number = screen.getByRole("spinbutton")
    act(() => number.focus())
    pad.press(0)
    pad.press(13)
    act(() => number.blur())
    expect((number as HTMLInputElement).value).toBe("518")
    fireEvent.change(number, { target: { value: "128" } })
    expect(changed).toHaveBeenLastCalledWith("128")
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(copy.setup.randomize) }),
    )
    expect(changed).toHaveBeenLastCalledWith("0")
    expect(
      screen.getByRole("img", { name: copy.setup.positionPreview(0) }),
    ).toBeTruthy()
  })

  it("moves the focused Elo range by one supported target per controller step", () => {
    const pad = gamepadHarness()
    render(<Difficulty />)
    const range = screen.getByRole("slider", {
      name: copy.setup.adjustOpponentElo,
    })
    const exact = screen.getByRole("textbox", { name: copy.setup.opponentElo })
    act(() => range.focus())
    pad.press(15)
    expect(range).toHaveProperty("value", "125")
    expect(exact).toHaveProperty("value", "125")
    pad.press(14)
    expect(range).toHaveProperty("value", "100")
    pad.press(14)
    expect(exact).toHaveProperty("value", "100")
    expect(document.activeElement).toBe(range)
  })

  it("recovers a restored unsupported Elo only after a deliberate range selection", () => {
    render(<Difficulty initial={2400} />)
    const exact = screen.getByRole("textbox", { name: copy.setup.opponentElo })
    const range = screen.getByRole("slider", {
      name: copy.setup.adjustOpponentElo,
    })

    act(() => exact.focus())
    act(() => range.focus())
    expect(range).toHaveProperty("value", "100")
    expect(exact).toHaveProperty("value", "2400")
    expect(exact.getAttribute("aria-invalid")).toBe("true")
    expect(screen.queryByText(copy.setup.noDifficultyHistory)).toBeNull()

    fireEvent.click(range)
    expect(exact).toHaveProperty("value", "100")
    expect(exact.hasAttribute("aria-invalid")).toBe(false)
    expect(screen.getByText(copy.setup.noDifficultyHistory)).toBeTruthy()
  })

  it("keeps earned history visible and changes it only when an exact target is accepted", () => {
    render(<Difficulty initial={500} />)
    const exact = screen.getByRole("textbox", { name: copy.setup.opponentElo })
    const slider = screen.getByRole("slider", {
      name: copy.setup.adjustOpponentElo,
    })
    expect(screen.getByText("Bunny Stockfish")).toBeTruthy()
    expect(screen.getByText("Gold")).toBeTruthy()
    fireEvent.change(exact, { target: { value: "525" } })
    expect(slider).toHaveProperty("value", "500")
    expect(screen.getByText("Gold")).toBeTruthy()
    fireEvent.blur(exact)
    expect(slider).toHaveProperty("value", "525")
    expect(screen.queryByText("Gold")).toBeNull()
    expect(screen.getByText(copy.setup.noDifficultyHistory)).toBeTruthy()
  })
})
