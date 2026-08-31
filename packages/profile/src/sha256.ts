const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/u

export type Sha256HexDigest = (canonicalValue: string) => Promise<string>

export const isSha256Hex = (received: unknown): received is string =>
  typeof received === "string" && SHA256_HEX_PATTERN.test(received)

export const requireSha256Hex = (received: string): string => {
  const normalized = received.toLowerCase()
  if (!isSha256Hex(normalized)) {
    throw new TypeError(
      "SHA-256 adapter returned a noncanonical hexadecimal digest.",
    )
  }
  return normalized
}
