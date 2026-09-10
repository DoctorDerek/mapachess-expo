import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, describe, expect, it, vi } from "vitest"
import { IMPLEMENTED_DURABLE_OPPONENT_IDS } from "@mapachess/match/durable-match-record"
import { MATCH_SETUP_COPY } from "@mapachess/match/match-setup"
import { createInitialStoryProgress } from "@mapachess/profile/story-progress"
import WebMatchSetup from "../../components/gameplay/WebMatchSetup"
import { initialMatchPresentationSources } from "./usePreparedMatchImages"
import resolveWebOpponentPresentation from "./webOpponentPresentation"

const previousAvailability = vi.hoisted(() => {
  const previous = process.env.MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS
  process.env.MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS = "true"
  return previous
})

afterAll(() => {
  if (previousAvailability === undefined)
    delete process.env.MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS
  else
    process.env.MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS = previousAvailability
})

describe("selected match image preparation", () => {
  it.each(IMPLEMENTED_DURABLE_OPPONENT_IDS)(
    "bounds %s preparation to current opening art",
    (opponentId) => {
      const sources = initialMatchPresentationSources(opponentId)
      const opponent = resolveWebOpponentPresentation(opponentId)
      if (opponent.kind !== "sprite")
        throw new Error("Expected licensed sprite")
      expect(sources).toContain(opponent.steps[0].animation.sourceId)
      expect(sources).toContain(
        "/generated/presentation-assets/coach/neutral.png",
      )
      expect(sources).toHaveLength(opponentId === "raccoon-stockfish" ? 2 : 3)
      expect(new Set(sources).size).toBe(sources.length)
    },
  )

  it("emits selected image preloads while Start Match is still on screen", () => {
    const markup = renderToStaticMarkup(
      createElement(WebMatchSetup, {
        autoHintMode: "auto-move-hints",
        disabled: false,
        onAutoHintModeChanged: vi.fn(),
        onBack: vi.fn(),
        onStart: vi.fn(),
        setup: { mode: "story", variant: "standard" },
        storyProgress: createInitialStoryProgress(),
      }),
    )
    const imagePreloads = markup.match(
      /<link[^>]*rel="preload"[^>]*as="image"[^>]*>/g,
    )
    expect(imagePreloads).toHaveLength(3)
    for (const source of initialMatchPresentationSources("chicken-stockfish"))
      expect(
        imagePreloads?.some((link) => link.includes(`href="${source}"`)),
      ).toBe(true)
    expect(markup).toContain(MATCH_SETUP_COPY.startMatch)
    expect(markup).not.toContain("Loading images")
  })

  it("does not request assets for an unimplemented selection", () => {
    expect(initialMatchPresentationSources(null)).toEqual([])
  })

  it("does not request unavailable licensed images in a public clone", async () => {
    vi.stubEnv("MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS", "false")
    vi.resetModules()
    try {
      const { initialMatchPresentationSources: withoutAssets } =
        await import("./usePreparedMatchImages")
      expect(withoutAssets("chicken-stockfish")).toEqual([])
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })
})
