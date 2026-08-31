import { describe, expect, it, jest } from "@jest/globals"
import { CryptoDigestAlgorithm, digestStringAsync } from "expo-crypto"
import expoSha256 from "@/lib/profile/expoSha256"

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(async () => "a".repeat(64)),
}))

describe("Expo SHA-256 adapter", () => {
  it("hashes the canonical value with Expo Crypto SHA-256", async () => {
    await expect(expoSha256("canonical-player-data")).resolves.toBe(
      "a".repeat(64),
    )
    expect(digestStringAsync).toHaveBeenCalledWith(
      CryptoDigestAlgorithm.SHA256,
      "canonical-player-data",
    )
  })
})
