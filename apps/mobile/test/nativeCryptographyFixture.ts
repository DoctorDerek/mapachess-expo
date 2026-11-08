import { createHash } from "node:crypto"
import type { NativeMatchCryptography } from "@/lib/gameplay/nativeCryptography"

const nativeCryptographyFixture: NativeMatchCryptography = {
  digestBytes: async (bytes) =>
    Uint8Array.from(createHash("sha256").update(bytes).digest()).buffer,
  fillRandomWords: (words) => {
    words.set([1, 2, 3, 4])
    return words
  },
  sha256: async (text) => createHash("sha256").update(text).digest("hex"),
}

export default nativeCryptographyFixture
