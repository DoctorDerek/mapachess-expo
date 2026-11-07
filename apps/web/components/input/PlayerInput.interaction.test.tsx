// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { useRef } from "react"
import { describe, expect, it, vi } from "vitest"
import type { PlayerInputAction } from "@mapachess/match/player-input"
import { installDomHarness } from "../../test/domHarness"
import gamepadHarness from "../../test/gamepadHarness"
import PlayerInputProvider, {
  usePlayerInput,
  usePlayerInputScope,
} from "./PlayerInputProvider"

installDomHarness()

function Scope({
  handle,
  enabled = true,
}: Readonly<{
  handle: (action: PlayerInputAction) => boolean
  enabled?: boolean
}>) {
  const root = useRef<HTMLElement>(null)
  const input = usePlayerInput()
  usePlayerInputScope({ root, handle, enabled })
  return (
    <section ref={root}>
      <output aria-label="Device">{input?.device.method}</output>
      <button>First</button>
      <button>Second</button>
    </section>
  )
}

describe("gamepad adapter and scoped web input", () => {
  it.each([
    [0, "confirm"],
    [1, "cancel"],
    [2, "hints"],
    [3, "controls"],
    [4, "previousPiece"],
    [5, "nextPiece"],
    [9, "menu"],
    [12, "up"],
    [13, "down"],
    [14, "left"],
    [15, "right"],
  ] as const)(
    "dispatches physical button %i as %s exactly once",
    (index, action) => {
      const gamepad = gamepadHarness()
      const handle = vi.fn(() => true)
      render(
        <PlayerInputProvider profileActor={null}>
          <Scope handle={handle} />
        </PlayerInputProvider>,
      )
      gamepad.press(index)
      expect(handle).toHaveBeenCalledExactlyOnceWith(
        action,
        expect.objectContaining({ method: "controller" }),
      )
      expect(screen.getByLabelText("Device").textContent).toBe("controller")
      gamepad.frame()
      expect(handle).toHaveBeenCalledTimes(1)
    },
  )
  it("does not dispatch a button already held during connection", () => {
    const gamepad = gamepadHarness()
    const handle = vi.fn(() => true)
    render(
      <PlayerInputProvider profileActor={null}>
        <Scope handle={handle} />
      </PlayerInputProvider>,
    )
    gamepad.sample([1])
    gamepad.frame()
    gamepad.frame()
    expect(handle).not.toHaveBeenCalled()
    gamepad.press(0)
    expect(handle).toHaveBeenCalledTimes(1)
  })
  it("uses ordinary focused controls when no active scope handles confirm", () => {
    const gamepad = gamepadHarness()
    const click = vi.fn()
    render(
      <PlayerInputProvider profileActor={null}>
        <button onClick={click}>Activate</button>
      </PlayerInputProvider>,
    )
    gamepad.press(0)
    expect(document.activeElement).toBe(screen.getByText("Activate"))
    expect(click).not.toHaveBeenCalled()
    gamepad.press(0)
    expect(click).toHaveBeenCalledOnce()
  })
  it("ignores disabled scopes and reconnects ownership after focus loss", () => {
    const gamepad = gamepadHarness()
    const handle = vi.fn(() => true)
    const view = render(
      <PlayerInputProvider profileActor={null}>
        <Scope handle={handle} enabled={false} />
      </PlayerInputProvider>,
    )
    gamepad.press(2)
    expect(handle).not.toHaveBeenCalled()
    view.rerender(
      <PlayerInputProvider profileActor={null}>
        <Scope handle={handle} />
      </PlayerInputProvider>,
    )
    window.dispatchEvent(new Event("blur"))
    gamepad.press(2)
    expect(handle).not.toHaveBeenCalled()
    window.dispatchEvent(new Event("focus"))
    gamepad.press(2)
    expect(handle).toHaveBeenCalledOnce()
    gamepad.disconnect()
    gamepad.frame()
    expect(screen.getByLabelText("Device").textContent).toBe("keyboard")
  })
  it("rejects unmapped controllers", () => {
    const gamepad = gamepadHarness()
    const handle = vi.fn(() => true)
    render(
      <PlayerInputProvider profileActor={null}>
        <Scope handle={handle} />
      </PlayerInputProvider>,
    )
    gamepad.sample([], { mapping: "" })
    gamepad.frame()
    gamepad.sample([1], { mapping: "" })
    gamepad.frame()
    expect(handle).not.toHaveBeenCalled()
  })
  it("cancels polling on unmount and removes input listeners", () => {
    const gamepad = gamepadHarness()
    const remove = vi.spyOn(window, "removeEventListener")
    const view = render(
      <PlayerInputProvider profileActor={null}>
        <button>Go</button>
      </PlayerInputProvider>,
    )
    expect(gamepad.pendingFrames).toBe(1)
    view.unmount()
    expect(gamepad.pendingFrames).toBe(0)
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function))
  })
})
