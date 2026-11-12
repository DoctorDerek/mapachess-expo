// @vitest-environment happy-dom
import { act, render, screen } from "@testing-library/react"
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

  it("returns to keyboard mode when browser controller access fails, then re-arms on focus", () => {
    const gamepad = gamepadHarness()
    const handle = vi.fn(() => true)
    render(
      <PlayerInputProvider profileActor={null}>
        <Scope handle={handle} />
      </PlayerInputProvider>,
    )
    gamepad.press(2)
    expect(screen.getByLabelText("Device").textContent).toBe("controller")
    const denied = vi
      .spyOn(navigator, "getGamepads")
      .mockImplementationOnce(() => {
        throw new DOMException("Controller permission denied", "SecurityError")
      })
    gamepad.frame()
    expect(screen.getByLabelText("Device").textContent).toBe("keyboard")
    gamepad.press(2)
    expect(denied).toHaveBeenCalledTimes(1)
    expect(handle).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event("focus"))
    gamepad.frame()
    expect(handle).toHaveBeenCalledTimes(1)
    gamepad.press(2)
    expect(handle).toHaveBeenCalledTimes(2)
  })

  it("does not carry a held command through a foreground dialog or document visibility change", () => {
    const gamepad = gamepadHarness()
    const handle = vi.fn(() => true)
    const modal = vi.fn(() => true)
    const view = render(
      <PlayerInputProvider profileActor={null}>
        <Scope handle={handle} />
      </PlayerInputProvider>,
    )
    gamepad.press(13)
    expect(handle).toHaveBeenCalledTimes(1)
    view.rerender(
      <PlayerInputProvider profileActor={null}>
        <Scope handle={handle} />
        <dialog aria-label="Menu" open>
          <Scope handle={modal} />
        </dialog>
      </PlayerInputProvider>,
    )
    gamepad.frame(600)
    expect(modal).not.toHaveBeenCalled()
    gamepad.press(13)
    expect(modal).toHaveBeenCalledExactlyOnceWith(
      "down",
      expect.objectContaining({ method: "controller" }),
    )
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true)
    document.dispatchEvent(new Event("visibilitychange"))
    gamepad.frame(600)
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event("visibilitychange"))
    gamepad.frame(600)
    expect(modal).toHaveBeenCalledTimes(1)
    gamepad.press(13)
    expect(modal).toHaveBeenCalledTimes(2)
    expect(handle).toHaveBeenCalledTimes(1)
  })

  it("handles hardware keys without stealing browser shortcuts, radio arrows or text editing", () => {
    const gamepad = gamepadHarness()
    const listen = vi.spyOn(window, "addEventListener")
    const handle = vi.fn((_action: PlayerInputAction) => true)
    render(
      <PlayerInputProvider profileActor={null}>
        <Scope handle={handle} />
        <input aria-label="Exact Elo" />
        <input type="radio" aria-label="Standard Chess" />
      </PlayerInputProvider>,
    )
    const deliver = (event: Event, trusted: boolean, target?: HTMLElement) => {
      const listener = listen.mock.calls.find(
        ([type]) => type === event.type,
      )?.[1]
      if (typeof listener !== "function")
        throw new Error(`Expected a ${event.type} listener`)
      const dispatch: EventListener = listener
      act(() =>
        dispatch(
          new Proxy(event, {
            get(original, property) {
              if (property === "isTrusted") return trusted
              if (property === "target" && target !== undefined) return target
              const value: unknown = Reflect.get(original, property, original)
              return typeof value === "function" ? value.bind(original) : value
            },
          }),
        ),
      )
    }
    const key = (
      code: string,
      options: KeyboardEventInit = {},
      target?: HTMLElement,
      trusted = true,
    ) => {
      const event = new KeyboardEvent("keydown", {
        code,
        cancelable: true,
        ...options,
      })
      deliver(event, trusted, target)
      return event.defaultPrevented
    }
    expect(key("KeyH", {}, undefined, false)).toBe(false)
    for (const modifier of [
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { isComposing: true },
    ])
      expect(key("KeyH", modifier)).toBe(false)
    expect(
      key("KeyH", {}, screen.getByRole("textbox", { name: "Exact Elo" })),
    ).toBe(false)
    expect(
      key(
        "ArrowRight",
        {},
        screen.getByRole("radio", { name: "Standard Chess" }),
      ),
    ).toBe(false)
    expect(key("KeyQ")).toBe(false)
    expect(key("KeyH", { repeat: true })).toBe(true)
    expect(handle).not.toHaveBeenCalled()
    expect(key("KeyH")).toBe(true)
    expect(key("ArrowRight", { repeat: true })).toBe(true)
    expect(
      key("Escape", {}, screen.getByRole("textbox", { name: "Exact Elo" })),
    ).toBe(true)
    expect(handle.mock.calls.map(([action]) => action)).toEqual([
      "hints",
      "right",
      "cancel",
    ])
    gamepad.press(2)
    const device = screen.getByLabelText("Device")
    expect(device.textContent).toBe("controller")
    const disconnect = new Event("gamepaddisconnected")
    Object.defineProperty(disconnect, "gamepad", { value: { index: 0 } })
    deliver(disconnect, true)
    expect(device.textContent).toBe("keyboard")
    deliver(new PointerEvent("pointerdown", { pointerType: "touch" }), false)
    expect(device.textContent).toBe("keyboard")
    deliver(new PointerEvent("pointerdown", { pointerType: "touch" }), true)
    expect(device.textContent).toBe("touch")
    deliver(new PointerEvent("pointerdown", { pointerType: "mouse" }), true)
    expect(device.textContent).toBe("pointer")
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
