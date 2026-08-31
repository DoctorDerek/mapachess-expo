import { describe, expect, it } from "vitest"
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
  selectCurrentPlayerData,
  selectHasLastKnownGoodSave,
  selectImportIssue,
  selectImportPreview,
  selectPendingPlayerData,
  selectPersistenceFailure,
  selectUnreadablePlayerData,
} from "../src/profileMachine.js"
import {
  changeAutoHintsSetting,
  completeAutoHintsFirstRun,
} from "../src/profileMutations.js"
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

const seedCompletedProfile = async (
  store: SerializedPlayerDataStore,
  autoHintsEnabled = true,
): Promise<MapachessPlayerData> => {
  const missing = await store.load()
  const initial = createInitialMapachessPlayerData()
  const initialWrite = await store.commitCurrent(missing, initial)
  if (!initialWrite.ok) throw new Error("Initial profile seed failed")

  const completed = completeAutoHintsFirstRun(initial, autoHintsEnabled)
  const completedWrite = await store.commitCurrent(
    initialWrite.state,
    completed,
  )
  if (!completedWrite.ok) throw new Error("Completed profile seed failed")
  return completed
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
  it("persists a fresh profile before accepting the first-run choice", async () => {
    const actor = createProfileActor(createStore())
    await waitFor(actor, (snapshot) => snapshot.matches("firstRun"))

    expect(selectCurrentPlayerData(actor.getSnapshot())).toEqual(
      createInitialMapachessPlayerData(),
    )
    actor.send({
      enabled: false,
      type: "PROFILE.AUTO_HINTS_CHOICE_CONFIRMED",
    })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))

    expect(selectCurrentPlayerData(actor.getSnapshot())).toMatchObject({
      firstRun: { autoHintsChoiceCompleted: true },
      revision: 1,
      settings: { autoHintsEnabled: false },
    })
    actor.stop()
  })

  it("boots valid data directly and freezes corrupt data in recovery", async () => {
    const validStore = createStore()
    const completed = await seedCompletedProfile(validStore)
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
    const completed = await seedCompletedProfile(store, false)
    const loaded = await store.load()
    const changed = changeAutoHintsSetting(completed, true)
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
      settings: { autoHintsEnabled: false },
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
    await waitFor(actor, (snapshot) => snapshot.matches("firstRun"))
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
      settings: Object.freeze({ autoHintsEnabled: false }),
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
    const current = await seedCompletedProfile(store, true)
    const actor = createProfileActor(store)
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))

    const imported = completeAutoHintsFirstRun(
      createInitialMapachessPlayerData(),
      false,
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
      settings: { autoHintsEnabled: false },
    })
    expect(actor.getSnapshot().context.loaded?.preImportBackup).toMatchObject({
      data: current,
      type: "valid",
    })
    actor.stop()
  })

  it("rejects a malformed import without mutating current data", async () => {
    const store = createStore()
    const current = await seedCompletedProfile(store)
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
    const imported = completeAutoHintsFirstRun(
      createInitialMapachessPlayerData(),
      false,
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
      settings: { autoHintsEnabled: false },
    })
    expect(actor.getSnapshot().context.loaded?.preImportBackup).toEqual({
      type: "missing",
    })
    actor.stop()
  })
})
