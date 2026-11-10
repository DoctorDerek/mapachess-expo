import "./nativeUiEnvironment"
import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react-native"
import { getDocumentAsync } from "expo-document-picker"
import { isAvailableAsync, shareAsync } from "expo-sharing"
import { createElement } from "react"
import loadCatalog from "@mapachess/localization/catalog"
import createInitialMapachessPlayerData, {
  type MapachessPlayerData,
} from "@mapachess/profile/player-data"
import { createMapachessPortableBackup } from "@mapachess/profile/portable-backup"
import {
  MAPACHESS_UNREADABLE_DATA_FILE_NAME,
  MAX_PORTABLE_BACKUP_UTF8_BYTES,
} from "@mapachess/profile/portable-files"
import {
  selectCurrentPlayerData,
  selectImportPreview,
} from "@mapachess/profile/profile-machine"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import NativeSettings from "@/components/profile/NativeSettings"
import { MAPACHESS_ASYNC_STORAGE_NAMESPACE } from "@/lib/profile/AsyncStorageDurableStore"
import expoSha256 from "@/lib/profile/expoSha256"
import {
  exportNativePlayerData,
  readNativePlayerDataBackup,
  shareNativeTextFile,
} from "@/lib/profile/nativePlayerDataFiles"
import openNativeProfileRuntime from "@/lib/profile/openNativeProfileRuntime"
import useNativeFileActions from "@/lib/profile/useNativeFileActions"
import InMemoryAsyncStorage from "./nativeStorageFixture"

const mockFiles = new Map<string, string>()
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }))
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}))
jest.mock("expo-file-system", () => ({
  Paths: { cache: { uri: "file:///cache/" } },
  File: class {
    public readonly uri: string
    constructor(location: string | { uri: string }, name?: string) {
      this.uri =
        (typeof location === "string" ? location : location.uri) + (name ?? "")
    }
    public get size() {
      return mockFiles.get(this.uri)?.length ?? 0
    }
    public get exists() {
      return mockFiles.has(this.uri)
    }
    public async text() {
      const value = mockFiles.get(this.uri)
      if (value === undefined) throw new Error("Unreadable fixture file")
      return value
    }
    public create() {
      mockFiles.set(this.uri, "")
    }
    public write(value: string) {
      mockFiles.set(this.uri, value)
    }
    public delete() {
      mockFiles.delete(this.uri)
    }
  },
}))

const choose = jest.mocked(getDocumentAsync)
const available = jest.mocked(isAvailableAsync)
const share = jest.mocked(shareAsync)
beforeEach(() => {
  mockFiles.clear()
  available.mockResolvedValue(true)
  share.mockResolvedValue(undefined)
})
const selection = (uri: string, size = 3) => ({
  canceled: false as const,
  assets: [
    {
      uri,
      size,
      name: "backup.json",
      mimeType: "application/json",
      lastModified: 0,
    },
  ],
})

describe("native portable file ownership", () => {
  it("returns selected bytes and deletes only the chooser's private cached copy", async () => {
    const uri = "file:///cache/DocumentPicker/backup.json"
    mockFiles.set(uri, "{}")
    choose.mockResolvedValue(selection(uri))
    expect(
      await readNativePlayerDataBackup(new AbortController().signal),
    ).toEqual({ status: "ready", contents: "{}" })
    expect(mockFiles.has(uri)).toBe(false)
  })
  it("does not delete a source document outside the app cache", async () => {
    const uri = "file:///documents/original.json"
    mockFiles.set(uri, "{}")
    choose.mockResolvedValue(selection(uri))
    await readNativePlayerDataBackup(new AbortController().signal)
    expect(mockFiles.get(uri)).toBe("{}")
  })
  it("rejects excessive size without reading it and cleans an abandoned selection", async () => {
    const uri = "file:///cache/DocumentPicker/backup.json"
    mockFiles.set(uri, "{}")
    choose.mockResolvedValue(selection(uri, MAX_PORTABLE_BACKUP_UTF8_BYTES + 1))
    expect(
      await readNativePlayerDataBackup(new AbortController().signal),
    ).toEqual({ status: "too-large" })
    expect(mockFiles.has(uri)).toBe(false)
    const abort = new AbortController()
    abort.abort()
    mockFiles.set(uri, "{}")
    choose.mockResolvedValue(selection(uri))
    expect(await readNativePlayerDataBackup(abort.signal)).toEqual({
      status: "cancelled",
    })
    expect(mockFiles.has(uri)).toBe(false)
  })
  it("removes exported cache files even if the system share sheet rejects", async () => {
    share.mockRejectedValueOnce(new Error("Sharing failed"))
    await expect(
      shareNativeTextFile(
        "retained save",
        "backup.json",
        new AbortController().signal,
      ),
    ).rejects.toThrow("Sharing failed")
    expect(mockFiles.size).toBe(0)
  })
  it("creates the real portable backup before invoking system sharing", async () => {
    const data = createInitialMapachessPlayerData()
    let exported = ""
    share.mockImplementationOnce(async (uri) => {
      exported = mockFiles.get(uri) ?? ""
    })
    await exportNativePlayerData(data, new AbortController().signal)
    expect(JSON.parse(exported)).toMatchObject({
      payload: { ratings: data.ratings, totalXp: data.totalXp },
      format: "mapachess-portable-backup",
    })
    expect(mockFiles.size).toBe(0)
  })
  it("reports unavailable sharing without creating a temporary file", async () => {
    available.mockResolvedValueOnce(false)
    await expect(
      shareNativeTextFile("data", "backup.json", new AbortController().signal),
    ).rejects.toThrow("unavailable")
    expect(mockFiles.size).toBe(0)
  })
})

describe("native profile file actions", () => {
  it("shows recovery for picker and share errors in the actual Settings surface", async () => {
    const profile = await openNativeProfileRuntime({
      storage: new InMemoryAsyncStorage(),
    })
    try {
      await waitFor(() =>
        expect(profile.actor.getSnapshot().matches("ready")).toBe(true),
      )
      const copy = loadCatalog("en")
      const original = selectCurrentPlayerData(profile.actor.getSnapshot())
      if (original === null) throw new Error("Expected the accepted profile")
      function FileSettings({
        actor,
        data,
      }: Readonly<{ actor: ProfileActor; data: MapachessPlayerData }>) {
        return createElement(NativeSettings, {
          actor,
          data,
          files: useNativeFileActions(actor),
          disabled: false,
          navigation: {
            back: () => undefined,
            close: () => undefined,
            open: () => undefined,
          },
          overlay: undefined,
          onAutoHintModeChanged: () => undefined,
        })
      }
      await render(
        createElement(FileSettings, { actor: profile.actor, data: original }),
      )
      const importButton = () =>
        screen.getByRole("button", {
          name: copy.interface.profileFoundation.importBackup,
        })
      const exportButton = () =>
        screen.getByRole("button", {
          name: copy.interface.profileSettingsPanel.exportPlayerData,
        })
      const uri = "file:///cache/DocumentPicker/large.json"
      choose.mockResolvedValueOnce(
        selection(uri, MAX_PORTABLE_BACKUP_UTF8_BYTES + 1),
      )
      await fireEvent.press(importButton())
      expect(await screen.findByRole("alert")).toHaveTextContent(
        copy.profile.fileTooLarge,
      )
      share.mockRejectedValueOnce(new Error("Unable to share"))
      await fireEvent.press(exportButton())
      expect(await screen.findByRole("alert")).toHaveTextContent(
        copy.profile.shareFailed,
      )
      choose.mockResolvedValueOnce({ canceled: true, assets: null })
      await fireEvent.press(importButton())
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
      expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(
        original,
      )
      expect(mockFiles.size).toBe(0)
    } finally {
      await profile.close()
    }
  })

  it("guards concurrent file actions and only previews a valid selected backup", async () => {
    const profile = await openNativeProfileRuntime({
      storage: new InMemoryAsyncStorage(),
    })
    try {
      await waitFor(() =>
        expect(profile.actor.getSnapshot().matches("ready")).toBe(true),
      )
      const before = selectCurrentPlayerData(profile.actor.getSnapshot())
      const contents = await createMapachessPortableBackup({
        applicationVersion: "0.0.0",
        gddRevision: "fixture",
        playerData: { ...createInitialMapachessPlayerData(), totalXp: 300 },
        sha256: expoSha256,
      })
      const uri = "file:///cache/DocumentPicker/import.json"
      mockFiles.set(uri, contents)
      const pending =
        Promise.withResolvers<Awaited<ReturnType<typeof getDocumentAsync>>>()
      choose.mockReturnValueOnce(pending.promise)
      const { result } = await renderHook(() =>
        useNativeFileActions(profile.actor),
      )
      let importing: Promise<void> | undefined
      await act(() => {
        importing = result.current.importData()
      })
      expect(result.current.status).toBe("busy")
      await act(() => result.current.exportData())
      expect(share).not.toHaveBeenCalled()
      await act(async () => {
        pending.resolve(selection(uri, contents.length))
        await importing
      })
      await waitFor(() =>
        expect(
          selectImportPreview(profile.actor.getSnapshot())?.payload.totalXp,
        ).toBe(300),
      )
      expect(result.current.status).toBe("idle")
      expect(selectCurrentPlayerData(profile.actor.getSnapshot())).toEqual(
        before,
      )
      expect(mockFiles.has(uri)).toBe(false)
      await act(() => profile.actor.send({ type: "PROFILE.IMPORT_CANCELLED" }))

      choose.mockResolvedValueOnce(
        selection(uri, MAX_PORTABLE_BACKUP_UTF8_BYTES + 1),
      )
      await act(() => result.current.importData())
      expect(result.current.status).toBe("too-large")
      expect(profile.actor.getSnapshot().matches("ready")).toBe(true)
      await act(() => result.current.exportData())
      expect(result.current.status).toBe("idle")
      expect(share).toHaveBeenCalledTimes(1)
    } finally {
      await profile.close()
    }
  })

  it("reports a failed share and preserves the exact unreadable save for retry", async () => {
    const storage = new InMemoryAsyncStorage()
    const key = MAPACHESS_ASYNC_STORAGE_NAMESPACE + "/current"
    const unreadable = "unreadable player save"
    storage.values.set(key, unreadable)
    const profile = await openNativeProfileRuntime({ storage })
    try {
      await waitFor(() =>
        expect(profile.actor.getSnapshot().matches("recovery")).toBe(true),
      )
      const { result } = await renderHook(() =>
        useNativeFileActions(profile.actor),
      )
      await act(() => result.current.exportData())
      expect(result.current.status).toBe("failed")
      expect(share).not.toHaveBeenCalled()
      share.mockRejectedValueOnce(new Error("Share failed"))
      await act(() => result.current.exportUnreadable())
      expect(result.current.status).toBe("failed")
      expect(result.current.failure).not.toBeNull()
      let exported: string | undefined
      share.mockImplementationOnce(async (uri) => {
        exported = mockFiles.get(uri)
      })
      await act(() => result.current.exportUnreadable())
      expect(share).toHaveBeenLastCalledWith(
        `file:///cache/${MAPACHESS_UNREADABLE_DATA_FILE_NAME}`,
        { mimeType: "text/plain" },
      )
      expect(exported).toBe(unreadable)
      expect(result.current.status).toBe("idle")
      expect(result.current.failure).toBeNull()
      expect(storage.values.get(key)).toBe(unreadable)
      expect(mockFiles.size).toBe(0)
    } finally {
      await profile.close()
    }
  })
})
