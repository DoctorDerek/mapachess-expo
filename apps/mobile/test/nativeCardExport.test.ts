import "./nativeUiEnvironment"
import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { isAvailableAsync, shareAsync } from "expo-sharing"
import { encode } from "upng-js"
import {
  PROFILE_CARD_HEIGHT,
  PROFILE_CARD_WIDTH,
} from "@mapachess/match-presentation/profile-card-format"
import createInitialMapachessPlayerData from "@mapachess/profile/player-data"
import {
  cardFacts,
  INITIAL_CARD_CONTENT,
  type CardInput,
} from "@mapachess/profile/profile-card-model"
import { nativeCardFrameCount } from "@/lib/presentation/nativeCardAssets"
import shareNativeCard from "@/lib/presentation/nativeCardExport"

const mockFiles = new Map<string, Uint8Array>()
let mockArtworkAvailable = true
jest.mock("@/lib/presentation/nativeAssetManifest", () => ({
  __esModule: true,
  default: {
    images: new Proxy(
      {},
      { get: () => (mockArtworkAvailable ? 1 : undefined) },
    ),
  },
}))
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
    public get exists() {
      return mockFiles.has(this.uri)
    }
    public async bytes() {
      const value = mockFiles.get(this.uri)
      if (value === undefined) throw new Error("Missing captured frame")
      return value
    }
    public create() {
      mockFiles.set(this.uri, new Uint8Array())
    }
    public write(value: Uint8Array) {
      mockFiles.set(this.uri, value)
    }
    public delete() {
      mockFiles.delete(this.uri)
    }
  },
}))

const available = jest.mocked(isAvailableAsync)
const share = jest.mocked(shareAsync)
const data = createInitialMapachessPlayerData()
const input: CardInput = {
  appearance: data.appearance,
  facts: cardFacts(data),
  content: { ...INITIAL_CARD_CONTENT, animal: false },
  locale: "en",
  format: "PNG",
}
const frame = new Uint8Array(
  encode(
    [
      new Uint8Array(PROFILE_CARD_WIDTH * PROFILE_CARD_HEIGHT * 4).fill(255)
        .buffer,
    ],
    PROFILE_CARD_WIDTH,
    PROFILE_CARD_HEIGHT,
    0,
  ),
)
const capture = jest.fn(async (index: number, _signal: AbortSignal) => {
  const uri = `file:///cache/capture-${String(index)}.png`
  mockFiles.set(uri, frame)
  return uri
})
beforeEach(() => {
  mockFiles.clear()
  mockArtworkAvailable = true
  capture.mockClear()
  available.mockResolvedValue(true)
  share.mockResolvedValue(undefined)
})

describe("native profile-card sharing adapter", () => {
  it("shares an actual PNG capture with native image metadata and cleans the owned file", async () => {
    let exported: Uint8Array | undefined
    share.mockImplementationOnce(async (uri) => {
      exported = mockFiles.get(uri)
    })
    const signal = new AbortController().signal
    await shareNativeCard(input, capture, signal)
    expect(capture).toHaveBeenCalledWith(0, signal)
    expect(exported).toEqual(frame)
    expect(share).toHaveBeenCalledWith("file:///cache/capture-0.png", {
      mimeType: "image/png",
      UTI: "public.png",
    })
    expect(mockFiles.size).toBe(0)
  })

  it("decodes real PNG frames and encodes a full-cycle GIF with the shared encoder", async () => {
    let exported: Uint8Array | undefined
    share.mockImplementationOnce(async (uri) => {
      exported = mockFiles.get(uri)
    })
    const animation = { ...input, format: "GIF" as const }
    await shareNativeCard(animation, capture, new AbortController().signal)
    expect(capture).toHaveBeenCalledTimes(nativeCardFrameCount(animation))
    expect(exported?.slice(0, 6)).toEqual(
      Uint8Array.from([71, 73, 70, 56, 57, 97]),
    )
    expect(share).toHaveBeenCalledWith("file:///cache/Mapachess-profile.gif", {
      mimeType: "image/gif",
      UTI: "com.compuserve.gif",
    })
    expect(mockFiles.size).toBe(0)
  })

  it("rejects an invalid capture format without publishing or retaining its file", async () => {
    const invalid = jest.fn(async () => {
      const uri = "file:///cache/invalid.png"
      mockFiles.set(
        uri,
        new Uint8Array(encode([new Uint8Array(4).buffer], 1, 1, 0)),
      )
      return uri
    })
    await expect(
      shareNativeCard(
        { ...input, format: "GIF" },
        invalid,
        new AbortController().signal,
      ),
    ).rejects.toThrow("unsupported pixel format")
    expect(share).not.toHaveBeenCalled()
    expect(mockFiles.size).toBe(0)
  })

  it("cleans captured files after cancellation or system share failure", async () => {
    const abort = new AbortController()
    await expect(
      shareNativeCard(
        input,
        async (index, signal) => {
          const uri = await capture(index, signal)
          abort.abort(new Error("Cancelled card"))
          return uri
        },
        abort.signal,
      ),
    ).rejects.toThrow("Cancelled card")
    expect(mockFiles.size).toBe(0)
    share.mockRejectedValueOnce(new Error("System share failed"))
    await expect(
      shareNativeCard(input, capture, new AbortController().signal),
    ).rejects.toThrow("System share failed")
    expect(mockFiles.size).toBe(0)
  })

  it("does not capture when artwork or native sharing is unavailable", async () => {
    mockArtworkAvailable = false
    await expect(
      shareNativeCard(input, capture, new AbortController().signal),
    ).rejects.toThrow("artwork is unavailable")
    mockArtworkAvailable = true
    available.mockResolvedValueOnce(false)
    await expect(
      shareNativeCard(input, capture, new AbortController().signal),
    ).rejects.toThrow("sharing is unavailable")
    expect(capture).not.toHaveBeenCalled()
    expect(mockFiles.size).toBe(0)
  })
})
