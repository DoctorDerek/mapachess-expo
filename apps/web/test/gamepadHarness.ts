import { act } from "@testing-library/react"
import { onTestFinished, vi } from "vitest"

export default function gamepadHarness() {
  let sequence = 0
  let now = 0
  const pending = new Map<number, FrameRequestCallback>()
  let pads: readonly (Gamepad | null)[] = []
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pending.set(++sequence, callback)
    return sequence
  })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => pending.delete(id))
  vi.spyOn(document, "hasFocus").mockReturnValue(true)
  vi.spyOn(document, "hidden", "get").mockReturnValue(false)
  const originalGetGamepads = Object.getOwnPropertyDescriptor(
    navigator,
    "getGamepads",
  )
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => pads,
  })
  onTestFinished(() => {
    if (originalGetGamepads === undefined)
      Reflect.deleteProperty(navigator, "getGamepads")
    else Object.defineProperty(navigator, "getGamepads", originalGetGamepads)
  })
  return {
    get pendingFrames() {
      return pending.size
    },
    sample(
      buttons: readonly number[],
      options: Partial<
        Pick<Gamepad, "index" | "id" | "mapping" | "connected" | "axes">
      > = {},
    ) {
      const pad: Gamepad = {
        index: 0,
        id: "Xbox Controller",
        mapping: "standard",
        connected: true,
        axes: [0, 0, 0, 0],
        timestamp: now,
        buttons: Array.from({ length: 16 }, (_, index) => ({
          pressed: (buttons[index] ?? 0) > 0.5,
          touched: false,
          value: buttons[index] ?? 0,
        })),
        vibrationActuator: {
          playEffect: async () => "complete",
          reset: async () => "complete",
        },
        ...options,
      }
      pads = [pad]
    },
    disconnect() {
      pads = []
    },
    frame(elapsed = 16) {
      now += elapsed
      act(() => {
        const callbacks = [...pending.values()]
        pending.clear()
        callbacks.forEach((callback) => callback(now))
      })
    },
    press(index: number) {
      this.sample([])
      this.frame()
      this.sample(
        Array.from({ length: index + 1 }, (_, slot) =>
          slot === index ? 1 : 0,
        ),
      )
      this.frame()
    },
  }
}
