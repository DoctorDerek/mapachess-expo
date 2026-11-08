import { describe, expect, it, jest } from "@jest/globals"
import {
  CryptoDigestAlgorithm,
  digest,
  digestStringAsync,
  getRandomValues,
} from "expo-crypto"
import { generateMatchSeed } from "@mapachess/gameplay/opponent"
import nativeCryptography from "@/lib/gameplay/nativeCryptography"

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: jest.fn(async () => new Uint8Array(32).fill(7).buffer),
  digestStringAsync: jest.fn(async () => "a".repeat(64)),
  getRandomValues: jest.fn((words: Uint32Array) => {
    words.set([1, 2, 3, 4])
    return words
  }),
}))

describe("native match cryptography", () => {
  it("hashes the exact opponent seed bytes without converting them to text", async () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255])
    const result = await nativeCryptography.digestBytes(bytes)
    expect(digest).toHaveBeenCalledWith(CryptoDigestAlgorithm.SHA256, bytes)
    expect([...new Uint8Array(result)]).toEqual(Array<number>(32).fill(7))
    expect(digestStringAsync).not.toHaveBeenCalled()
  })

  it("uses the shared random-word seed format", () => {
    expect(generateMatchSeed(nativeCryptography.fillRandomWords)).toBe(
      "00000001000000020000000300000004",
    )
    expect(getRandomValues).toHaveBeenCalledWith(new Uint32Array([1, 2, 3, 4]))
  })

  it("keeps canonical profile and recipe text on the existing string hash adapter", async () => {
    await expect(
      nativeCryptography.sha256("canonical-profile-and-policy"),
    ).resolves.toBe("a".repeat(64))
    expect(digestStringAsync).toHaveBeenCalledWith(
      CryptoDigestAlgorithm.SHA256,
      "canonical-profile-and-policy",
    )
    expect(digest).not.toHaveBeenCalled()
  })
})
