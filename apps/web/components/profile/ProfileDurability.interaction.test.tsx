// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
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
  it("persists a Story animal unlocked in an imported Chess960 save only after Done", async () => {
    const view = await bootApplication()
    await openSettings()
    const wins = [
      { opponentId: "chicken-stockfish", highestMedal: "bronze" },
    ] as const
    const backup = await files.createWebPlayerDataBackup(
      {
        ...createInitialPlayerData(),
        introductionCompleted: true,
        storyProgress: { standard: [], chess960: wins },
      },
      crypto.subtle,
    )
    const chooser = view.container.querySelector('input[type="file"]')
    if (!(chooser instanceof HTMLInputElement))
      throw new Error("Expected a backup picker")
    const file = new File([backup], "story-backup.json", {
      type: "application/json",
    })
    Object.defineProperty(file, "text", { value: async () => backup })
    fireEvent.change(chooser, { target: { files: [file] } })
    fireEvent.click(
      await screen.findByRole("button", {
        name: copy.interface.profileImportPreviewPanel.replaceLocalPlayerData,
      }),
    )
    await waitFor(async () =>
      expect(
        (await savedProfile(view.indexedDb)).storyProgress.chess960,
      ).toEqual(wins),
    )
    fireEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(copy.setup.presentations.standard.story.title),
      }),
    )
    const playAs = await screen.findByRole("button", {
      name: copy.setup.playAsAction(copy.animals.names["raccoon-stockfish"]),
    })
    fireEvent.click(playAs)
    const dialog = within(
      await screen.findByRole("dialog", { name: copy.setup.color }),
    )
    fireEvent.click(
      dialog.getByRole("radio", {
        name: new RegExp(copy.animals.names["chicken-stockfish"]),
      }),
    )
    expect((await savedProfile(view.indexedDb)).appearance.animal).toBe(
      "raccoon-stockfish",
    )
    fireEvent.click(dialog.getByRole("button", { name: copy.setup.done }))
    await waitFor(async () =>
      expect((await savedProfile(view.indexedDb)).appearance.animal).toBe(
        "chicken-stockfish",
      ),
    )
    const accepted = await savedProfile(view.indexedDb)
    expect(accepted.storyProgress.chess960).toEqual(wins)
    expect(accepted.activeMatch).toBeNull()
  })

  it("downloads a valid accepted backup and always releases the temporary browser URL", async () => {
    const { indexedDb } = await bootApplication()
    const before = await savedProfile(indexedDb)
    const settings = await openSettings()
    const objectUrl = "blob:mapachess-backup"
    const createUrl = vi.fn((_contents: Blob) => objectUrl)
    const revokeUrl = vi.fn()
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = createUrl
        static revokeObjectURL = revokeUrl
      },
    )
    const download = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)
    fireEvent.click(
      settings.getByRole("button", {
        name: copy.interface.profileSettingsPanel.exportPlayerData,
      }),
    )
    await waitFor(() => expect(createUrl).toHaveBeenCalledOnce())
    expect(download).toHaveBeenCalledOnce()
    const blob = createUrl.mock.calls[0]?.[0]
    const link = download.mock.contexts[0]
    if (blob === undefined || !(link instanceof HTMLAnchorElement))
      throw new Error("Expected browser download")
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Expected backup text"))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
    expect(link.download).toBe(files.MAPACHESS_PLAYER_DATA_BACKUP_FILE_NAME)
    expect(link.isConnected).toBe(false)
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith(objectUrl)
    expect(
      await decodeMapachessPortableBackup(text, (value) =>
        webSha256(value, crypto.subtle),
      ),
    ).toMatchObject({ ok: true, backup: { payload: before } })
  })

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
