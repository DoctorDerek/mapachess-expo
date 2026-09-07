import { createElement, Fragment, type ComponentPropsWithoutRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, describe, expect, it, vi } from "vitest"
import { createActor } from "xstate"
import matchPresentationMachine from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationPhase } from "@mapachess/match-presentation/match-reaction"
import { matchSpriteReactionSlot } from "@mapachess/match-presentation/presentation-asset-manifest"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
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
      expect(markup).not.toContain("Chicken Stockfish")
      expect(markup).not.toContain(
        "/generated/presentation-assets/battle/chicken/",
      )
      actor.stop()
    },
  )
})
