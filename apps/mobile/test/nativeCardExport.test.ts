import "./nativeUiEnvironment"
import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"
import { isAvailableAsync, shareAsync } from "expo-sharing"
import { createElement } from "react"
import { AccessibilityInfo, Image } from "react-native"
import { captureRef, releaseCapture } from "react-native-view-shot"
import { encode } from "upng-js"
import loadCatalog from "@mapachess/localization/catalog"
import {
  CARD_IDLE_FRAME_MILLISECONDS,
  PROFILE_CARD_HEIGHT,
  PROFILE_CARD_WIDTH,
} from "@mapachess/match-presentation/profile-card-format"
import createInitialMapachessPlayerData from "@mapachess/profile/player-data"
import {
  cardFacts,
  INITIAL_CARD_CONTENT,
  type CardInput,
} from "@mapachess/profile/profile-card-model"
import { DEFAULT_CARD_RATING_CONTEXT } from "@mapachess/profile/rating-context"
import NativeCardShare from "@/components/profile/NativeCardShare"
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
jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(),
  releaseCapture: jest.fn(),
}))
jest.mock("@/lib/gameplay/nativeApplicationActivity", () => ({
  __esModule: true,
  default: () => ({ isActive: () => true, subscribe: () => () => undefined }),
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

describe("native profile card share controls", () => {
  const copy = loadCatalog("en")
  const renderShare = (onBack = jest.fn()) =>
    render(
      createElement(NativeCardShare, {
        data,
        appearance: data.appearance,
        ratingContext: DEFAULT_CARD_RATING_CONTEXT,
        onBack,
      }),
    )
  const png = () =>
    screen.getByRole("button", { name: copy.profile.shareFormat("PNG") })
  const choosePng = async () => {
    await fireEvent.press(
      screen.getByRole("button", { name: copy.profile.cardFormats.PNG }),
    )
  }
  const loadArtwork = async (view: Awaited<ReturnType<typeof renderShare>>) => {
    const images = view.container.queryAll(
      (element) =>
        element.type === "RNSVGImage" &&
        typeof element.props.onLoad === "function",
    )
    expect(images.length).toBeGreaterThan(0)
    for (const image of images)
      await fireEvent(image, "load", { nativeEvent: {} })
  }
  beforeEach(() => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true)
    jest.spyOn(Image, "resolveAssetSource").mockReturnValue({
      uri: "file:///assets/card-sprite.png",
      width: 100,
      height: 100,
      scale: 1,
    })
    jest
      .spyOn(Image, "getSize")
      .mockImplementation((_uri, complete) => complete(100, 100))
  })

  it("enables sharing only when artwork is loaded and retries a rejected PNG capture", async () => {
    const view = await renderShare()
    await choosePng()
    expect(png()).toBeDisabled()
    await fireEvent.press(
      screen.getByRole("checkbox", { name: copy.profile.animalCompanion }),
    )
    expect(
      screen.getByRole("checkbox", {
        name: copy.profile.animalCompanion,
        checked: false,
      }),
    ).toBeOnTheScreen()
    await loadArtwork(view)
    expect(png()).toBeEnabled()
    jest
      .mocked(captureRef)
      .mockRejectedValueOnce(new Error("Capture unavailable"))
    await fireEvent.press(png())
    expect(await screen.findByRole("alert")).toHaveTextContent(
      copy.profile.retryFormat("PNG"),
    )
    expect(captureRef).toHaveBeenCalledTimes(1)
    expect(share).not.toHaveBeenCalled()
    jest
      .mocked(captureRef)
      .mockImplementationOnce(() => capture(0, new AbortController().signal))
    await fireEvent.press(png())
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith("file:///cache/capture-0.png", {
        mimeType: "image/png",
        UTI: "public.png",
      }),
    )
    await waitFor(() => expect(png()).toBeEnabled())
    expect(screen.queryByRole("alert")).toBeNull()
    expect(mockFiles.size).toBe(0)
  })

  it("leaves promptly and releases a capture that finishes after Back", async () => {
    const back = jest.fn()
    const view = await renderShare(back)
    await choosePng()
    await loadArtwork(view)
    const pending = Promise.withResolvers<string>()
    jest.mocked(captureRef).mockReturnValueOnce(pending.promise)
    await fireEvent.press(png())
    await waitFor(() => expect(captureRef).toHaveBeenCalledTimes(1))
    expect(png()).toBeDisabled()
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.interface.profileCardJourney.back,
      }),
    )
    expect(back).toHaveBeenCalledTimes(1)
    await view.unmount()
    await act(() => pending.resolve("file:///cache/late.png"))
    expect(releaseCapture).toHaveBeenCalledWith("file:///cache/late.png")
    expect(share).not.toHaveBeenCalled()
  })

  it("keeps an undecoded preview disabled until an explicit artwork retry succeeds", async () => {
    jest
      .spyOn(Image, "getSize")
      .mockImplementationOnce((_uri, _complete, failure) => {
        failure?.(new Error("Artwork decode failed"))
      })
    const view = await renderShare()
    await choosePng()
    expect(screen.getByRole("alert")).toHaveTextContent(
      copy.interface.profileCardPreview
        .imagePreparationFailedYourAppearancePreviewChoices,
    )
    expect(png()).toBeDisabled()
    await fireEvent.press(
      screen.getByRole("button", { name: copy.profile.retryFormat("PNG") }),
    )
    expect(screen.queryByRole("alert")).toBeNull()
    expect(png()).toBeDisabled()
    await loadArtwork(view)
    expect(png()).toBeEnabled()
    expect(share).not.toHaveBeenCalled()
  })

  it("advances the normal-motion GIF preview and releases its timer when selecting PNG", async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValueOnce(false)
    const schedule = jest.spyOn(globalThis, "setInterval")
    const cancel = jest.spyOn(globalThis, "clearInterval")
    const view = await renderShare()
    await loadArtwork(view)
    const timerIndex = schedule.mock.calls.findIndex(
      ([, delay]) => delay === CARD_IDLE_FRAME_MILLISECONDS,
    )
    const advance = schedule.mock.calls[timerIndex]?.[0]
    const timer = schedule.mock.results[timerIndex]
    if (typeof advance !== "function" || timer?.type !== "return")
      throw new Error("Expected an active GIF preview timer")
    await act(() => advance())
    await choosePng()
    expect(cancel).toHaveBeenCalledWith(timer.value)
    expect(png()).toBeEnabled()
  })
})
