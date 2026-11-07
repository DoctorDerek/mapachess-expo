// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { IDBFactory, IDBObjectStore } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import SerializedPlayerDataStore from "@mapachess/profile/durable-store"
import createInitialPlayerData from "@mapachess/profile/player-data"
import { decodeMapachessPortableBackup } from "@mapachess/profile/portable-backup"
import IndexedDbDurableStore from "../../lib/profile/IndexedDbDurableStore"
import * as files from "../../lib/profile/webPlayerDataFiles"
import webSha256 from "../../lib/profile/webSha256"
import {
  bootApplication,
  openSettings,
  savedProfile,
} from "../../test/applicationHarness"
import { installDomHarness } from "../../test/domHarness"
import WebMapachessApplication from "./WebMapachessApplication"

installDomHarness()
const copy = loadCatalog("en")

describe("visible application recovery with real durable storage", () => {
  it("exports the pending preference after a failed save, then retries without replacing accepted progress", async () => {
    const { indexedDb } = await bootApplication()
    const before = await savedProfile(indexedDb)
    const settings = await openSettings()
    const failed = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementationOnce(() => {
        throw new DOMException("Storage full", "QuotaExceededError")
      })
    fireEvent.click(
      settings.getByRole("radio", {
        name: copy.setup.autoHints["no-auto-hints"].label,
      }),
    )
    const exportPending = await screen.findByRole("button", {
      name: copy.interface.profilePersistenceFailurePanel
        .exportPendingPlayerData,
    })
    expect(await savedProfile(indexedDb)).toEqual(before)
    const download = vi
      .spyOn(files, "downloadTextFile")
      .mockImplementation(() => undefined)
    fireEvent.click(exportPending)
    await waitFor(() => expect(download).toHaveBeenCalledOnce())
    const raw = download.mock.calls[0]?.[0]
    if (raw === undefined)
      throw new Error("Pending-data export must contain backup bytes.")
    expect(
      await decodeMapachessPortableBackup(raw, (value) =>
        webSha256(value, crypto.subtle),
      ),
    ).toMatchObject({
      ok: true,
      backup: {
        payload: {
          totalXp: before.totalXp,
          ratings: before.ratings,
          settings: { autoHintMode: "no-auto-hints" },
        },
      },
    })
    failed.mockRestore()
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profilePersistenceFailurePanel.retrySave,
      }),
    )
    await waitFor(async () =>
      expect((await savedProfile(indexedDb)).settings.autoHintMode).toBe(
        "no-auto-hints",
      ),
    )
    expect(
      screen.queryByRole("button", {
        name: copy.interface.profilePersistenceFailurePanel
          .exportPendingPlayerData,
      }),
    ).toBeNull()
    expect((await savedProfile(indexedDb)).ratings).toEqual(before.ratings)
  })

  it("recovers the first save failure before first arrival rather than enabling an unsaved game", async () => {
    const indexedDb = new IDBFactory()
    vi.stubGlobal("indexedDB", indexedDb)
    const failed = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementationOnce(() => {
        throw new Error("Initial save unavailable")
      })
    render(<WebMapachessApplication />)
    await screen.findByRole("button", {
      name: copy.interface.profilePersistenceFailurePanel
        .exportPendingPlayerData,
    })
    expect(
      screen.queryByRole("button", { name: copy.introduction.start }),
    ).toBeNull()
    failed.mockRestore()
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profilePersistenceFailurePanel.retrySave,
      }),
    )
    expect(
      await screen.findByRole("button", { name: copy.introduction.start }),
    ).toBeTruthy()
    expect(await savedProfile(indexedDb)).toEqual(createInitialPlayerData())
  })

  it("retries an IndexedDB open failure without discarding the database", async () => {
    const indexedDb = new IDBFactory()
    vi.stubGlobal("indexedDB", indexedDb)
    const failed = vi.spyOn(indexedDb, "open").mockImplementationOnce(() => {
      throw new Error("Database temporarily unavailable")
    })
    render(<WebMapachessApplication />)
    await screen.findByRole("heading", {
      name: copy.interface.webMapachessApplication
        .mapachessCouldNotReadLocalData,
    })
    failed.mockRestore()
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.webMapachessApplication.tryAgain,
      }),
    )
    expect(
      await screen.findByRole("button", { name: copy.introduction.start }),
    ).toBeTruthy()
  })

  it("restores the known-good save only when requested, preserving unreadable bytes for an export even if download fails", async () => {
    const indexedDb = new IDBFactory()
    const adapter = new IndexedDbDurableStore(indexedDb)
    const store = new SerializedPlayerDataStore(adapter, (value) =>
      webSha256(value, crypto.subtle),
    )
    const before = { ...createInitialPlayerData(), introductionCompleted: true }
    const first = await store.commitCurrent(await store.load(), before)
    if (!first.ok) throw new Error("The known-good fixture must persist.")
    const second = await store.commitCurrent(first.state, {
      ...before,
      revision: 1,
      settings: { ...before.settings, autoHintMode: "no-auto-hints" },
    })
    if (!second.ok) throw new Error("The second fixture save must persist.")
    const snapshot = await adapter.read()
    await adapter.compareAndSwapVerified({
      expected: snapshot,
      next: { ...snapshot, current: "preserved unreadable bytes" },
    })
    await adapter.close()
    vi.stubGlobal("indexedDB", indexedDb)
    const download = vi
      .spyOn(files, "downloadTextFile")
      .mockImplementationOnce(() => {
        throw new Error("Browser download unavailable")
      })
      .mockImplementation(() => undefined)
    render(<WebMapachessApplication />)
    fireEvent.click(
      await screen.findByRole("button", {
        name: copy.interface.profileRecoveryPanel.exportUnreadableData,
      }),
    )
    expect(
      await screen.findByText(
        copy.interface.profileRecoveryPanel.theDownloadCouldNotBeCreatedYour,
      ),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileRecoveryPanel.exportUnreadableData,
      }),
    )
    expect(download).toHaveBeenLastCalledWith(
      "preserved unreadable bytes",
      files.MAPACHESS_UNREADABLE_DATA_FILE_NAME,
      "text/plain;charset=utf-8",
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileRecoveryPanel.restoreLastKnownGoodSave,
      }),
    )
    await screen.findByRole("button", {
      name: new RegExp(copy.setup.presentations.standard.story.title),
    })
    expect((await savedProfile(indexedDb)).settings).toEqual(before.settings)
    expect((await savedProfile(indexedDb)).totalXp).toBe(before.totalXp)
  })
})
