// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"enableImageFileLoading":true}}
import { CanvasAdapter } from "@happy-dom/node-canvas-adapter"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { DetachedWindowAPI } from "happy-dom"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import { DEFAULT_PLAYER_APPEARANCE } from "@mapachess/profile/player-appearance"
import createInitialPlayerData from "@mapachess/profile/player-data"
import {
  cardFacts,
  drawCardCharacters,
  drawProfileCard,
  INITIAL_CARD_CONTENT,
  loadCardArtwork,
  type CardInput,
} from "../../lib/presentation/profileCardArtwork"
import {
  PROFILE_CARD_HEIGHT,
  PROFILE_CARD_WIDTH,
} from "../../lib/presentation/profileCardFormat"
import { installDomHarness } from "../../test/domHarness"
import gamepadHarness from "../../test/gamepadHarness"
import { ProfileArtwork } from "./ProfileCard"

vi.hoisted(() => vi.stubEnv("MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS", "true"))
afterAll(() => vi.unstubAllEnvs())
installDomHarness()
const copy = loadCatalog("en")
const input: CardInput = {
  appearance: DEFAULT_PLAYER_APPEARANCE,
  facts: cardFacts(createInitialPlayerData()),
  content: INITIAL_CARD_CONTENT,
  format: "PNG",
}
const palette = {
  blue: "#1875bd",
  cyan: "#57ddff",
  mint: "#b5ffdb",
  yellow: "#ffee39",
  ink: "#102030",
  white: "#ffffff",
}

beforeEach(() => {
  if (
    !("happyDOM" in window) ||
    !(window.happyDOM instanceof DetachedWindowAPI)
  )
    throw new Error("The artwork fixture requires the Happy DOM environment.")
  window.happyDOM.settings.canvasAdapter = new CanvasAdapter()
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockRestore()
  for (const [name, color] of Object.entries(palette))
    document.documentElement.style.setProperty(
      name === "white"
        ? "--color-mapachito-white"
        : `--color-profile-card-${name}`,
      color,
    )
  const source = document.createElement("canvas")
  source.width = 1920
  source.height = 128
  const context = source.getContext("2d")
  if (context === null)
    throw new Error("The drawing tests require the real Canvas backend.")
  context.fillStyle = "#bf2355"
  context.fillRect(0, 0, source.width, source.height)
  const png = source.toDataURL("image/png")
  vi.stubGlobal(
    "Image",
    class {
      constructor() {
        const image = document.createElement("img")
        let requested = ""
        Object.defineProperty(image, "src", {
          configurable: true,
          get: () => requested,
          set: (value: string) => {
            requested = value
            image.setAttribute("src", png)
          },
        })
        image.decode = async () => {
          if (image.complete && image.naturalWidth > 0) return
          await new Promise<void>((resolve, reject) => {
            image.addEventListener("load", () => resolve(), { once: true })
            image.addEventListener(
              "error",
              () => reject(new Error("Fixture PNG decode failed")),
              { once: true },
            )
          })
        }
        return image
      }
    },
  )
})

describe("profile artwork decoding, drawing, and lifecycle", () => {
  it("preserves the live Canvas placement and exact source-frame crop", async () => {
    const artwork = await loadCardArtwork({
      ...input,
      content: { ...input.content, animal: false },
    })
    const canvas = document.createElement("canvas")
    canvas.width = 360
    canvas.height = 450
    const context = canvas.getContext("2d")
    if (context === null) throw new Error("The drawing context must exist.")
    const draw = vi.spyOn(context, "drawImage")
    drawCardCharacters(context, artwork, 8, canvas.width, canvas.height)
    expect(draw.mock.calls).toHaveLength(artwork.hero.length)
    for (const [index, call] of draw.mock.calls.entries())
      expect(call).toEqual([
        artwork.hero[index],
        99,
        0,
        25,
        31,
        43,
        55,
        275,
        341,
      ])
    expect(context.imageSmoothingEnabled).toBe(false)
    expect([...context.getImageData(100, 100, 1, 1).data]).toEqual([
      191, 35, 85, 255,
    ])
    expect([...context.getImageData(0, 0, 1, 1).data]).toEqual([0, 0, 0, 0])
  })
  it("loads layered artwork, a companion and medal, then reuses decoded source images", async () => {
    const first = await loadCardArtwork(input)
    const second = await loadCardArtwork(input)
    expect(first.hero.length).toBeGreaterThan(3)
    expect(
      first.hero.every((image, index) => image === second.hero[index]),
    ).toBe(true)
    expect(first.hero.every((image) => image.naturalWidth > 0)).toBe(true)
    expect(first.animal?.image.naturalWidth).toBeGreaterThan(0)
    expect(first.medal?.naturalWidth).toBeGreaterThan(0)
    expect(first.palette).toEqual(palette)
  })
  it.each([
    { level: true, standard: true, chess960: true, animal: true },
    { level: false, standard: true, chess960: false, animal: false },
    { level: true, standard: false, chess960: true, animal: true },
    { level: true, standard: false, chess960: false, animal: false },
    { level: false, standard: false, chess960: false, animal: false },
  ])(
    "renders truthful optional facts and a flattened invitation (%#)",
    async (content) => {
      const canvas = document.createElement("canvas")
      canvas.width = PROFILE_CARD_WIDTH
      canvas.height = PROFILE_CARD_HEIGHT
      const context = canvas.getContext("2d")
      if (context === null) throw new Error("The drawing context must exist.")
      const fillText = vi.spyOn(context, "fillText")
      const changed = {
        ...input,
        content,
        facts: { ...input.facts, standard: 445, chess960: 732 },
      }
      const artwork = await loadCardArtwork(changed)
      drawProfileCard(context, artwork, changed, 37)
      const labels = fillText.mock.calls.map(([label]) => label)
      expect(labels).toContain(copy.profile.playFree)
      expect(labels.includes(copy.profile.ratingLabel.standard)).toBe(
        content.standard,
      )
      expect(labels.includes(copy.profile.ratingLabel.chess960)).toBe(
        content.chess960,
      )
      expect(labels.includes(copy.profile.level)).toBe(content.level)
      expect(labels.includes("445")).toBe(content.standard)
      expect(labels.includes("732")).toBe(content.chess960)
      expect(context.getImageData(0, 0, 1, 1).data[3]).toBe(255)
      expect(canvas.toDataURL("image/png")).toMatch(/^data:image\/png;base64,/)
    },
  )
  it("omits medal artwork when ratings are omitted or the preview is artwork-only", async () => {
    expect((await loadCardArtwork(input, false)).medal).toBeNull()
    const withoutFacts = {
      ...input,
      content: {
        ...input.content,
        standard: false,
        chess960: false,
        animal: false,
      },
    }
    const artwork = await loadCardArtwork(withoutFacts)
    expect(artwork.medal).toBeNull()
    expect(artwork.animal).toBeNull()
  })
  it("rejects unavailable theme tokens instead of drawing an untruthful image", async () => {
    document.documentElement.style.removeProperty("--color-profile-card-yellow")
    await expect(loadCardArtwork(input)).rejects.toThrow(
      "Profile card colors are unavailable.",
    )
  })
  it("draws an actual mounted preview and stops its animation work on unmount", async () => {
    const frames = gamepadHarness()
    vi.stubGlobal("matchMedia", (media: string): MediaQueryList => ({
      matches: false,
      media,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    }))
    const view = render(
      <ProfileArtwork input={{ ...input, format: "GIF" }} exportPreview />,
    )
    const canvas = view.container.querySelector("canvas")
    const context = canvas?.getContext("2d")
    if (context == null) throw new Error("The mounted preview requires Canvas.")
    await waitFor(() =>
      expect(
        context
          .getImageData(0, 0, canvas?.width ?? 0, canvas?.height ?? 0)
          .data.some((value) => value !== 0),
      ).toBe(true),
    )
    expect(frames.pendingFrames).toBe(1)
    frames.frame(200)
    expect(frames.pendingFrames).toBe(1)
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true)
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    expect(frames.pendingFrames).toBe(0)
    hidden.mockReturnValue(false)
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    expect(frames.pendingFrames).toBe(1)
    view.unmount()
    expect(frames.pendingFrames).toBe(0)
  })
  it("surfaces an unavailable palette as recoverable artwork failure, then retries the same selected card", async () => {
    document.documentElement.style.removeProperty("--color-profile-card-yellow")
    render(<ProfileArtwork input={input} exportPreview />)
    const retry = await screen.findByRole("button", {
      name: copy.interface.profileCard.retryArtwork,
    })
    document.documentElement.style.setProperty(
      "--color-profile-card-yellow",
      palette.yellow,
    )
    fireEvent.click(retry)
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
    expect(
      screen.queryByRole("button", {
        name: copy.interface.profileCard.retryArtwork,
      }),
    ).toBeNull()
  })
  it("recovers a drawing failure through Retry without losing the selected card", async () => {
    const view = render(<ProfileArtwork input={input} />)
    const canvas = view.container.querySelector("canvas")
    const context = canvas?.getContext("2d")
    if (context == null) throw new Error("The mounted preview requires Canvas.")
    vi.spyOn(context, "drawImage").mockImplementationOnce(() => {
      throw new Error("Transient renderer failure")
    })
    const retry = await screen.findByRole("button", {
      name: copy.interface.profileCard.retryArtwork,
    })
    fireEvent.click(retry)
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
    expect(
      context
        .getImageData(0, 0, canvas?.width ?? 0, canvas?.height ?? 0)
        .data.some((value) => value !== 0),
    ).toBe(true)
    await act(async () => view.unmount())
  })
})
