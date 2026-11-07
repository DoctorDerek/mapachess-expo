// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import createInitialPlayerData from "@mapachess/profile/player-data"
import { installDomHarness } from "../../test/domHarness"
import gamepadHarness from "../../test/gamepadHarness"
import PlayerInputProvider from "../input/PlayerInputProvider"
import ChallengeDifficultyChoices from "./ChallengeDifficultyChoices"
import Chess960PositionChoice from "./Chess960PositionChoice"

installDomHarness()
const copy = loadCatalog("en")

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
        numberedPosition
        disabled={disabled}
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
    pad.press(0)
    expect(changed).toHaveBeenCalledExactlyOnceWith("529")
    expect(screen.getByText(copy.setup.pinnedPosition)).toBeTruthy()
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
  })

  it("moves between difficulty ranges with the controller and enters the visible choice group", () => {
    const pad = gamepadHarness()
    const selected = vi.fn()
    const history = createInitialPlayerData().challengeHistory.standard
    render(
      <PlayerInputProvider profileActor={null}>
        <ChallengeDifficultyChoices
          disabled={false}
          history={history}
          onSelected={selected}
          selectedElo={100}
          targets={Array.from({ length: 21 }, (_, index) => 100 + index * 25)}
        />
      </PlayerInputProvider>,
    )
    const range = screen.getByRole("combobox")
    act(() => range.focus())
    pad.press(15)
    expect((range as HTMLSelectElement).value).toBe("250")
    expect(screen.queryByRole("radio", { name: /^100/ })).toBeNull()
    pad.press(0)
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: /^250/ }),
    )
    fireEvent.click(screen.getByRole("radio", { name: /^300/ }))
    expect(selected).toHaveBeenCalledExactlyOnceWith(300)
    fireEvent.change(range, { target: { value: "500" } })
    expect(screen.getByRole("radio", { name: /^500/ })).toBeTruthy()
    act(() => range.focus())
    pad.press(14)
    expect((range as HTMLSelectElement).value).toBe("250")
  })

  it("shows earned difficulty medals and the actual last-played animal, not a substitute opponent", () => {
    const selected = vi.fn()
    render(
      <ChallengeDifficultyChoices
        disabled={false}
        history={{
          animals: [],
          difficulties: [
            {
              targetElo: 500,
              lastPlayedAnimal: "bunny-stockfish",
              highestMedal: "gold",
            },
          ],
        }}
        onSelected={selected}
        selectedElo={500}
        targets={[500, 525]}
      />,
    )
    const earned = screen.getByRole("radio", {
      name: /500.*Gold.*Bunny Stockfish/i,
    })
    fireEvent.focus(earned)
    fireEvent.blur(earned)
    const label = earned.closest("label")
    if (label === null)
      throw new Error("Every difficulty choice must have a label.")
    fireEvent.pointerEnter(label, { pointerType: "mouse" })
    fireEvent.pointerLeave(label)
    expect((earned as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole("radio", { name: /^525/ }))
    expect(selected).toHaveBeenCalledExactlyOnceWith(525)
  })
})
