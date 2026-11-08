import { describe, expect, it } from "vitest"
import {
  CARD_IDLE_FRAME_MILLISECONDS,
  PROFILE_CARD_HEIGHT,
  PROFILE_CARD_WIDTH,
  profileCardAnimationFrameCount,
} from "../src/profileCardFormat.js"
import encodeProfileCardGif, {
  isGifEncodingRequest,
} from "../src/profileCardGif.js"

describe("shared profile-card GIF encoder", () => {
  it("encodes real full-size frames using the same palette for both renderers", () => {
    const frame = new Uint8Array(
      PROFILE_CARD_WIDTH * PROFILE_CARD_HEIGHT * 4,
    ).fill(255)
    const request = {
      width: PROFILE_CARD_WIDTH,
      height: PROFILE_CARD_HEIGHT,
      delay: CARD_IDLE_FRAME_MILLISECONDS,
      frames: [frame],
    }
    expect(isGifEncodingRequest(request)).toBe(true)
    const bytes = encodeProfileCardGif(request)
    expect(new TextDecoder().decode(bytes.subarray(0, 6))).toBe("GIF89a")
    const header = new DataView(bytes.buffer)
    expect(header.getUint16(6, true)).toBe(PROFILE_CARD_WIDTH)
    expect(header.getUint16(8, true)).toBe(PROFILE_CARD_HEIGHT)
    expect(bytes.at(-1)).toBe(0x3b)
  })
  it("rejects invalid dimensions or frames and honors an aborted export", () => {
    const request = {
      width: PROFILE_CARD_WIDTH,
      height: PROFILE_CARD_HEIGHT,
      delay: CARD_IDLE_FRAME_MILLISECONDS,
      frames: [],
    }
    expect(isGifEncodingRequest(request)).toBe(false)
    expect(() => encodeProfileCardGif(request)).toThrow(
      "Invalid GIF encoding request",
    )
    const abort = new AbortController()
    abort.abort(new Error("Export cancelled"))
    expect(() =>
      encodeProfileCardGif(
        {
          ...request,
          frames: [
            new Uint8Array(PROFILE_CARD_WIDTH * PROFILE_CARD_HEIGHT * 4),
          ],
        },
        abort.signal,
      ),
    ).toThrow("Export cancelled")
  })
  it("uses a full combined hero/animal animation cycle without truncation", () => {
    expect(profileCardAnimationFrameCount(6, 8)).toBe(24)
    expect(profileCardAnimationFrameCount(6, 1)).toBe(6)
  })
})
