import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_PLAYER_APPEARANCE } from "@mapachess/profile/player-appearance"
import type { CardInput } from "./profileCardArtwork"
import createProfileCardFile, { saveProfileCardFile } from "./profileCardExport"

vi.mock("./profileCardArtwork", () => ({
  drawProfileCard: vi.fn(),
  loadCardArtwork: async () => ({ hero: [], animal: null }),
}))

const input: CardInput = {
  appearance: DEFAULT_PLAYER_APPEARANCE,
  facts: { level: 1, standard: 100, chess960: 100 },
  content: { level: true, standard: true, chess960: true, animal: false },
  format: "GIF",
}

class Encoder extends EventTarget {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn()
}

const setup = () => {
  const worker = new Encoder()
  vi.stubGlobal(
    "Worker",
    class {
      constructor() {
        return worker
      }
    },
  )
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      }),
    }),
  })
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    queueMicrotask(() => callback(0))
    return 1
  })
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  return worker
}

describe("profile image export failure ownership", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each(["messageerror", "error", "invalid"] as const)(
    "releases the worker and abort listener after %s",
    async (failure) => {
      const worker = setup()
      const removeWorkerListener = vi.spyOn(worker, "removeEventListener")
      const controller = new AbortController()
      const remove = vi.spyOn(controller.signal, "removeEventListener")
      const exporting = createProfileCardFile(input, controller.signal)
      const rejected = expect(exporting).rejects.toThrow(/GIF encod/)
      await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledOnce())
      if (failure === "messageerror")
        worker.dispatchEvent(new MessageEvent("messageerror"))
      else if (failure === "error") {
        const event = new Event("error", { cancelable: true })
        worker.onerror?.(event)
        expect(event.defaultPrevented).toBe(true)
      } else
        worker.onmessage?.(new MessageEvent("message", { data: { ok: false } }))
      await rejected
      expect(worker.terminate).toHaveBeenCalledOnce()
      expect(worker.onmessage).toBeNull()
      expect(removeWorkerListener).toHaveBeenCalledWith(
        "messageerror",
        expect.any(Function),
      )
      expect(worker.onerror).toBeNull()
      expect(remove).toHaveBeenCalledWith("abort", expect.any(Function))
    },
  )

  it("cleans up cancellation during encoding without exporting a stale card", async () => {
    const worker = setup()
    const controller = new AbortController()
    const exporting = createProfileCardFile(input, controller.signal)
    const rejected = expect(exporting).rejects.toMatchObject({
      name: "AbortError",
    })
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledOnce())
    controller.abort()
    await rejected
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(worker.onmessage).toBeNull()
  })

  it("cleans up a synchronous postMessage failure and succeeds on another export", async () => {
    const worker = setup()
    worker.postMessage.mockImplementationOnce(() => {
      throw new Error("Transfer failed")
    })
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, "removeEventListener")
    await expect(
      createProfileCardFile(input, controller.signal),
    ).rejects.toThrow("Transfer failed")
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function))
    const second = setup()
    const exporting = createProfileCardFile(input, new AbortController().signal)
    await vi.waitFor(() => expect(second.postMessage).toHaveBeenCalledOnce())
    second.onmessage?.(
      new MessageEvent("message", {
        data: { ok: true, buffer: new ArrayBuffer(6) },
      }),
    )
    await expect(exporting).resolves.toMatchObject({
      name: "Mapachess-profile.gif",
      type: "image/gif",
    })
    expect(second.terminate).toHaveBeenCalledOnce()
  })

  it("removes the download anchor and revokes the URL even when clicking throws", () => {
    const remove = vi.fn()
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:recovery-test")
    const revoke = vi.spyOn(URL, "revokeObjectURL")
    vi.stubGlobal("document", {
      body: { append: vi.fn() },
      createElement: () => ({
        remove,
        click: () => {
          throw new Error("Download denied")
        },
      }),
    })
    expect(() => saveProfileCardFile(new File(["PNG"], "profile.png"))).toThrow(
      "Download denied",
    )
    expect(create).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith("blob:recovery-test")
  })
})
