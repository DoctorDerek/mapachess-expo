import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import SerializedPlayerDataStore, {
  durableStoreSnapshotsEqual,
  EMPTY_DURABLE_STORE_SNAPSHOT,
  type DurableStoreAdapter,
  type DurableStoreSnapshot,
  type LoadedDurablePlayerData,
} from "../src/durableStore.js"
import createInitialMapachessPlayerData, {
  type MapachessPlayerData,
} from "../src/playerData.js"

const sha256 = async (canonicalValue: string): Promise<string> =>
  createHash("sha256").update(canonicalValue).digest("hex")

class InMemoryDurableStoreAdapter implements DurableStoreAdapter {
  snapshot: DurableStoreSnapshot

  constructor(snapshot = EMPTY_DURABLE_STORE_SNAPSHOT) {
    this.snapshot = snapshot
  }

  async read(): Promise<DurableStoreSnapshot> {
    return this.snapshot
  }

  async compareAndSwapVerified({
    expected,
    next,
  }: Parameters<DurableStoreAdapter["compareAndSwapVerified"]>[0]) {
    if (!durableStoreSnapshotsEqual(this.snapshot, expected)) {
      return {
        actual: this.snapshot,
        ok: false as const,
        type: "PROFILE.STORAGE_CONFLICT" as const,
      }
    }

    this.snapshot = next
    return { ok: true as const, snapshot: this.snapshot }
  }
}

const revisePlayerData = (
  data: MapachessPlayerData,
  autoHintsEnabled: boolean,
): MapachessPlayerData =>
  Object.freeze({
    ...data,
    firstRun: Object.freeze({ autoHintsChoiceCompleted: true }),
    revision: data.revision + 1,
    settings: Object.freeze({ autoHintsEnabled }),
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

    const revised = revisePlayerData(initial, false)
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
        revisePlayerData(requireCurrentData(initialWrite.state), false),
      ),
      store.commitCurrent(
        initialWrite.state,
        revisePlayerData(requireCurrentData(initialWrite.state), true),
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
      revisePlayerData(createInitialMapachessPlayerData(), false),
      true,
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
})
