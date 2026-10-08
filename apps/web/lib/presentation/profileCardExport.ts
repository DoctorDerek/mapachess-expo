import { MAX_DIAGNOSTIC_CHARACTERS } from "@mapachess/diagnostics/error-diagnostic"
import { HERO_IDLE_GEOMETRY } from "@mapachess/profile/hero-catalog"
import {
  drawProfileCard,
  loadCardArtwork,
  type CardInput,
} from "./profileCardArtwork"
import {
  CARD_IDLE_FRAME_MILLISECONDS,
  PROFILE_CARD_HEIGHT,
  PROFILE_CARD_WIDTH,
  type GifEncodingRequest,
} from "./profileCardFormat"

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const nextPaint = (signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const abort = (): void => {
      cancelAnimationFrame(frame)
      reject(signal.reason)
    }
    const frame = requestAnimationFrame(() => {
      signal.removeEventListener("abort", abort)
      resolve()
    })
    signal.addEventListener("abort", abort, { once: true })
  })

async function encodeGif(
  request: GifEncodingRequest,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  signal.throwIfAborted()
  const worker = new Worker(new URL("./profileGif.worker.ts", import.meta.url))
  const { promise, resolve, reject } = Promise.withResolvers<ArrayBuffer>()
  const abort = (): void => reject(signal.reason)
  signal.addEventListener("abort", abort, { once: true })
  worker.onmessage = (event: MessageEvent<unknown>) => {
    const result = event.data
    if (
      typeof result === "object" &&
      result !== null &&
      "ok" in result &&
      result.ok === true &&
      "buffer" in result &&
      result.buffer instanceof ArrayBuffer
    )
      resolve(result.buffer)
    else if (
      typeof result === "object" &&
      result !== null &&
      "ok" in result &&
      result.ok === false &&
      "message" in result &&
      typeof result.message === "string"
    )
      reject(
        new Error("GIF encoding failed.", {
          cause: result.message.slice(0, MAX_DIAGNOSTIC_CHARACTERS),
        }),
      )
    else reject(new Error("GIF encoding failed."))
  }
  worker.onerror = (event) => {
    event.preventDefault()
    reject(new Error("GIF encoder could not start.", { cause: event }))
  }
  const messageError = (): void =>
    reject(new Error("GIF encoder returned unreadable data."))
  worker.addEventListener("messageerror", messageError)
  try {
    worker.postMessage(
      request,
      request.frames.map((frame) => frame.buffer),
    )
    return await promise
  } finally {
    signal.removeEventListener("abort", abort)
    worker.onmessage = null
    worker.onerror = null
    worker.removeEventListener("messageerror", messageError)
    worker.terminate()
  }
}

export default async function createProfileCardFile(
  input: CardInput,
  signal: AbortSignal,
): Promise<File> {
  signal.throwIfAborted()
  const artwork = await loadCardArtwork(input.appearance, input.content.animal)
  signal.throwIfAborted()
  const canvas = document.createElement("canvas")
  canvas.width = PROFILE_CARD_WIDTH
  canvas.height = PROFILE_CARD_HEIGHT
  const context = canvas.getContext("2d", {
    willReadFrequently: input.format === "GIF",
  })
  if (context === null) throw new Error("Image rendering is unavailable.")
  if (input.format === "PNG") {
    drawProfileCard(context, artwork, input, 0)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value === null
            ? reject(new Error("PNG encoding failed."))
            : resolve(value),
        "image/png",
      ),
    )
    signal.throwIfAborted()
    return new File([blob], "Mapachess-profile.png", { type: "image/png" })
  }
  const animalFrames = artwork.animal?.animation.frameCount ?? 1
  const frameCount =
    (HERO_IDLE_GEOMETRY.frameCount * animalFrames) /
    gcd(HERO_IDLE_GEOMETRY.frameCount, animalFrames)
  const frames: Uint8Array<ArrayBuffer>[] = []
  for (let frame = 0; frame < frameCount; frame++) {
    await nextPaint(signal)
    drawProfileCard(context, artwork, input, frame)
    frames.push(
      new Uint8Array(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
      ),
    )
  }
  const buffer = await encodeGif(
    {
      width: canvas.width,
      height: canvas.height,
      delay: CARD_IDLE_FRAME_MILLISECONDS,
      frames,
    },
    signal,
  )
  signal.throwIfAborted()
  if (buffer.byteLength > 5_000_000)
    throw new Error("The GIF exceeds the 5 MB sharing budget.")
  return new File([buffer], "Mapachess-profile.gif", { type: "image/gif" })
}

export function saveProfileCardFile(file: File): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = file.name
  try {
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    URL.revokeObjectURL(url)
  }
}
