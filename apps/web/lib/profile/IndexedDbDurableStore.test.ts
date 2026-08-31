import { webcrypto } from "node:crypto"
import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it } from "vitest"
import SerializedPlayerDataStore from "@mapachess/profile/durable-store"
import {
  EMPTY_DURABLE_STORE_SNAPSHOT,
  type DurableStoreSnapshot,
} from "@mapachess/profile/durable-store-contract"
import { decodeMapachessPortableBackup } from "@mapachess/profile/portable-backup"
import portableActiveChickenV1 from "../../../../packages/profile/test/fixtures/portableActiveChickenV1.json"
import IndexedDbDurableStore from "./IndexedDbDurableStore.js"
import webSha256 from "./webSha256.js"

const snapshot = (
  current: string | null,
  lastKnownGood: string | null = null,
  preImportBackup: string | null = null,
): DurableStoreSnapshot =>
  Object.freeze({ current, lastKnownGood, preImportBackup })

describe("IndexedDB durable player-data storage", () => {
  it("imports the shared portable match fixture without semantic loss", async () => {
    const sha256 = (canonicalValue: string) =>
      webSha256(canonicalValue, webcrypto.subtle)
    const decoded = await decodeMapachessPortableBackup(
      JSON.stringify(portableActiveChickenV1),
      sha256,
    )
    if (!decoded.ok) throw new Error("Shared portability fixture must decode")

    const adapter = new IndexedDbDurableStore(
      new IDBFactory(),
      "mapachess-indexeddb-portable-import",
    )
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const imported = await store.replaceWithImportedData(
      await store.load(),
      decoded.backup.payload,
    )
    if (!imported.ok || imported.state.current.type !== "valid") {
      throw new Error("Web portability fixture must persist")
    }

    expect(imported.state.current.data).toEqual({
      ...decoded.backup.payload,
      revision: 0,
    })
    await adapter.close()
  })

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
