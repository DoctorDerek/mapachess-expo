import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it } from "vitest"
import {
  EMPTY_DURABLE_STORE_SNAPSHOT,
  type DurableStoreSnapshot,
} from "@mapachess/profile/durable-store"
import IndexedDbDurableStore from "./IndexedDbDurableStore.js"

const snapshot = (
  current: string | null,
  lastKnownGood: string | null = null,
  preImportBackup: string | null = null,
): DurableStoreSnapshot =>
  Object.freeze({ current, lastKnownGood, preImportBackup })

describe("IndexedDB durable player-data storage", () => {
  it("compares, writes, and verifies all durable slots atomically", async () => {
    const adapter = new IndexedDbDurableStore(
      new IDBFactory(),
      "mapachess-indexeddb-happy-path",
    )
    const next = snapshot("current-1", "known-good-0", "pre-import-0")

    await expect(adapter.read()).resolves.toEqual(EMPTY_DURABLE_STORE_SNAPSHOT)
    await expect(
      adapter.compareAndSwapVerified({
        expected: EMPTY_DURABLE_STORE_SNAPSHOT,
        next,
      }),
    ).resolves.toEqual({ ok: true, snapshot: next })
    await expect(adapter.read()).resolves.toEqual(next)

    const cleared = snapshot("current-2")
    await expect(
      adapter.compareAndSwapVerified({ expected: next, next: cleared }),
    ).resolves.toEqual({ ok: true, snapshot: cleared })
    await expect(adapter.read()).resolves.toEqual(cleared)
    await adapter.close()
  })

  it("returns the actual snapshot when the expectation is stale", async () => {
    const adapter = new IndexedDbDurableStore(
      new IDBFactory(),
      "mapachess-indexeddb-conflict",
    )
    const current = snapshot("current")
    await adapter.compareAndSwapVerified({
      expected: EMPTY_DURABLE_STORE_SNAPSHOT,
      next: current,
    })

    await expect(
      adapter.compareAndSwapVerified({
        expected: EMPTY_DURABLE_STORE_SNAPSHOT,
        next: snapshot("stale-overwrite"),
      }),
    ).resolves.toEqual({
      actual: current,
      ok: false,
      type: "PROFILE.STORAGE_CONFLICT",
    })
    await expect(adapter.read()).resolves.toEqual(current)
    await adapter.close()
  })

  it("serializes competing readwrite transactions across connections", async () => {
    const indexedDb = new IDBFactory()
    const first = new IndexedDbDurableStore(
      indexedDb,
      "mapachess-indexeddb-competing-connections",
    )
    const second = new IndexedDbDurableStore(
      indexedDb,
      "mapachess-indexeddb-competing-connections",
    )
    const [firstResult, secondResult] = await Promise.all([
      first.compareAndSwapVerified({
        expected: EMPTY_DURABLE_STORE_SNAPSHOT,
        next: snapshot("first"),
      }),
      second.compareAndSwapVerified({
        expected: EMPTY_DURABLE_STORE_SNAPSHOT,
        next: snapshot("second"),
      }),
    ])

    expect([firstResult.ok, secondResult.ok].sort()).toEqual([false, true])
    expect(await first.read()).toEqual(await second.read())
    await Promise.all([first.close(), second.close()])
  })
})
