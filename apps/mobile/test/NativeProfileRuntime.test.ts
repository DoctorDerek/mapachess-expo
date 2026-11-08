import { describe, expect, it, jest } from "@jest/globals"
import { waitFor } from "@testing-library/react-native"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import { MAPACHESS_ASYNC_STORAGE_NAMESPACE } from "@/lib/profile/AsyncStorageDurableStore"
import openNativeProfileRuntime from "@/lib/profile/openNativeProfileRuntime"
import InMemoryAsyncStorage from "./nativeStorageFixture"

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => {
    const { createHash } =
      jest.requireActual<typeof import("node:crypto")>("node:crypto")
    return createHash("sha256").update(value).digest("hex")
  }),
}))

describe("native profile runtime", () => {
  it("opens canonical player data through the actual native storage adapter", async () => {
    const storage = new InMemoryAsyncStorage()
    const runtime = await openNativeProfileRuntime({ storage })
    try {
      await waitFor(() =>
        expect(runtime.actor.getSnapshot().matches("ready")).toBe(true),
      )
      const player = selectCurrentPlayerData(runtime.actor.getSnapshot())
      expect(player?.activeMatch).toBeNull()
      expect(player?.schema).toBe("mapachess-player-data")
      expect(
        storage.values.has(MAPACHESS_ASYNC_STORAGE_NAMESPACE + "/current"),
      ).toBe(true)
    } finally {
      await runtime.close()
    }
  })

  it("preserves unreadable bytes and enters shared recovery instead of resetting", async () => {
    const storage = new InMemoryAsyncStorage()
    const key = MAPACHESS_ASYNC_STORAGE_NAMESPACE + "/current"
    storage.values.set(key, "unreadable-player-save")
    const runtime = await openNativeProfileRuntime({ storage })
    try {
      await waitFor(() =>
        expect(runtime.actor.getSnapshot().matches("recovery")).toBe(true),
      )
      expect(selectCurrentPlayerData(runtime.actor.getSnapshot())).toBeNull()
      expect(storage.values.get(key)).toBe("unreadable-player-save")
    } finally {
      await runtime.close()
    }
  })
})
