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
self.addEventListener("message", (event: MessageEvent<unknown>) => {
  try {
    if (!isRequest(event.data)) throw new Error("Invalid GIF encoding request.")
    const { width, height, delay, frames } = event.data
    const encoder = GIFEncoder()
    for (const frame of frames) {
      const palette = quantize(frame, 256)
      encoder.writeFrame(applyPalette(frame, palette), width, height, {
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
