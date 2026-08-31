const hexadecimalByte = (byte: number): string =>
  byte.toString(16).padStart(2, "0")

export type Sha256SubtleCrypto = Pick<SubtleCrypto, "digest">

export default async function webSha256(
  canonicalValue: string,
  subtleCrypto: Sha256SubtleCrypto,
): Promise<string> {
  const digest = await subtleCrypto.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalValue),
  )
  return Array.from(new Uint8Array(digest), hexadecimalByte).join("")
}
