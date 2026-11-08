import captureError from "@mapachess/diagnostics/error-diagnostic"
import encodeProfileCardGif, {
  isGifEncodingRequest,
} from "@mapachess/match-presentation/profile-card-gif"

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  try {
    if (!isGifEncodingRequest(event.data))
      throw new Error("Invalid GIF encoding request.")
    const bytes = encodeProfileCardGif(event.data)
    self.postMessage(
      { ok: true, buffer: bytes.buffer },
      { transfer: [bytes.buffer] },
    )
  } catch (error) {
    self.postMessage({ ok: false, message: captureError(error).message })
  }
})
