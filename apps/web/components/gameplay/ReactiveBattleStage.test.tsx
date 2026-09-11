import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createElement, Fragment, type ComponentPropsWithoutRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, describe, expect, it, vi } from "vitest"
import { createActor } from "xstate"
import matchPresentationMachine from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationPhase } from "@mapachess/match-presentation/match-reaction"
import { matchSpriteReactionSlot } from "@mapachess/match-presentation/presentation-asset-manifest"
import STORY_ANIMAL_SPRITES from "@mapachess/match-presentation/story-animal-sprites"
import { IMPLEMENTED_DURABLE_OPPONENT_IDS } from "@mapachess/match/durable-match-record"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import { battleSpriteAnchorStyle } from "../../lib/presentation/battleSpriteFrames"
import resolveWebOpponentPresentation from "../../lib/presentation/webOpponentPresentation"
import MapachitoCoachPortrait from "./MapachitoCoachPortrait"
import ReactiveBattleStage from "./ReactiveBattleStage"

const previousPresentationAssetAvailability = vi.hoisted(() => {
  const previousValue = process.env.MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS
  process.env.MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS = "true"
  return previousValue
})

type StaticMotionDivProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "onAnimationComplete"
> &
  Readonly<{
    animate?: unknown
    initial?: unknown
    onAnimationComplete?: () => void
    transition?: unknown
  }>

vi.mock("motion/react", async () => {
  const { createElement: createStaticElement } = await import("react")

  return {
    motion: {
      div: (props: StaticMotionDivProps) =>
        createStaticElement(
          "div",
          {
            "aria-label": props["aria-label"],
            className: props.className,
            role: props.role,
            style: props.style,
          },
          props.children,
        ),
    },
    useReducedMotion: () => true,
  }
})

const PLAYER_CAPTURE_PHASE = Object.freeze({
  kind: "capture",
  opponent: Object.freeze({ family: "capture", role: "victim" }),
  player: Object.freeze({ family: "capture", role: "attacker" }),
}) satisfies MatchPresentationPhase

afterAll(() => {
  if (previousPresentationAssetAvailability === undefined) {
    delete process.env.MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS
  } else {
    process.env.MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS =
      previousPresentationAssetAvailability
  }
})

describe("Reactive Battle Stage web presentation", () => {
  it.each(IMPLEMENTED_DURABLE_OPPONENT_IDS)(
    "resolves licensed %s reactions through the existing fighter contract",
    (opponentId) => {
      for (const reaction of [
        { family: "idle" },
        { family: "capture", role: "attacker" },
        { family: "capture", role: "victim" },
        { family: "check", role: "attacker" },
        { family: "check", role: "victim" },
        { family: "victory" },
        { family: "defeat" },
      ] as const) {
        const presentation = resolveWebOpponentPresentation(
          opponentId,
          reaction,
        )
        expect(presentation.kind).toBe("sprite")
        if (presentation.kind !== "sprite")
          throw new Error("Licensed sprite expected")
        const scales = battleSpriteAnchorStyle(presentation, presentation)
        for (const { animation } of presentation.steps) {
          const topExtent =
            animation.geometry.bottomY - animation.geometry.visibleY
          expect(
            topExtent * scales["--sprite-mobile-scale"],
          ).toBeLessThanOrEqual(96)
          expect(
            topExtent * scales["--sprite-desktop-scale"],
          ).toBeLessThanOrEqual(128)
          expect(
            animation.geometry.visibleY + animation.geometry.visibleHeight,
          ).toBeLessThanOrEqual(animation.geometry.bottomY)
          expect(animation.sourceId).toMatch(
            /^\/generated\/presentation-assets\/battle\//,
          )
          expect(animation.reducedMotionFrameIndex).toBeGreaterThanOrEqual(0)
          expect(animation.reducedMotionFrameIndex).toBeLessThan(
            animation.frameCount,
          )
          expect(animation.geometry.bottomY).toBe(
            presentation.referenceGeometry.bottomY,
          )
          expect(
            animation.geometry.visibleX + animation.geometry.visibleWidth,
          ).toBeLessThanOrEqual(animation.geometry.frameWidth)
          expect(
            animation.geometry.visibleY + animation.geometry.visibleHeight,
          ).toBeLessThanOrEqual(animation.geometry.frameHeight)
        }
        if (reaction.family === "capture" && reaction.role === "attacker")
          expect(presentation.steps.map(({ beat }) => beat)).toEqual([
            "approach",
            "strike",
            "recovery",
          ])
        if (reaction.family === "defeat")
          expect(presentation.steps.at(-1)?.playback).toBe(
            "once-hold-final-frame",
          )
        if (reaction.family === "victory") {
          expect(presentation.steps.at(-1)?.playback).toBe("loop")
          expect(
            presentation.steps
              .slice(0, -1)
              .every(({ playback }) => playback === "once"),
          ).toBe(true)
        }
      }
    },
  )

  it("includes every added source clip in the protected manifest without bundling a second Raccoon", () => {
    const archiveManifest = readFileSync(
      fileURLToPath(
        new URL(
          "../../../../ghost_assets/presentation-assets.manifest.json",
          import.meta.url,
        ),
      ),
      "utf8",
    )
    let clipCount = 0
    for (const sprite of Object.values(STORY_ANIMAL_SPRITES)) {
      for (const clip of Object.values(sprite.animations)) {
        expect(archiveManifest).toContain(JSON.stringify(clip.sourceId))
        clipCount += 1
      }
    }
    expect(clipCount).toBe(140)
    expect(archiveManifest).not.toContain("battle/raccoon/")
    const raccoon = resolveWebOpponentPresentation("raccoon-stockfish")
    if (raccoon.kind !== "sprite") throw new Error("Raccoon sprite expected")
    expect(raccoon.steps[0].animation.sourceId).toContain("battle/mapachito/")
  })

  it("preserves intentional public-clone fallback for every playable opponent", async () => {
    vi.stubEnv("MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS", "false")
    vi.resetModules()
    try {
      const { default: resolveWithoutAssets } =
        await import("../../lib/presentation/webOpponentPresentation")
      for (const opponentId of IMPLEMENTED_DURABLE_OPPONENT_IDS)
        expect(resolveWithoutAssets(opponentId)).toEqual({
          kind: "authored-fallback",
          reactionSlot: "idle",
        })
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })

  it("keeps factual Stage and coach meaning when motion is reduced", () => {
    const actor = createActor(matchPresentationMachine, {
      input: { initialConclusionPhase: null },
    }).start()
    actor.send({
      phases: Object.freeze([PLAYER_CAPTURE_PHASE] as const),
      type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
    })

    const markup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(ReactiveBattleStage, {
          onParticipantAnimationCompleted: vi.fn(),
          opponentName: stockfishOpponent("chicken-stockfish").displayName,
          opponentPresentation: resolveWebOpponentPresentation(
            "chicken-stockfish",
            PLAYER_CAPTURE_PHASE.opponent,
          ),
          presentationSnapshot: actor.getSnapshot(),
        }),
        createElement(MapachitoCoachPortrait, {
          presentationSnapshot: actor.getSnapshot(),
        }),
      ),
    )

    expect(markup).toContain('aria-labelledby="reactive-battle-stage-title"')
    expect(markup).toContain("Reactive Battle Stage")
    expect(markup).toContain("Mapachito captures; Chicken Stockfish reacts.")
    expect(markup).toContain('aria-label="Mapachito: capture attacker"')
    expect(markup).toContain('aria-label="Chicken Stockfish: capture victim"')
    expect(markup).toContain(
      "/generated/presentation-assets/coach/wow_great.png",
    )
    expect(markup).toContain("Mapachito coach")
    expect(markup).toContain("Wow Great")
    expect(markup).not.toContain("animation-name")
    expect(markup).toContain("background-image:url(")
    expect(markup).not.toContain(">M</span>")
    expect(markup).not.toContain(">C</span>")
    expect(markup).not.toContain("Artwork unavailable")
    actor.stop()
  })

  it.each([
    {
      announcement: "Mapachito and Bunny Stockfish are ready.",
      description: "idle readiness",
      phase: null,
    },
    {
      announcement: "Mapachito captures; Bunny Stockfish reacts.",
      description: "the opponent's capture reaction",
      phase: PLAYER_CAPTURE_PHASE,
    },
    {
      announcement: "Bunny Stockfish gives check; Mapachito reacts.",
      description: "the opponent's check",
      phase: {
        kind: "check",
        opponent: { family: "check", role: "attacker" },
        player: { family: "check", role: "victim" },
      },
    },
    {
      announcement: "Bunny Stockfish wins the chess battle.",
      description: "the opponent's victory",
      phase: {
        kind: "conclusion",
        opponent: { family: "victory" },
        player: { family: "defeat" },
      },
    },
  ] as const satisfies readonly Readonly<{
    announcement: string
    description: string
    phase: MatchPresentationPhase | null
  }>[])(
    "uses the selected opponent for $description",
    ({ announcement, phase }) => {
      const actor = createActor(matchPresentationMachine, {
        input: { initialConclusionPhase: null },
      }).start()
      if (phase !== null) {
        actor.send({
          phases: Object.freeze([phase]),
          type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
        })
      }
      const markup = renderToStaticMarkup(
        createElement(ReactiveBattleStage, {
          onParticipantAnimationCompleted: vi.fn(),
          opponentName: stockfishOpponent("bunny-stockfish").displayName,
          opponentPresentation: {
            kind: "authored-fallback",
            reactionSlot: matchSpriteReactionSlot(
              phase?.opponent ?? { family: "idle" },
            ),
          },
          presentationSnapshot: actor.getSnapshot(),
        }),
      )

      expect(markup).toContain(announcement)
      expect(markup).toContain(">B</span>")
      expect(markup).not.toContain("Chicken Stockfish")
      expect(markup).not.toContain(
        "/generated/presentation-assets/battle/chicken/",
      )
      actor.stop()
    },
  )
})
