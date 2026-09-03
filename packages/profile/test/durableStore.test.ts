import { describe, expect, it } from "vitest"
import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import SerializedPlayerDataStore, {
  EMPTY_DURABLE_STORE_SNAPSHOT,
  type LoadedDurablePlayerData,
} from "../src/durableStore.js"
import createInitialMapachessPlayerData, {
  type MapachessPlayerData,
} from "../src/playerData.js"
import { createLastKnownGoodRecoveryData } from "../src/profileMutations.js"
import { InMemoryDurableStoreAdapter, sha256 } from "./profileTestSupport.js"

const revisePlayerData = (
  data: MapachessPlayerData,
  autoHintMode: AutoHintMode,
): MapachessPlayerData =>
  Object.freeze({
    ...data,
    revision: data.revision + 1,
    settings: Object.freeze({ autoHintMode }),
  })

const requireCurrentData = (
  state: LoadedDurablePlayerData,
): MapachessPlayerData => {
  if (state.current.type !== "valid") {
    throw new Error("Test state requires valid current player data")
  }
  return state.current.data
}

describe("serialized durable player-data writes", () => {
  it("commits the initial profile and retains the previous valid revision", async () => {
    const adapter = new InMemoryDurableStoreAdapter()
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const missing = await store.load()
    const initial = createInitialMapachessPlayerData()
    const firstWrite = await store.commitCurrent(missing, initial)
    if (!firstWrite.ok) throw new Error("Initial write must succeed")

    const revised = revisePlayerData(initial, "no-auto-hints")
    const secondWrite = await store.commitCurrent(firstWrite.state, revised)

    expect(secondWrite).toMatchObject({
      ok: true,
      state: {
        current: { data: revised, type: "valid" },
        lastKnownGood: { data: initial, type: "valid" },
        preImportBackup: { type: "missing" },
      },
    })
  })

  it("serializes concurrent calls and rejects a stale expected snapshot", async () => {
    const adapter = new InMemoryDurableStoreAdapter()
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const missing = await store.load()
    const initialWrite = await store.commitCurrent(
      missing,
      createInitialMapachessPlayerData(),
    )
    if (!initialWrite.ok) throw new Error("Initial write must succeed")

    const [first, stale] = await Promise.all([
      store.commitCurrent(
        initialWrite.state,
        revisePlayerData(
          requireCurrentData(initialWrite.state),
          "no-auto-hints",
        ),
      ),
      store.commitCurrent(
        initialWrite.state,
        revisePlayerData(
          requireCurrentData(initialWrite.state),
          "auto-move-hints",
        ),
      ),
    ])

    expect(first.ok).toBe(true)
    expect(stale).toEqual({
      failure: { type: "PROFILE.STORAGE_CONFLICT" },
      ok: false,
    })
  })

  it("preserves malformed current bytes and refuses implicit replacement", async () => {
    const adapter = new InMemoryDurableStoreAdapter({
      ...EMPTY_DURABLE_STORE_SNAPSHOT,
      current: "{truncated",
    })
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const loaded = await store.load()

    const result = await store.commitCurrent(
      loaded,
      createInitialMapachessPlayerData(),
    )

    expect(loaded.current).toEqual({
      issue: { type: "PROFILE.STORED_DATA_INVALID" },
      raw: "{truncated",
      type: "invalid",
    })
    expect(result).toEqual({
      failure: { type: "PROFILE.CURRENT_DATA_INVALID" },
      ok: false,
    })
    expect(adapter.snapshot.current).toBe("{truncated")
  })

  it("verifies and retains a pre-import backup before replacement", async () => {
    const adapter = new InMemoryDurableStoreAdapter()
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const missing = await store.load()
    const initialWrite = await store.commitCurrent(
      missing,
      createInitialMapachessPlayerData(),
    )
    if (!initialWrite.ok) throw new Error("Initial write must succeed")

    const imported = revisePlayerData(
      revisePlayerData(createInitialMapachessPlayerData(), "no-auto-hints"),
      "auto-move-hints",
    )
    const result = await store.replaceWithImportedData(
      initialWrite.state,
      imported,
    )

    expect(result).toMatchObject({
      ok: true,
      state: {
        current: { data: { revision: 1 }, type: "valid" },
        preImportBackup: {
          data: createInitialMapachessPlayerData(),
          type: "valid",
        },
      },
    })
  })

  it("rejects skipped revisions before touching storage", async () => {
    const adapter = new InMemoryDurableStoreAdapter()
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const missing = await store.load()
    const skipped = Object.freeze({
      ...createInitialMapachessPlayerData(),
      revision: 2,
    })

    await expect(store.commitCurrent(missing, skipped)).resolves.toEqual({
      failure: { type: "PROFILE.REVISION_INVALID" },
      ok: false,
    })
    expect(adapter.snapshot).toBe(EMPTY_DURABLE_STORE_SNAPSHOT)
  })

  it("replaces corrupt current bytes only through explicit recovery", async () => {
    const adapter = new InMemoryDurableStoreAdapter()
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const missing = await store.load()
    const initial = createInitialMapachessPlayerData()
    const firstWrite = await store.commitCurrent(missing, initial)
    if (!firstWrite.ok) throw new Error("Initial write must succeed")
    const secondWrite = await store.commitCurrent(
      firstWrite.state,
      revisePlayerData(initial, "no-auto-hints"),
    )
    if (!secondWrite.ok) throw new Error("Second write must succeed")

    adapter.snapshot = Object.freeze({
      ...adapter.snapshot,
      current: "{corrupt-current",
    })
    const corrupt = await store.load()
    if (corrupt.lastKnownGood.type !== "valid") {
      throw new Error("Recovery test requires a last-known-good save")
    }
    const recovered = await store.recoverInvalidCurrent(
      corrupt,
      createLastKnownGoodRecoveryData(corrupt.lastKnownGood),
    )

    expect(recovered).toMatchObject({
      ok: true,
      state: {
        current: {
          data: {
            revision: 1,
            settings: { autoHintMode: "auto-move-hints" },
          },
          type: "valid",
        },
        lastKnownGood: { data: initial, type: "valid" },
      },
    })
  })

  it("refuses recovery when current data is not corrupt", async () => {
    const adapter = new InMemoryDurableStoreAdapter()
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const missing = await store.load()

    await expect(
      store.recoverInvalidCurrent(missing, createInitialMapachessPlayerData()),
    ).resolves.toEqual({
      failure: { type: "PROFILE.CURRENT_DATA_NOT_INVALID" },
      ok: false,
    })
    expect(adapter.snapshot).toBe(EMPTY_DURABLE_STORE_SNAPSHOT)
  })
})
