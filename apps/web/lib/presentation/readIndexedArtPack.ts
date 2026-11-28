export const ART_PACK_HEADER_BYTES = Uint32Array.BYTES_PER_ELEMENT

export type PackedMediaType = "image/webp" | "image/png" | "image/svg+xml"
type EncodedMember = {
  bytes: Uint8Array
  mediaType: PackedMediaType
  url?: string
}

export default function readIndexedArtPack(
  buffer: ArrayBuffer,
  expectedSources: number,
  sourceFor: (path: string) => string,
  mediaTypeFor: (source: string) => PackedMediaType | undefined,
): (source: string) => string | undefined {
  const invalid = () => new Error("Invalid indexed art pack.")
  if (buffer.byteLength < ART_PACK_HEADER_BYTES) throw invalid()
  const indexLength = new DataView(buffer).getUint32(0, true)
  let offset = ART_PACK_HEADER_BYTES + indexLength
  if (offset > buffer.byteLength) throw invalid()
  const index: unknown = JSON.parse(
    new TextDecoder().decode(
      new Uint8Array(buffer, ART_PACK_HEADER_BYTES, indexLength),
    ),
  )
  if (!Array.isArray(index)) throw invalid()
  const members = new Map<string, EncodedMember>()
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
    let member: EncodedMember | undefined
    for (const path of aliases) {
      if (typeof path !== "string") throw invalid()
      const source = sourceFor(path)
      const mediaType = mediaTypeFor(source)
      if (
        !mediaType ||
        members.has(source) ||
        (member && member.mediaType !== mediaType)
      )
        throw invalid()
      member ??= { bytes: new Uint8Array(buffer, offset, length), mediaType }
      members.set(source, member)
    }
    offset += length
  }
  if (
    offset !== buffer.byteLength ||
    members.size !== expectedSources ||
    members.size === 0
  )
    throw invalid()
  return (source: string): string | undefined => {
    const member = members.get(source)
    if (member === undefined) return undefined
    if (member.url === undefined) {
      let binary = ""
      for (const byte of member.bytes) binary += String.fromCharCode(byte)
      member.url = `data:${member.mediaType};base64,${btoa(binary)}`
    }
    return member.url
  }
}
