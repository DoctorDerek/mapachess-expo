import { File, Paths } from "expo-file-system"
import { isAvailableAsync, shareAsync } from "expo-sharing"
import { decode, toRGBA8 } from "upng-js"
import {
  CARD_IDLE_FRAME_MILLISECONDS,
  PROFILE_CARD_HEIGHT,
  PROFILE_CARD_WIDTH,
} from "@mapachess/match-presentation/profile-card-format"
import encodeProfileCardGif, {
  MAX_PROFILE_GIF_FRAMES,
} from "@mapachess/match-presentation/profile-card-gif"
import type { CardInput } from "@mapachess/profile/profile-card-model"
import assets from "./nativeAssetManifest"
import nativeCardAssetIds, { nativeCardFrameCount } from "./nativeCardAssets"

export default async function shareNativeCard(
  input: CardInput,
  capture: (frame: number, signal: AbortSignal) => Promise<string>,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted()
  if (nativeCardAssetIds(input).some((id) => assets.images[id] === undefined))
    throw new Error("The selected profile artwork is unavailable.")
  if (!(await isAvailableAsync()))
    throw new Error("Native image sharing is unavailable.")
  const files: File[] = []
  try {
    const first = new File(await capture(0, signal))
    files.push(first)
    signal.throwIfAborted()
    let output = first
    if (input.format === "GIF") {
      const count = nativeCardFrameCount(input)
      if (count > MAX_PROFILE_GIF_FRAMES)
        throw new Error("The selected animation exceeds the card frame budget.")
      const frames: Uint8Array<ArrayBuffer>[] = []
      for (let index = 0; index < count; index++) {
        signal.throwIfAborted()
        const file =
          index === 0 ? first : new File(await capture(index, signal))
        if (index > 0) files.push(file)
        const png = decode(Uint8Array.from(await file.bytes()).buffer)
        if (
          png.width !== PROFILE_CARD_WIDTH ||
          png.height !== PROFILE_CARD_HEIGHT ||
          png.frames.length !== 0
        )
          throw new Error(
            "The native card capture has an unsupported pixel format.",
          )
        const [rgba] = toRGBA8(png)
        if (rgba?.byteLength !== PROFILE_CARD_WIDTH * PROFILE_CARD_HEIGHT * 4)
          throw new Error(
            "The native card capture did not decode to RGBA pixels.",
          )
        frames.push(new Uint8Array(rgba))
      }
      const encoded = encodeProfileCardGif(
        {
          width: PROFILE_CARD_WIDTH,
          height: PROFILE_CARD_HEIGHT,
          delay: CARD_IDLE_FRAME_MILLISECONDS,
          frames,
        },
        signal,
      )
      output = new File(Paths.cache, "Mapachess-profile.gif")
      output.create({ overwrite: true })
      files.push(output)
      output.write(encoded)
    }
    signal.throwIfAborted()
    await shareAsync(output.uri, {
      mimeType: input.format === "GIF" ? "image/gif" : "image/png",
      UTI: input.format === "GIF" ? "com.compuserve.gif" : "public.png",
    })
  } finally {
    for (const file of files) if (file.exists) file.delete()
  }
}
