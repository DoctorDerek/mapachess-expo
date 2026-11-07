import { act } from "@testing-library/react"
import { onTestFinished, vi } from "vitest"

export function controlledImages() {
  const requests: {
    image: HTMLImageElement
    complete: (ready: boolean) => void
  }[] = []
  vi.stubGlobal(
    "Image",
    class {
      constructor() {
        const image = document.createElement("img")
        const decoded = Promise.withResolvers<void>()
        Object.defineProperty(image, "naturalWidth", {
          configurable: true,
          value: 64,
        })
        image.decode = () => decoded.promise
        requests.push({
          image,
          complete: (ready) =>
            ready
              ? decoded.resolve()
              : decoded.reject(new Error("Test image unavailable")),
        })
        return image
      }
    },
  )
  return {
    requests,
    async complete(ready = true) {
      await act(async () => {
        requests.forEach((request) => request.complete(ready))
      })
    },
  }
}

export function controlledAnimations() {
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "animate",
  )
  onTestFinished(() => {
    if (original === undefined)
      Reflect.deleteProperty(HTMLElement.prototype, "animate")
    else Object.defineProperty(HTMLElement.prototype, "animate", original)
  })
  const running: ReturnType<typeof animation>[] = []
  function animation() {
    const completion = Promise.withResolvers<void>()
    return {
      finished: completion.promise,
      onfinish: null as ((event: Event) => void) | null,
      pause: vi.fn(),
      play: vi.fn(),
      cancel: vi.fn(),
      stop: vi.fn(),
      finish() {
        completion.resolve()
        this.onfinish?.(new Event("finish"))
      },
    }
  }
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn(() => {
      const next = animation()
      running.push(next)
      return next
    }),
  })
  return {
    running,
    async finish() {
      await act(async () => running.at(-1)?.finish())
    },
    hide(hidden: boolean) {
      vi.spyOn(document, "hidden", "get").mockReturnValue(hidden)
      vi.spyOn(document, "visibilityState", "get").mockReturnValue(
        hidden ? "hidden" : "visible",
      )
      act(() => document.dispatchEvent(new Event("visibilitychange")))
    },
  }
}
