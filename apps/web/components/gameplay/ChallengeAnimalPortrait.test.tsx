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
  it.each([
    ["chicken-stockfish", ["idle", "idle-blink", "sit"]],
    ["raccoon-stockfish", ["idle", "idle-blink", "sit-one", "sit-two"]],
    ["bunny-stockfish", ["idle", "idle_blink", "sit"]],
    ["dog-stockfish", ["idle", "idle_blink", "sit"]],
    ["cat-stockfish", ["idle", "idle_blink", "sit"]],
    ["mouse-stockfish", ["idle", "idle_blink"]],
    ["frog-stockfish", ["idle"]],
    ["turtle-stockfish", ["idle", "idle_blink"]],
    ["panda-stockfish", ["idle", "idle_laugh"]],
    ["otter-stockfish", ["idle", "idle_blink", "sit"]],
    ["axolotl-stockfish", ["idle", "idle_blink", "sit"]],
    ["hedgehog-stockfish", ["idle", "idle_blink"]],
    ["deer-stockfish", ["idle", "eat"]],
    ["fox-stockfish", ["idle", "idle_blink", "sit01", "sit02"]],
    ["wolf-stockfish", ["idle", "idle_blink", "sit"]],
    ["falcon-stockfish", ["idle", "idle_call"]],
    ["crane-stockfish", ["idle", "idle_blink"]],
    ["crow-stockfish", ["idle", "idle_caw"]],
    ["parrot-stockfish", ["idle", "idle_caw"]],
    ["bat-stockfish", ["idle_upright", "idle_upright_blink"]],
    ["dragonfly-stockfish", ["idle", "idle_blink"]],
  ] as const)("uses the shared ordered calm pool for %s", (id, pool) => {
    for (let ordinal = 0; ordinal <= pool.length; ordinal += 1) {
      const result = resolveWebOpponentPresentation(
        id,
        { family: "idle" },
        ordinal,
      )
      if (result.kind !== "sprite") throw new Error("Expected licensed sprite")
      expect(result.steps).toHaveLength(1)
      const step = result.steps[0]
      expect(step.animationId).toBe(pool[ordinal % pool.length])
      expect(step.playback).toBe("loop")
      expect(step.animation.frameDurationMilliseconds).toBe(160)
      const g = step.animation.geometry
      expect((g.bottomY - g.visibleY) * 3).toBeLessThanOrEqual(100)
      expect(
        Math.max(
          g.bottomCenterX - g.visibleX,
          g.visibleX + g.visibleWidth - g.bottomCenterX,
        ) * 6,
      ).toBeLessThanOrEqual(132)
      expect(g.visibleY + g.visibleHeight).toBeLessThanOrEqual(g.bottomY)
    }
  })
  it.each(IMPLEMENTED_DURABLE_OPPONENT_IDS)(
    "keeps %s attention source-authored, bounded and at action pacing",
    (id) => {
      const attention = resolveWebOpponentAttention(id)
      if (id === "ninja-stockfish" || id === "war-hero-stockfish") {
        expect(attention).toBeNull()
        return
      }
      for (let ordinal = 0; ordinal < 3; ordinal += 1) {
        const attention = resolveWebOpponentAttention(id, ordinal)
        if (attention === null) throw new Error("Expected attention clip")
        expect(attention.playback).toBe("once")
        expect(attention.animation.frameDurationMilliseconds).toBe(100)
        const g = attention.animation.geometry
        expect((g.bottomY - g.visibleY) * 3).toBeLessThanOrEqual(100)
        expect(
          Math.max(
            g.bottomCenterX - g.visibleX,
            g.visibleX + g.visibleWidth - g.bottomCenterX,
          ) * 6,
        ).toBeLessThanOrEqual(132)
        expect(g.visibleY + g.visibleHeight).toBeLessThanOrEqual(g.bottomY)
        expect(attention.animationId).not.toMatch(/attack|hurt|die|wall|swim/)
      }
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
