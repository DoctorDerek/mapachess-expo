import "./nativeUiEnvironment"
import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { getDocumentAsync } from "expo-document-picker"
import { isAvailableAsync, shareAsync } from "expo-sharing"
import createInitialMapachessPlayerData from "@mapachess/profile/player-data"
import { MAX_PORTABLE_BACKUP_UTF8_BYTES } from "@mapachess/profile/portable-files"
import {
  exportNativePlayerData,
  readNativePlayerDataBackup,
  shareNativeTextFile,
} from "@/lib/profile/nativePlayerDataFiles"

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
