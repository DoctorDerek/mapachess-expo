import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import type {
  PositionEvaluationRequest,
  PositionEvaluationResult,
  PositionEvaluator,
} from "@mapachess/evaluation/position-evaluator"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import PositionEvaluationGutter from "./PositionEvaluationGutter"

const position = createInitialMatchPosition({
  chess960PositionId: null,
  variant: "standard",
})

const request: PositionEvaluationRequest = Object.freeze({
  position,
  requestId: "evaluation/gutter",
})

const result = (
  evaluation: PositionEvaluationResult["evaluation"],
): PositionEvaluationResult =>
  Object.freeze({
    evaluation,
    positionFen: position.fen,
    requestId: request.requestId,
  })

const startActor = (evaluator: PositionEvaluator) =>
  createActor(positionEvaluationMachine, { input: { evaluator } }).start()

const renderGutter = (actor: ReturnType<typeof startActor>): string =>
  renderToStaticMarkup(
    createElement(PositionEvaluationGutter, {
      actor,
    }),
  )

describe("position evaluation gutter", () => {
  it("renders current evaluation without owning transient reactions", async () => {
    const actor = startActor(async () =>
      result({ kind: "centipawns", bound: "exact", whiteCentipawns: -250 }),
    )
    actor.send({ request, type: "EVALUATION.POSITION_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    const markup = renderToStaticMarkup(
      createElement(PositionEvaluationGutter, {
        actor,
      }),
    )
    expect(markup).toContain("White-relative evaluation −2.50")
    expect(markup).toContain(">−2.50</span>")
    expect(markup).not.toContain("Waiting:")
    expect(markup).not.toContain("Qh5")
    expect(markup).not.toContain("Lost forced mate")
    expect(markup.match(/role="meter"/g)).toHaveLength(1)
    expect(markup).not.toContain("<button")
    actor.stop()
  })

  it("reserves one responsive meter before analysis begins", () => {
    const actor = startActor(async () => result({ kind: "draw" }))
    const markup = renderGutter(actor)

    expect(markup).toContain('role="meter"')
    expect(markup).toContain('aria-label="Stockfish evaluation"')
    expect(markup).toContain('aria-valuetext="Evaluation waiting"')
    expect(markup).toContain("min-h-10 w-full")
    expect(markup).not.toContain("xl:h-full")
    expect(markup).not.toContain("writing-mode")
    actor.stop()
  })

  it("renders an accepted exact score as text and white share", async () => {
    const actor = startActor(async () =>
      result({
        bound: "exact",
        kind: "centipawns",
        whiteCentipawns: 125,
      }),
    )
    actor.send({ request, type: "EVALUATION.POSITION_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    const markup = renderGutter(actor)

    expect(markup).toContain('aria-valuenow="56"')
    expect(markup).toContain('aria-valuetext="White-relative evaluation +1.25"')
    expect(markup).toContain('style="--white-share:56.25%"')
    actor.stop()
  })

  it("states bounded and mate evaluations without relying on color", async () => {
    const boundedActor = startActor(async () =>
      result({
        bound: "upper",
        kind: "centipawns",
        whiteCentipawns: -75,
      }),
    )
    boundedActor.send({ request, type: "EVALUATION.POSITION_REQUESTED" })
    await waitFor(boundedActor, (snapshot) => snapshot.matches("ready"))
    expect(renderGutter(boundedActor)).toContain(
      'aria-valuetext="White-relative evaluation ≤ −0.75"',
    )
    boundedActor.stop()

    const mateActor = startActor(async () =>
      result({ bound: "exact", kind: "mate", moves: 3, winner: "black" }),
    )
    mateActor.send({ request, type: "EVALUATION.POSITION_REQUESTED" })
    await waitFor(mateActor, (snapshot) => snapshot.matches("ready"))
    const mateMarkup = renderGutter(mateActor)
    expect(mateMarkup).toContain('aria-valuenow="0"')
    expect(mateMarkup).toContain('aria-valuetext="Black M3"')
    mateActor.stop()
  })

  it("surfaces analysis failure without exposing an engine error", async () => {
    const actor = startActor(async () => {
      throw new Error("private engine failure detail")
    })
    actor.send({ request, type: "EVALUATION.POSITION_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("failure"))
    const markup = renderGutter(actor)

    expect(markup).toContain('aria-valuetext="Evaluation unavailable"')
    expect(markup).not.toContain("private engine failure detail")
    actor.stop()
  })
})
