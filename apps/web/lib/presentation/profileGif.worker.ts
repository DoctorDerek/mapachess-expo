import { applyPalette, GIFEncoder, quantize } from "gifenc"
import {
  CARD_IDLE_FRAME_MILLISECONDS,
  PROFILE_CARD_HEIGHT,
  PROFILE_CARD_WIDTH,
  type GifEncodingRequest,
} from "./profileCardFormat"

const isRequest = (value: unknown): value is GifEncodingRequest =>
  typeof value === "object" &&
  value !== null &&
  "width" in value &&
  value.width === PROFILE_CARD_WIDTH &&
  "height" in value &&
  value.height === PROFILE_CARD_HEIGHT &&
  "delay" in value &&
  value.delay === CARD_IDLE_FRAME_MILLISECONDS &&
  "frames" in value &&
  Array.isArray(value.frames) &&
  value.frames.length > 0 &&
  value.frames.length <= 120 &&
  value.frames.every(
    (frame: unknown) =>
      frame instanceof Uint8Array &&
      frame.length === PROFILE_CARD_WIDTH * PROFILE_CARD_HEIGHT * 4,
  )

function animationColors(frames: GifEncodingRequest["frames"]): Readonly<{
  palette: number[][]
  indices: ReadonlyMap<number, number>
}> {
  const frequencies = new Map<number, number>()
  for (const frame of frames) {
    const pixels = new Uint32Array(
      frame.buffer,
      frame.byteOffset,
      frame.byteLength / 4,
    )
    for (const color of pixels)
      frequencies.set(color, (frequencies.get(color) ?? 0) + 1)
  }
  // INVARIANT: Include every animation color using about one frame of averaged pixel counts.
  const samples = new Uint32Array(
    [...frequencies.values()].reduce(
      (sum, count) => sum + Math.ceil(count / frames.length),
      0,
    ),
  )
  let offset = 0
  for (const [color, count] of frequencies) {
    const end = offset + Math.ceil(count / frames.length)
    samples.fill(color, offset, end)
    offset = end
  }
  const palette = quantize(new Uint8Array(samples.buffer), 256)
  const colors = Uint32Array.from(frequencies.keys())
  const mapped = applyPalette(new Uint8Array(colors.buffer), palette)
  const indices = new Map<number, number>()
  for (const [index, color] of colors.entries()) {
    const mappedIndex = mapped[index]
    if (mappedIndex === undefined) throw new Error("GIF color mapping failed.")
    indices.set(color, mappedIndex)
  }
  return { palette, indices }
}

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  try {
    if (!isRequest(event.data)) throw new Error("Invalid GIF encoding request.")
    const { width, height, delay, frames } = event.data
    const encoder = GIFEncoder()
    const { palette, indices } = animationColors(frames)
    for (const frame of frames) {
      const pixels = new Uint32Array(
        frame.buffer,
        frame.byteOffset,
        frame.byteLength / 4,
      )
      const mapped = Uint8Array.from(pixels, (color) => {
        const index = indices.get(color)
        if (index === undefined) throw new Error("GIF frame color is missing.")
        return index
      })
      encoder.writeFrame(mapped, width, height, {
        palette,
        delay,
        repeat: 0,
      })
    }
    encoder.finish()
    const bytes = new Uint8Array(encoder.bytes())
    self.postMessage(
      { ok: true, buffer: bytes.buffer },
      { transfer: [bytes.buffer] },
    )
  } catch {
    self.postMessage({ ok: false })
  }
})
