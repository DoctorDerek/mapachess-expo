import { describe, expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import SerializedPlayerDataStore, {
  EMPTY_DURABLE_STORE_SNAPSHOT,
  type DurableStoreAdapter,
  type DurableStoreWrite,
  type DurableStoreWriteResult,
} from "../src/durableStore.js"
import createInitialMapachessPlayerData, {
  type MapachessPlayerData,
} from "../src/playerData.js"
import {
  createMapachessPortableBackup,
  decodeMapachessPortableBackup,
} from "../src/portableBackup.js"
import profileMachine, {
  selectCanChangeAutoHintMode,
  selectCurrentPlayerData,
  selectHasLastKnownGoodSave,
  selectImportIssue,
  selectImportPreview,
  selectPendingPlayerData,
  selectPersistenceFailure,
  selectUnreadablePlayerData,
} from "../src/profileMachine.js"
import { changeAutoHintMode } from "../src/profileMutations.js"
import { InMemoryDurableStoreAdapter, sha256 } from "./profileTestSupport.js"

const createStore = (
  adapter: DurableStoreAdapter = new InMemoryDurableStoreAdapter(),
) => new SerializedPlayerDataStore(adapter, sha256)

const createProfileActor = (store: SerializedPlayerDataStore) =>
  createActor(profileMachine, {
    input: {
      decodePortableBackup: (rawBackup) =>
        decodeMapachessPortableBackup(rawBackup, sha256),
      store,
    },
  }).start()

const seedProfile = async (
  store: SerializedPlayerDataStore,
  autoHintMode: MapachessPlayerData["settings"]["autoHintMode"] = "auto-move-hints",
): Promise<MapachessPlayerData> => {
  const missing = await store.load()
  const initial = createInitialMapachessPlayerData()
  const initialWrite = await store.commitCurrent(missing, initial)
  if (!initialWrite.ok) throw new Error("Initial profile seed failed")

  if (autoHintMode === initial.settings.autoHintMode) return initial

  const changed = changeAutoHintMode(initial, autoHintMode)
  const changedWrite = await store.commitCurrent(initialWrite.state, changed)
  if (!changedWrite.ok) throw new Error("Changed profile seed failed")
  return changed
}

class FailFirstWriteAdapter implements DurableStoreAdapter {
  readonly delegate = new InMemoryDurableStoreAdapter()
  #shouldFail = true

  read() {
    return this.delegate.read()
  }

  async compareAndSwapVerified(
    write: DurableStoreWrite,
  ): Promise<DurableStoreWriteResult> {
    if (this.#shouldFail) {
      this.#shouldFail = false
      return {
        actual: EMPTY_DURABLE_STORE_SNAPSHOT,
        ok: false,
        type: "PROFILE.STORAGE_VERIFICATION_FAILED",
      }
    }
    return this.delegate.compareAndSwapVerified(write)
  }
}

describe("XState durable profile orchestration", () => {
  it("accepts the latest preference while an earlier write is still pending", async () => {
    const store = createStore()
    await seedProfile(store)
    const actor = createProfileActor(store)
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    const gate = Promise.withResolvers<void>()
    const commitCurrent = store.commitCurrent.bind(store)
    const writes = vi
      .spyOn(store, "commitCurrent")
      .mockImplementationOnce(async (...args) => {
        await gate.promise
        return commitCurrent(...args)
      })

    actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "auto-piece-hints",
    })
    expect(selectCanChangeAutoHintMode(actor.getSnapshot())).toBe(true)
    actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "auto-move-hints",
    })
    actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "no-auto-hints",
    })
    expect(
      selectPendingPlayerData(actor.getSnapshot())?.settings.autoHintMode,
    ).toBe("no-auto-hints")
    expect(
      selectCurrentPlayerData(actor.getSnapshot())?.settings.autoHintMode,
    ).toBe("auto-move-hints")
    expect(writes).toHaveBeenCalledTimes(1)

    gate.resolve()
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(selectCurrentPlayerData(actor.getSnapshot())).toMatchObject({
      revision: 2,
      settings: { autoHintMode: "no-auto-hints" },
    })
    expect(writes).toHaveBeenCalledTimes(2)
    expect(actor.getSnapshot().context.requestedAutoHintMode).toBeNull()
    actor.stop()
  })

  it("preserves the latest preference through failure and explicit retry", async () => {
    const store = createStore()
    await seedProfile(store)
    const actor = createProfileActor(store)
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    const gate = Promise.withResolvers<void>()
    vi.spyOn(store, "commitCurrent").mockImplementationOnce(async () => {
      await gate.promise
      throw new Error("Controlled write failure")
    })
    actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "auto-piece-hints",
    })
    actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "no-auto-hints",
    })
    gate.resolve()
    await waitFor(actor, (snapshot) => snapshot.matches("persistenceFailure"))
    expect(selectCanChangeAutoHintMode(actor.getSnapshot())).toBe(false)
    expect(
      selectPendingPlayerData(actor.getSnapshot())?.settings.autoHintMode,
    ).toBe("no-auto-hints")
    actor.send({ type: "PROFILE.PERSISTENCE_RETRY_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(
      selectCurrentPlayerData(actor.getSnapshot())?.settings.autoHintMode,
    ).toBe("no-auto-hints")
    actor.stop()
  })

  it("persists a fresh profile with automatic move hints by default", async () => {
    const actor = createProfileActor(createStore())
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))

    expect(selectCurrentPlayerData(actor.getSnapshot())).toEqual(
      createInitialMapachessPlayerData(),
    )
    expect(selectCurrentPlayerData(actor.getSnapshot())).toMatchObject({
      revision: 0,
      settings: { autoHintMode: "auto-move-hints" },
    })
    actor.stop()
  })

  it("boots valid data directly and freezes corrupt data in recovery", async () => {
    const validStore = createStore()
    const completed = await seedProfile(validStore)
    const validActor = createProfileActor(validStore)
    await waitFor(validActor, (snapshot) => snapshot.matches("ready"))
    expect(selectCurrentPlayerData(validActor.getSnapshot())).toEqual(completed)
    validActor.stop()

    const corruptAdapter = new InMemoryDurableStoreAdapter({
      ...EMPTY_DURABLE_STORE_SNAPSHOT,
      current: "{truncated-player-data",
    })
    const corruptActor = createProfileActor(createStore(corruptAdapter))
    await waitFor(corruptActor, (snapshot) => snapshot.matches("recovery"))

    expect(selectUnreadablePlayerData(corruptActor.getSnapshot())).toBe(
      "{truncated-player-data",
    )
    expect(selectHasLastKnownGoodSave(corruptActor.getSnapshot())).toBe(false)
    expect(corruptAdapter.snapshot.current).toBe("{truncated-player-data")
    corruptActor.stop()
  })

  it("restores a last-known-good profile only after an explicit event", async () => {
    const adapter = new InMemoryDurableStoreAdapter()
    const store = createStore(adapter)
    const completed = await seedProfile(store, "no-auto-hints")
    const loaded = await store.load()
    const changed = changeAutoHintMode(completed, "auto-move-hints")
    const changedWrite = await store.commitCurrent(loaded, changed)
    if (!changedWrite.ok) throw new Error("Changed profile seed failed")
    adapter.snapshot = Object.freeze({
      ...adapter.snapshot,
      current: "{corrupt-newest-revision",
    })

    const actor = createProfileActor(store)
    await waitFor(actor, (snapshot) => snapshot.matches("recovery"))
    expect(selectHasLastKnownGoodSave(actor.getSnapshot())).toBe(true)
    expect(adapter.snapshot.current).toBe("{corrupt-newest-revision")

    actor.send({ type: "PROFILE.RECOVERY_LAST_KNOWN_GOOD_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(selectCurrentPlayerData(actor.getSnapshot())).toMatchObject({
      revision: completed.revision + 1,
      settings: { autoHintMode: "no-auto-hints" },
    })
    actor.stop()
  })

  it("retains a failed in-memory candidate and retries deterministically", async () => {
    const actor = createProfileActor(createStore(new FailFirstWriteAdapter()))
    await waitFor(actor, (snapshot) => snapshot.matches("persistenceFailure"))

    expect(selectPersistenceFailure(actor.getSnapshot())).toEqual({
      type: "PROFILE.STORAGE_VERIFICATION_FAILED",
    })
    expect(selectPendingPlayerData(actor.getSnapshot())).toEqual(
      createInitialMapachessPlayerData(),
    )

    actor.send({ type: "PROFILE.PERSISTENCE_RETRY_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(selectPendingPlayerData(actor.getSnapshot())).toBeNull()
    expect(selectCurrentPlayerData(actor.getSnapshot())).toEqual(
      createInitialMapachessPlayerData(),
    )
    actor.stop()
  })

  it("keeps a pending candidate frozen when retry discovers newer data", async () => {
    const adapter = new FailFirstWriteAdapter()
    const actor = createProfileActor(createStore(adapter))
    await waitFor(actor, (snapshot) => snapshot.matches("persistenceFailure"))

    const externalStore = createStore(adapter)
    const missing = await externalStore.load()
    const externalCandidate = Object.freeze({
      ...createInitialMapachessPlayerData(),
      settings: Object.freeze({
        ...createInitialMapachessPlayerData().settings,
        autoHintMode: "no-auto-hints",
      }),
    })
    const externalWrite = await externalStore.commitCurrent(
      missing,
      externalCandidate,
    )
    if (!externalWrite.ok) throw new Error("External write must succeed")

    actor.send({ type: "PROFILE.PERSISTENCE_RETRY_REQUESTED" })
    await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches("persistenceFailure") &&
        selectPersistenceFailure(snapshot)?.type === "PROFILE.STORAGE_CONFLICT",
    )

    expect(selectPendingPlayerData(actor.getSnapshot())).toEqual(
      createInitialMapachessPlayerData(),
    )
    expect(adapter.delegate.snapshot.current).not.toBeNull()
    actor.stop()
  })

  it("previews, cancels, and confirms a verified portable replacement", async () => {
    const store = createStore()
    const current = await seedProfile(store)
    const actor = createProfileActor(store)
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))

    const imported = changeAutoHintMode(
      createInitialMapachessPlayerData(),
      "no-auto-hints",
    )
    const rawBackup = await createMapachessPortableBackup({
      applicationVersion: "0.0.0-test",
      gddRevision: "test-gdd",
      playerData: imported,
      sha256,
    })
    actor.send({ rawBackup, type: "PROFILE.IMPORT_PREVIEW_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("importPreview"))
    expect(selectImportPreview(actor.getSnapshot())?.payload).toEqual(imported)

    actor.send({ type: "PROFILE.IMPORT_CANCELLED" })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(selectCurrentPlayerData(actor.getSnapshot())).toEqual(current)

    actor.send({ rawBackup, type: "PROFILE.IMPORT_PREVIEW_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("importPreview"))
    actor.send({ type: "PROFILE.IMPORT_CONFIRMED" })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))

    expect(selectCurrentPlayerData(actor.getSnapshot())).toMatchObject({
      revision: current.revision + 1,
      settings: { autoHintMode: "no-auto-hints" },
    })
    expect(actor.getSnapshot().context.loaded?.preImportBackup).toMatchObject({
      data: current,
      type: "valid",
    })
    actor.stop()
  })

  it("rejects a malformed import without mutating current data", async () => {
    const store = createStore()
    const current = await seedProfile(store)
    const actor = createProfileActor(store)
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))

    actor.send({ rawBackup: "{", type: "PROFILE.IMPORT_PREVIEW_REQUESTED" })
    await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches("ready") && selectImportIssue(snapshot) !== null,
    )

    expect(selectImportIssue(actor.getSnapshot())).toEqual({
      path: "$",
      type: "PROFILE.BACKUP_INVALID",
    })
    expect(selectCurrentPlayerData(actor.getSnapshot())).toEqual(current)
    actor.stop()
  })

  it("recovers corrupt current data through a verified backup import", async () => {
    const adapter = new InMemoryDurableStoreAdapter({
      ...EMPTY_DURABLE_STORE_SNAPSHOT,
      current: "{corrupt-current",
    })
    const actor = createProfileActor(createStore(adapter))
    await waitFor(actor, (snapshot) => snapshot.matches("recovery"))
    const imported = changeAutoHintMode(
      createInitialMapachessPlayerData(),
      "no-auto-hints",
    )
    const rawBackup = await createMapachessPortableBackup({
      applicationVersion: "0.0.0-test",
      gddRevision: "test-gdd",
      playerData: imported,
      sha256,
    })

    actor.send({ rawBackup, type: "PROFILE.IMPORT_PREVIEW_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("importPreview"))
    actor.send({ type: "PROFILE.IMPORT_CONFIRMED" })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))

    expect(selectCurrentPlayerData(actor.getSnapshot())).toMatchObject({
      revision: 0,
      settings: { autoHintMode: "no-auto-hints" },
    })
    expect(actor.getSnapshot().context.loaded?.preImportBackup).toEqual({
      type: "missing",
    })
    actor.stop()
  })
})
