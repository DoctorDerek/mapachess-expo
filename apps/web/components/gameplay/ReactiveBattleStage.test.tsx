import { createElement, Fragment, type ComponentPropsWithoutRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, describe, expect, it, vi } from "vitest"
import { createActor } from "xstate"
import matchPresentationMachine from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationPhase } from "@mapachess/match-presentation/match-reaction"
import MapachitoCoachPortrait from "./MapachitoCoachPortrait"
import ReactiveBattleStage from "./ReactiveBattleStage"

const previousPresentationAssetMode = vi.hoisted(() => {
  const previousValue = process.env.NEXT_PUBLIC_MAPACHESS_PRESENTATION_ASSETS
  process.env.NEXT_PUBLIC_MAPACHESS_PRESENTATION_ASSETS = "licensed"
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
  if (previousPresentationAssetMode === undefined) {
    delete process.env.NEXT_PUBLIC_MAPACHESS_PRESENTATION_ASSETS
  } else {
    process.env.NEXT_PUBLIC_MAPACHESS_PRESENTATION_ASSETS =
      previousPresentationAssetMode
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
    expect(markup).toContain("/generated/presentation-assets/battle/mapachito/")
    expect(markup).toContain("/generated/presentation-assets/battle/chicken/")
    expect(markup).toContain(
      "/generated/presentation-assets/coach/wow_great.png",
    )
    expect(markup).toContain("Mapachito coach")
    expect(markup).toContain("Wow Great")
    expect(markup).not.toContain("animation-name")
    actor.stop()
  })
})
