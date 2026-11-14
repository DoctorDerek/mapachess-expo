import { describe, expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import SerializedPlayerDataStore from "../src/durableStore.js"
import createInitialPlayerData from "../src/playerData.js"
import {
  createMapachessPortableBackup,
  decodeMapachessPortableBackup,
} from "../src/portableBackup.js"
import profileMachine, {
  selectCurrentPlayerData,
} from "../src/profileMachine.js"
import selectProfileRecovery, {
  createRecoveryCommands,
  selectExportablePlayerData,
} from "../src/profileRecovery.js"
import { InMemoryDurableStoreAdapter, sha256 } from "./profileTestSupport.js"

const rawBackup = () =>
  createMapachessPortableBackup({
    applicationVersion: "recovery-test",
    gddRevision: "test",
    playerData: { ...createInitialPlayerData(), totalXp: 8 },
    sha256,
  })
const fileActions = () => ({
  exportData: vi.fn(),
  exportUnreadable: vi.fn(),
  importData: vi.fn(),
})

describe("shared profile recovery decisions and durable commands", () => {
  it("cancels verification and preview without changing corrupt bytes, then accepts an explicitly confirmed replacement once", async ({
    onTestFinished,
  }) => {
    const raw = "unreadable original"
    const adapter = new InMemoryDurableStoreAdapter({
      current: raw,
      lastKnownGood: null,
      preImportBackup: null,
    })
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const gate = Promise.withResolvers<void>()
    const actor = createActor(profileMachine, {
      input: {
        store,
        decodePortableBackup: async (raw) => {
          await gate.promise
          return decodeMapachessPortableBackup(raw, sha256)
        },
      },
    }).start()
    onTestFinished(() => {
      gate.resolve()
      actor.stop()
    })
    const files = fileActions()
    const commands = createRecoveryCommands(actor, files)
    await waitFor(actor, (s) => s.matches("recovery"))
    expect(selectProfileRecovery(actor.getSnapshot())).toEqual({
      kind: "recovery",
      hasLastKnownGood: false,
      importIssue: null,
    })
    expect(selectExportablePlayerData(actor.getSnapshot())).toBeNull()
    const backup = await rawBackup()
    commands.readBackup(backup)
    expect(selectProfileRecovery(actor.getSnapshot())).toEqual({
      kind: "import-decoding",
    })
    commands.cancelImport()
    gate.resolve()
    await waitFor(actor, (s) => s.matches("recovery"))
    expect(adapter.snapshot.current).toBe(raw)
    commands.readBackup(backup)
    await waitFor(actor, (s) => s.matches("importPreview"))
    expect(selectProfileRecovery(actor.getSnapshot())).toMatchObject({
      kind: "import-preview",
      backup: { applicationVersion: "recovery-test", payload: { totalXp: 8 } },
    })
    commands.cancelImport()
    expect(adapter.snapshot.current).toBe(raw)
    commands.readBackup(backup)
    await waitFor(actor, (s) => s.matches("importPreview"))
    const writes = vi.spyOn(adapter, "compareAndSwapVerified")
    commands.confirmImport()
    commands.confirmImport()
    await waitFor(actor, (s) => s.matches("ready"))
    expect(selectCurrentPlayerData(actor.getSnapshot())?.totalXp).toBe(8)
    expect(writes).toHaveBeenCalledTimes(1)
    expect(selectProfileRecovery(actor.getSnapshot())).toEqual({ kind: "none" })
  })

  it("exposes a failed first-save candidate, keeps it through retry, and accepts it only after verification", async ({
    onTestFinished,
  }) => {
    const adapter = new InMemoryDurableStoreAdapter()
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const persist = adapter.compareAndSwapVerified.bind(adapter)
    const write = vi
      .spyOn(adapter, "compareAndSwapVerified")
      .mockRejectedValueOnce(new Error("First write unavailable"))
    const actor = createActor(profileMachine, {
      input: {
        store,
        decodePortableBackup: (raw) =>
          decodeMapachessPortableBackup(raw, sha256),
      },
    }).start()
    onTestFinished(() => {
      actor.stop()
    })
    const files = fileActions()
    const commands = createRecoveryCommands(actor, files)
    await waitFor(actor, (s) => s.matches("persistenceFailure"))
    expect(selectCurrentPlayerData(actor.getSnapshot())).toBeNull()
    const pending = selectExportablePlayerData(actor.getSnapshot())
    expect(pending).not.toBeNull()
    expect(selectProfileRecovery(actor.getSnapshot())).toMatchObject({
      kind: "persistence-failure",
      retrying: false,
      canExportData: true,
      canExportUnreadable: false,
    })
    commands.exportData()
    expect(files.exportData).toHaveBeenCalledTimes(1)
    const gate = Promise.withResolvers<void>()
    write.mockImplementationOnce(async (next) => {
      await gate.promise
      return persist(next)
    })
    onTestFinished(() => gate.resolve())
    commands.retrySave()
    expect(selectProfileRecovery(actor.getSnapshot())).toMatchObject({
      kind: "persistence-failure",
      retrying: true,
      canExportData: true,
    })
    expect(selectExportablePlayerData(actor.getSnapshot())).toEqual(pending)
    gate.resolve()
    await waitFor(actor, (s) => s.matches("ready"))
    expect(selectCurrentPlayerData(actor.getSnapshot())).toEqual(pending)
    expect(selectProfileRecovery(actor.getSnapshot())).toEqual({ kind: "none" })
  })

  it("retries loading, rejects invalid imports, and restores the actual last known-good save without a new workflow", async ({
    onTestFinished,
  }) => {
    const adapter = new InMemoryDurableStoreAdapter()
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const before = await store.load()
    const seeded = await store.commitCurrent(before, createInitialPlayerData())
    if (!seeded.ok) throw new Error("Could not seed recovery fixture")
    adapter.snapshot = {
      ...adapter.snapshot,
      lastKnownGood: adapter.snapshot.current,
      current: "bad",
    }
    vi.spyOn(adapter, "read").mockRejectedValueOnce(
      new Error("Private read failure"),
    )
    const actor = createActor(profileMachine, {
      input: {
        store,
        decodePortableBackup: (raw) =>
          decodeMapachessPortableBackup(raw, sha256),
      },
    }).start()
    onTestFinished(() => {
      actor.stop()
    })
    const files = fileActions()
    const commands = createRecoveryCommands(actor, files)
    await waitFor(actor, (s) => s.matches("loadFailure"))
    expect(selectProfileRecovery(actor.getSnapshot())).toEqual({
      kind: "load-failure",
    })
    commands.retryLoad()
    await waitFor(actor, (s) => s.matches("recovery"))
    commands.readBackup("not a backup")
    await waitFor(
      actor,
      (s) => s.matches("recovery") && s.context.importIssue !== null,
    )
    expect(selectProfileRecovery(actor.getSnapshot())).toMatchObject({
      kind: "recovery",
      hasLastKnownGood: true,
      importIssue: { type: "PROFILE.BACKUP_INVALID" },
    })
    commands.exportUnreadable()
    commands.importData?.()
    expect(files.exportUnreadable).toHaveBeenCalledTimes(1)
    expect(files.importData).toHaveBeenCalledTimes(1)
    commands.restoreLastKnownGood()
    await waitFor(actor, (s) => s.matches("ready"))
    expect(selectCurrentPlayerData(actor.getSnapshot())?.totalXp).toBe(0)
  })

  it("retains the accepted profile while a valid-profile import is inspected, and resets only by explicit command", async ({
    onTestFinished,
  }) => {
    const adapter = new InMemoryDurableStoreAdapter()
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const gate = Promise.withResolvers<void>()
    const actor = createActor(profileMachine, {
      input: {
        store,
        decodePortableBackup: async (raw) => {
          await gate.promise
          return decodeMapachessPortableBackup(raw, sha256)
        },
      },
    }).start()
    onTestFinished(() => {
      gate.resolve()
      actor.stop()
    })
    const commands = createRecoveryCommands(actor, fileActions())
    await waitFor(actor, (s) => s.matches("ready"))
    const before = selectCurrentPlayerData(actor.getSnapshot())
    commands.readBackup(await rawBackup())
    expect(selectProfileRecovery(actor.getSnapshot())).toEqual({ kind: "none" })
    expect(selectExportablePlayerData(actor.getSnapshot())).toEqual(before)
    commands.cancelImport()
    gate.resolve()
    adapter.snapshot = { ...adapter.snapshot, current: "corrupt" }
    commands.retryLoad()
    expect(selectCurrentPlayerData(actor.getSnapshot())).toEqual(before)
    actor.stop()
    const recovery = createActor(profileMachine, {
      input: {
        store,
        decodePortableBackup: (raw) =>
          decodeMapachessPortableBackup(raw, sha256),
      },
    }).start()
    onTestFinished(() => {
      recovery.stop()
    })
    await waitFor(recovery, (s) => s.matches("recovery"))
    createRecoveryCommands(recovery, fileActions()).reset()
    await waitFor(recovery, (s) => s.matches("ready"))
    expect(selectCurrentPlayerData(recovery.getSnapshot())?.totalXp).toBe(0)
  })
})
