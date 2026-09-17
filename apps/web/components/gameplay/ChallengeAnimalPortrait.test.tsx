import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, describe, expect, it, vi } from "vitest"
import { IMPLEMENTED_DURABLE_OPPONENT_IDS } from "@mapachess/match/durable-match-record"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import resolveWebOpponentPresentation, {
  resolveWebOpponentAttention,
} from "../../lib/presentation/webOpponentPresentation"
import ChallengeAnimalPortrait from "./ChallengeAnimalPortrait"

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

describe("Challenge animal portrait asset contract", () => {
  it.each(IMPLEMENTED_DURABLE_OPPONENT_IDS)(
    "keeps %s attention source-authored, bounded and at action pacing",
    (id) => {
      const attention = resolveWebOpponentAttention(id)
      if (id === "ninja-stockfish" || id === "war-hero-stockfish") {
        expect(attention).toBeNull()
        return
      }
      if (attention === null) throw new Error("Expected attention clip")
      expect(attention.playback).toBe("once")
      expect(attention.animation.frameDurationMilliseconds).toBe(100)
      const g = attention.animation.geometry
      expect((g.bottomY - g.visibleY) * 3).toBeLessThanOrEqual(92)
      expect(
        Math.max(
          g.bottomCenterX - g.visibleX,
          g.visibleX + g.visibleWidth - g.bottomCenterX,
        ) * 6,
      ).toBeLessThanOrEqual(132)
      expect(g.visibleY + g.visibleHeight).toBeLessThanOrEqual(g.bottomY)
      expect(attention.animationId).not.toMatch(/attack|hurt|die|wall|swim/)
    },
  )
  it.each(IMPLEMENTED_DURABLE_OPPONENT_IDS)(
    "uses one existing idle strip with fitting authored bounds for %s",
    (id) => {
      const presentation = resolveWebOpponentPresentation(id)
      if (presentation.kind !== "sprite")
        throw new Error("Expected licensed sprite")
      const { animation } = presentation.steps[0]
      const geometry = animation.geometry
      const markup = renderToStaticMarkup(
        <ChallengeAnimalPortrait opponent={stockfishOpponent(id)} active />,
      )
      expect(markup.match(/rel="preload"/g)).toHaveLength(1)
      expect(markup).toContain(animation.sourceId)
      const scale = presentation.layout.standaloneScale ?? 2
      expect(geometry.visibleWidth * scale).toBeLessThanOrEqual(116)
      expect(
        (geometry.bottomY - geometry.visibleY) * scale,
      ).toBeLessThanOrEqual(92)
      expect(markup).toContain(`--sprite-scale:${scale}`)
      expect(markup).not.toContain("Loading")
    },
  )

  it("does not issue preparation hints while the choices are collapsed", () => {
    const markup = renderToStaticMarkup(
      <ChallengeAnimalPortrait
        opponent={stockfishOpponent("chicken-stockfish")}
        active={false}
      />,
    )
    expect(markup).not.toContain('rel="preload"')
  })
})
