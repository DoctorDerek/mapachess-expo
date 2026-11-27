import { presentationAssetSource } from "@mapachess/match-presentation/presentation-assets"

export const CHARACTER_PACK_HEADER_BYTES = Uint32Array.BYTES_PER_ELEMENT

export function isCharacterArtSource(source: string): boolean {
  return (
    source.startsWith(presentationAssetSource("battle/")) ||
    source.startsWith(presentationAssetSource("profile/hero/"))
  )
}

type EncodedStrip = { bytes: Uint8Array; url?: string }

export function readCharacterArtPack(
  buffer: ArrayBuffer,
  expectedSources: number,
): (source: string) => string | undefined {
  const invalid = () => new Error("Invalid character art pack.")
  if (buffer.byteLength < CHARACTER_PACK_HEADER_BYTES) throw invalid()
  const indexLength = new DataView(buffer).getUint32(0, true)
  let offset = CHARACTER_PACK_HEADER_BYTES + indexLength
  if (offset > buffer.byteLength) throw invalid()
  const index: unknown = JSON.parse(
    new TextDecoder().decode(
      new Uint8Array(buffer, CHARACTER_PACK_HEADER_BYTES, indexLength),
    ),
  )
  if (!Array.isArray(index)) throw invalid()
  const strips = new Map<string, EncodedStrip>()
  for (const item of index) {
    if (!Array.isArray(item) || item.length !== 2) throw invalid()
    const [aliases, length] = item
    if (
      !Array.isArray(aliases) ||
      aliases.length === 0 ||
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < 1 ||
      offset + length > buffer.byteLength
    )
      throw invalid()
    const strip: EncodedStrip = {
      bytes: new Uint8Array(buffer, offset, length),
    }
    for (const path of aliases) {
      if (typeof path !== "string") throw invalid()
      const source = presentationAssetSource(path)
      if (!isCharacterArtSource(source) || strips.has(source)) throw invalid()
      strips.set(source, strip)
    }
    offset += length
  }
  if (
    offset !== buffer.byteLength ||
    strips.size !== expectedSources ||
    strips.size === 0
  )
    throw invalid()
  return (source: string): string | undefined => {
    const strip = strips.get(source)
    if (strip === undefined) return undefined
    if (strip.url === undefined) {
      let binary = ""
      for (const byte of strip.bytes) binary += String.fromCharCode(byte)
      strip.url = `data:image/webp;base64,${btoa(binary)}`
    }
    return strip.url
  }
}
