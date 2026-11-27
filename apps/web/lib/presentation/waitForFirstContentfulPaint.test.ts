import { afterEach, expect, it, vi } from "vitest"
import waitForFirstContentfulPaint from "./waitForFirstContentfulPaint"

function paintTimeline(alreadyPainted = false) {
  const tab = Object.assign(new EventTarget(), { visibilityState: "visible" })
  vi.stubGlobal("document", tab)
  vi.stubGlobal("performance", {
    getEntriesByName: () => (alreadyPainted ? [{}] : []),
  })
  const observe = vi.fn()
  const disconnect = vi.fn()
  let report: (name: string) => void
  vi.stubGlobal(
    "PerformanceObserver",
    class {
      static supportedEntryTypes = ["paint"]
      observe = observe
      disconnect = disconnect
      constructor(
        callback: (entries: {
          getEntriesByName: (name: string, type: string) => unknown[]
        }) => void,
      ) {
        report = (name) =>
          callback({
            getEntriesByName: (query, type) =>
              query === name && type === "paint" ? [{}] : [],
          })
      }
    },
  )
  return {
    observe,
    disconnect,
    report: (name: string) => report(name),
    hide: () => {
      tab.visibilityState = "hidden"
      tab.dispatchEvent(new Event("visibilitychange"))
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

it("waits for a buffered contentful paint and ignores an earlier empty paint", async () => {
  const timeline = paintTimeline()
  const ready = vi.fn()
  const waiting = waitForFirstContentfulPaint().then(ready)
  expect(timeline.observe).toHaveBeenCalledWith({
    type: "paint",
    buffered: true,
  })
  timeline.report("first-paint")
  await Promise.resolve()
  expect(ready).not.toHaveBeenCalled()
  timeline.report("first-contentful-paint")
  await waiting
  expect(ready).toHaveBeenCalledOnce()
  expect(timeline.disconnect).toHaveBeenCalledOnce()
})

it("continues immediately after a recorded paint or when the tab is already hidden", async () => {
  const painted = paintTimeline(true)
  await waitForFirstContentfulPaint()
  expect(painted.observe).not.toHaveBeenCalled()
  const hidden = paintTimeline()
  hidden.hide()
  await waitForFirstContentfulPaint()
  expect(hidden.observe).not.toHaveBeenCalled()
})

it("releases an outstanding paint observer when the tab goes into the background", async () => {
  const timeline = paintTimeline()
  const waiting = waitForFirstContentfulPaint()
  timeline.hide()
  await waiting
  expect(timeline.disconnect).toHaveBeenCalledOnce()
})

it.each([false, true])(
  "yields two frames without paint reporting or releases the wait on hide (%s)",
  async (hide) => {
    const timeline = paintTimeline()
    vi.stubGlobal("PerformanceObserver", undefined)
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      frames.push(callback),
    )
    const cancel = vi.fn()
    vi.stubGlobal("cancelAnimationFrame", cancel)
    const ready = vi.fn()
    const waiting = waitForFirstContentfulPaint().then(ready)
    frames[0]!(0)
    await Promise.resolve()
    expect(ready).not.toHaveBeenCalled()
    if (hide) timeline.hide()
    else frames[1]!(16)
    await waiting
    expect(ready).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledWith(2)
  },
)
