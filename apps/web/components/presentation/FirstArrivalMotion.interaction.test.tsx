// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest"
import useFirstArrivalMotion from "../../lib/presentation/useFirstArrivalMotion"
import { installDomHarness } from "../../test/domHarness"

const runtime = vi.hoisted(() => {
  const instances: {
    onAdvance: () => void
    onStop: () => void
    onLoadError: () => void
  }[] = []
  return {
    instances,
    cleanup: vi.fn(),
    wasm: vi.fn(),
    fallback: vi.fn(),
    gate: Promise.withResolvers<void>(),
  }
})
vi.mock("@rive-app/canvas-lite", () => ({
  Rive: class {
    cleanup = runtime.cleanup
    constructor(callbacks: (typeof runtime.instances)[number]) {
      runtime.instances.push(callbacks)
    }
  },
  Layout: class {},
  Fit: { Cover: "cover" },
  Alignment: { Center: "center" },
  RuntimeLoader: {
    setWasmUrl: runtime.wasm,
    setWasmFallbackUrl: runtime.fallback,
    awaitInstance: () => runtime.gate.promise,
  },
}))
installDomHarness()
beforeEach(() => {
  runtime.instances.length = 0
  runtime.gate = Promise.withResolvers<void>()
  vi.clearAllMocks()
  vi.spyOn(document, "readyState", "get").mockReturnValue("complete")
  vi.spyOn(document, "hidden", "get").mockReturnValue(false)
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: false,
    media,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})

function Arrival({ enabled = true }: { enabled?: boolean }) {
  const motion = useFirstArrivalMotion(enabled)
  return (
    <>
      <canvas ref={motion.canvasRef} />
      <output>
        {motion.visible ? "Introduction pending" : "Introduction dismissed"}
      </output>
      {motion.runRaccoon ? <p>Raccoon advanced</p> : null}
      <button onClick={motion.cancel}>Continue immediately</button>
    </>
  )
}

function idle() {
  const originalRequest = Object.getOwnPropertyDescriptor(
    window,
    "requestIdleCallback",
  )
  const originalCancel = Object.getOwnPropertyDescriptor(
    window,
    "cancelIdleCallback",
  )
  onTestFinished(() => {
    if (originalRequest === undefined)
      Reflect.deleteProperty(window, "requestIdleCallback")
    else Object.defineProperty(window, "requestIdleCallback", originalRequest)
    if (originalCancel === undefined)
      Reflect.deleteProperty(window, "cancelIdleCallback")
    else Object.defineProperty(window, "cancelIdleCallback", originalCancel)
  })
  const pending = new Map<number, IdleRequestCallback>()
  const request = vi.fn((callback: IdleRequestCallback) => {
    pending.set(1, callback)
    return 1
  })
  const cancel = vi.fn((id: number) => pending.delete(id))
  Object.defineProperties(window, {
    requestIdleCallback: { configurable: true, value: request },
    cancelIdleCallback: { configurable: true, value: cancel },
  })
  return {
    request,
    cancel,
    start: () =>
      act(() => {
        pending.get(1)?.({ didTimeout: false, timeRemaining: () => 1 })
        pending.clear()
      }),
  }
}

describe("deferred first-arrival animation lifecycle", () => {
  it("waits for browser idle and the self-hosted runtime, then advances and cleans up on completion", async () => {
    const schedule = idle()
    const view = render(<Arrival />)
    expect(schedule.request).toHaveBeenCalledOnce()
    expect(runtime.instances).toHaveLength(0)
    schedule.start()
    await waitFor(() =>
      expect(runtime.wasm).toHaveBeenCalledWith(
        "/generated/first-arrival/rive.wasm",
      ),
    )
    expect(runtime.fallback).toHaveBeenCalledWith(
      "/generated/first-arrival/rive_fallback.wasm",
    )
    await act(async () => runtime.gate.resolve())
    const instance = runtime.instances[0]
    if (instance === undefined)
      throw new Error("The ready runtime must create one animation.")
    act(() => {
      instance.onAdvance()
      instance.onAdvance()
    })
    expect(screen.getByText("Raccoon advanced")).toBeTruthy()
    act(() => instance.onStop())
    expect(screen.getByText("Introduction dismissed")).toBeTruthy()
    expect(runtime.cleanup).toHaveBeenCalledOnce()
    view.unmount()
  })

  it("cancels pending idle work immediately when the player proceeds", () => {
    const schedule = idle()
    render(<Arrival />)
    fireEvent.click(
      screen.getByRole("button", { name: "Continue immediately" }),
    )
    expect(schedule.cancel).toHaveBeenCalledWith(1)
    schedule.start()
    expect(runtime.instances).toHaveLength(0)
    expect(screen.getByText("Introduction dismissed")).toBeTruthy()
  })

  it("does not instantiate an animation after unmount while WASM is pending", async () => {
    const schedule = idle()
    const view = render(<Arrival />)
    schedule.start()
    await waitFor(() => expect(runtime.wasm).toHaveBeenCalled())
    view.unmount()
    await act(async () => runtime.gate.resolve())
    expect(runtime.instances).toHaveLength(0)
  })

  it("recovers a runtime rejection without trapping first arrival", async () => {
    const schedule = idle()
    render(<Arrival />)
    schedule.start()
    await waitFor(() => expect(runtime.wasm).toHaveBeenCalled())
    await act(async () => runtime.gate.reject(new Error("Runtime unavailable")))
    expect(screen.getByText("Introduction dismissed")).toBeTruthy()
  })

  it("finishes an asset error and removes the loaded runtime", async () => {
    const schedule = idle()
    render(<Arrival />)
    schedule.start()
    await waitFor(() => expect(runtime.wasm).toHaveBeenCalled())
    await act(async () => runtime.gate.resolve())
    act(() => runtime.instances[0]?.onLoadError())
    expect(screen.getByText("Introduction dismissed")).toBeTruthy()
    expect(runtime.cleanup).toHaveBeenCalledOnce()
  })

  it("waits for page load, and cancels on backgrounding without starting work", () => {
    const schedule = idle()
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading")
    render(<Arrival />)
    expect(schedule.request).not.toHaveBeenCalled()
    fireEvent(window, new Event("load"))
    expect(schedule.request).toHaveBeenCalledOnce()
    vi.spyOn(document, "hidden", "get").mockReturnValue(true)
    fireEvent(document, new Event("visibilitychange"))
    expect(screen.getByText("Introduction dismissed")).toBeTruthy()
    expect(schedule.cancel).toHaveBeenCalled()
  })

  it("does not schedule optional motion before the feature is enabled", () => {
    const schedule = idle()
    render(<Arrival enabled={false} />)
    expect(schedule.request).not.toHaveBeenCalled()
    expect(runtime.instances).toHaveLength(0)
  })
})
