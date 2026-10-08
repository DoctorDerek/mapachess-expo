import { afterEach, describe, expect, it, vi } from "vitest"
import { createActor, fromPromise, waitFor } from "xstate"
import { MAX_DIAGNOSTIC_CHARACTERS } from "@mapachess/diagnostics/error-diagnostic"
import { DEFAULT_PLAYER_APPEARANCE } from "@mapachess/profile/player-appearance"
import type { CardInput } from "./profileCardArtwork"
import createProfileCardFile, { saveProfileCardFile } from "./profileCardExport"
import profileCardExportMachine from "./profileCardExportMachine"
import {
  CARD_IDLE_FRAME_MILLISECONDS,
  PROFILE_CARD_HEIGHT,
  PROFILE_CARD_WIDTH,
} from "./profileCardFormat"

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

  it("retains a bounded encoder message as the cause without changing recovery copy", async () => {
    const worker = setup()
    const exporting = createProfileCardFile(input, new AbortController().signal)
    const message = "Encoder failed " + "x".repeat(MAX_DIAGNOSTIC_CHARACTERS)
    const rejected = expect(exporting).rejects.toMatchObject({
      message: "GIF encoding failed.",
      cause: message.slice(0, MAX_DIAGNOSTIC_CHARACTERS),
    })
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledOnce())
    worker.onmessage?.(
      new MessageEvent("message", { data: { ok: false, message } }),
    )
    await rejected
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it("retains the export actor's original failure until retry without changing the card input", async () => {
    const failure = { message: "Image decode failed" }
    const render = vi
      .fn<() => Promise<File>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(new File(["PNG"], "profile.png"))
    const actor = createActor(
      profileCardExportMachine.provide({
        actors: { render: fromPromise<File, CardInput>(render) },
      }),
      { input },
    ).start()
    actor.send({ type: "CARD.PREVIEW_CHANGED", input })
    await waitFor(actor, (snapshot) => snapshot.matches("failed"))
    expect(actor.getSnapshot().context.failure).toEqual({
      message: failure.message,
      cause: failure,
    })
    expect(actor.getSnapshot().context.failure?.cause).toBe(failure)
    expect(actor.getSnapshot().context.input).toBe(input)
    expect(actor.getSnapshot().context.file).toBeNull()
    actor.send({ type: "CARD.RETRY_REQUESTED" })
    expect(actor.getSnapshot().context.failure).toBeNull()
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(actor.getSnapshot().context.file?.name).toBe("profile.png")
    expect(actor.getSnapshot().context.failure).toBeNull()
    actor.stop()
  })

  it("discards a canceled preview failure without reporting it on the replacement", async () => {
    const obsolete = Promise.withResolvers<File>()
    const current = Promise.withResolvers<File>()
    const render = vi
      .fn<() => Promise<File>>()
      .mockReturnValueOnce(obsolete.promise)
      .mockReturnValueOnce(current.promise)
    const actor = createActor(
      profileCardExportMachine.provide({
        actors: { render: fromPromise<File, CardInput>(render) },
      }),
      { input },
    ).start()
    actor.send({ type: "CARD.PREVIEW_CHANGED", input })
    actor.send({
      type: "CARD.PREVIEW_CHANGED",
      input: { ...input, format: "PNG" },
    })
    obsolete.reject(new Error("Obsolete preview was aborted"))
    const file = new File(["PNG"], "current.png")
    current.resolve(file)
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(actor.getSnapshot().context.file).toBe(file)
    expect(actor.getSnapshot().context.failure).toBeNull()
    actor.stop()
  })

  it("returns only a clone-safe diagnostic from the GIF Worker after a malformed request", async () => {
    const worker = new EventTarget()
    const postMessage = vi.fn()
    vi.stubGlobal("self", Object.assign(worker, { postMessage }))
    vi.resetModules()
    await import("./profileGif.worker")
    worker.dispatchEvent(new MessageEvent("message", { data: {} }))
    expect(postMessage).toHaveBeenCalledWith({
      ok: false,
      message: "Invalid GIF encoding request.",
    })
    expect(structuredClone(postMessage.mock.calls[0]?.[0])).toEqual({
      ok: false,
      message: "Invalid GIF encoding request.",
    })
    vi.resetModules()
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

  it("keeps a stationary footer color stable when animation colors share a quantizer bucket", async () => {
    const footerColors: number[][] = []
    vi.doMock("gifenc", async (importOriginal) => {
      const actual = await importOriginal<typeof import("gifenc")>()
      return {
        ...actual,
        GIFEncoder: () => {
          const encoder = actual.GIFEncoder()
          const writeFrame: typeof encoder.writeFrame = (
            indices,
            width,
            height,
            options,
          ) => {
            const footerIndex = indices.at(-1)
            if (footerIndex === undefined)
              throw new Error("Expected a full encoded frame")
            footerColors.push(options.palette[footerIndex] ?? [])
            encoder.writeFrame(indices, width, height, options)
          }
          return { ...encoder, writeFrame }
        },
      }
    })
    const receiver = new EventTarget()
    const postMessage = vi.fn()
    vi.stubGlobal("self", {
      addEventListener: receiver.addEventListener.bind(receiver),
      postMessage,
    })
    try {
      await import("./profileGif.worker")
      const first = new Uint8Array(
        PROFILE_CARD_WIDTH * PROFILE_CARD_HEIGHT * 4,
      ).fill(255)
      new Uint32Array(first.buffer).fill(
        0xfff8fcf8,
        0,
        (PROFILE_CARD_WIDTH * PROFILE_CARD_HEIGHT) / 2,
      )
      const second = new Uint8Array(first.length).fill(255)
      receiver.dispatchEvent(
        new MessageEvent("message", {
          data: {
            width: PROFILE_CARD_WIDTH,
            height: PROFILE_CARD_HEIGHT,
            delay: CARD_IDLE_FRAME_MILLISECONDS,
            frames: [first, second],
          },
        }),
      )
      expect(postMessage).toHaveBeenCalledWith(
        { ok: true, buffer: expect.any(ArrayBuffer) },
        expect.any(Object),
      )
      expect(footerColors).toHaveLength(2)
      expect(footerColors[0]).toHaveLength(3)
      expect(footerColors[1]).toEqual(footerColors[0])
    } finally {
      vi.doUnmock("gifenc")
      vi.resetModules()
    }
  })
})
