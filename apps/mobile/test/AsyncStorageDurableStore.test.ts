import { describe, expect, it } from "@jest/globals"
import {
  EMPTY_DURABLE_STORE_SNAPSHOT,
  type DurableStoreSnapshot,
} from "@mapachess/profile/durable-store-contract"
import AsyncStorageDurableStore, {
  type AsyncStorageValueStore,
} from "@/lib/profile/AsyncStorageDurableStore"

class InMemoryAsyncStorage implements AsyncStorageValueStore {
  readonly values = new Map<string, string>()

  async multiGet(keys: readonly string[]) {
    return keys.map((key) => [key, this.values.get(key) ?? null] as const)
  }

  async multiRemove(keys: readonly string[]): Promise<void> {
    for (const key of keys) this.values.delete(key)
  }

  async multiSet(
    entries: readonly (readonly [string, string])[],
  ): Promise<void> {
    for (const [key, value] of entries) this.values.set(key, value)
  }
}

const snapshot = (
  current: string | null,
  lastKnownGood: string | null = null,
  preImportBackup: string | null = null,
): DurableStoreSnapshot =>
  Object.freeze({ current, lastKnownGood, preImportBackup })

describe("AsyncStorage durable player-data storage", () => {
  it("writes, removes, and verifies every namespaced slot", async () => {
    const storage = new InMemoryAsyncStorage()
    const adapter = new AsyncStorageDurableStore(storage)
    const populated = snapshot("current-1", "known-good-0", "pre-import-0")

    await expect(adapter.read()).resolves.toEqual(EMPTY_DURABLE_STORE_SNAPSHOT)
    await expect(
      adapter.compareAndSwapVerified({
        expected: EMPTY_DURABLE_STORE_SNAPSHOT,
        next: populated,
      }),
    ).resolves.toEqual({ ok: true, snapshot: populated })

    const cleared = snapshot("current-2")
    await expect(
      adapter.compareAndSwapVerified({ expected: populated, next: cleared }),
    ).resolves.toEqual({ ok: true, snapshot: cleared })
    expect([...storage.values.keys()]).toEqual([
      "@mapachess/player-data/v1/current",
    ])
  })

  it("serializes competing writes and rejects the stale expectation", async () => {
    const adapter = new AsyncStorageDurableStore(new InMemoryAsyncStorage())
    const [first, stale] = await Promise.all([
      adapter.compareAndSwapVerified({
        expected: EMPTY_DURABLE_STORE_SNAPSHOT,
        next: snapshot("first"),
      }),
      adapter.compareAndSwapVerified({
        expected: EMPTY_DURABLE_STORE_SNAPSHOT,
        next: snapshot("second"),
      }),
    ])

    expect(first).toEqual({ ok: true, snapshot: snapshot("first") })
    expect(stale).toEqual({
      actual: snapshot("first"),
      ok: false,
      type: "PROFILE.STORAGE_CONFLICT",
    })
  })

  it("reports readback verification failure without claiming atomicity", async () => {
    const storage = new InMemoryAsyncStorage()
    storage.multiSet = async () => undefined
    const adapter = new AsyncStorageDurableStore(storage)

    await expect(
      adapter.compareAndSwapVerified({
        expected: EMPTY_DURABLE_STORE_SNAPSHOT,
        next: snapshot("unwritten"),
      }),
    ).resolves.toEqual({
      actual: EMPTY_DURABLE_STORE_SNAPSHOT,
      ok: false,
      type: "PROFILE.STORAGE_VERIFICATION_FAILED",
    })
  })

  it("rejects an invalid namespace before touching storage", () => {
    expect(
      () => new AsyncStorageDurableStore(new InMemoryAsyncStorage(), " bad "),
    ).toThrow("AsyncStorage namespace must be nonempty and trimmed.")
  })
})
