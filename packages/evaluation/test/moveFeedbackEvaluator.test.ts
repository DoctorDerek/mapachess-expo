import { describe, expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
} from "@mapachess/match/match-timeline"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import createMoveFeedbackEvaluator from "../src/moveFeedbackEvaluator.js"
import positionEvaluationMachine from "../src/positionEvaluationMachine.js"
import type {
  PositionEvaluationResult,
  PositionEvaluator,
} from "../src/positionEvaluator.js"

const initial = createInitialMatchPosition({
  variant: "standard",
  chess960PositionId: null,
})
const advance = (
  timeline: ReturnType<typeof createMatchTimeline>,
  uci: string,
) => {
  const position =
    timeline.transitions.at(-1)?.after ?? timeline.initialPosition
  const move = listLegalMatchMoves(position).find(
    (candidate) => candidate.uci === uci,
  )
  if (!move) throw new Error("Missing move")
  const result = applyMatchTimelineMove(timeline, move.id)
  if (!result.ok) throw new Error("Expected move")
  return result.timeline
}

describe("move feedback search integration", () => {
  it("forwards provisional scores without caching or persisting them as move grades", async () => {
    const timeline = advance(createMatchTimeline(initial), "e2e4")
    const after = timeline.transitions[0]!.after
    const pending = Promise.withResolvers<PositionEvaluationResult>()
    const records: MoveFeedbackRecord[] = []
    const publish = vi.fn()
    const evaluator = createMoveFeedbackEvaluator({
      matchId: "refinement/feedback",
      timeline: () => timeline,
      records: () => records,
      persist: async (record) => {
        records.push(record)
        return true
      },
      evaluate: async (request, _signal, onRefinement) => {
        onRefinement?.({
          requestId: request.requestId,
          positionFen: request.position.fen,
          evaluation: {
            kind: "centipawns",
            bound: "exact",
            whiteCentipawns: 999,
          },
        })
        if (request.position.fen === initial.fen) {
          return {
            requestId: request.requestId,
            positionFen: initial.fen,
            bestMove: "e2e4",
            evaluation: {
              kind: "centipawns",
              bound: "exact",
              whiteCentipawns: 0,
            },
          }
        }
        return pending.promise
      },
    })
    await evaluator(
      { requestId: "before", position: initial },
      new AbortController().signal,
      publish,
    )
    const completion = evaluator(
      { requestId: "after", position: after },
      new AbortController().signal,
      publish,
    )
    expect(publish).toHaveBeenCalledTimes(2)
    expect(records).toEqual([])
    pending.resolve({
      requestId: "after",
      positionFen: after.fen,
      evaluation: { kind: "centipawns", bound: "exact", whiteCentipawns: 15 },
    })
    await completion
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      before: { whiteCentipawns: 0 },
      after: { whiteCentipawns: 15 },
    })
  })

  it("retains both fast plies and uses only one existing-budget search per requested position", async () => {
    let timeline = createMatchTimeline(initial)
    const records: MoveFeedbackRecord[] = []
    const searched: string[] = []
    const evaluate: PositionEvaluator = async (request) => {
      searched.push(request.position.fen)
      return {
        requestId: request.requestId,
        positionFen: request.position.fen,
        bestMove: request.position.turn === "white" ? "e2e4" : "e7e5",
        evaluation: { kind: "centipawns", bound: "exact", whiteCentipawns: 0 },
      }
    }
    const evaluator = createMoveFeedbackEvaluator({
      matchId: "test",
      evaluate,
      timeline: () => timeline,
      records: () => records,
      persist: async (record) => {
        records.push(record)
        return true
      },
    })
    const actor = createActor(positionEvaluationMachine, {
      input: { evaluator },
    }).start()
    actor.send({
      type: "EVALUATION.POSITION_REQUESTED",
      request: { position: initial, requestId: "initial" },
    })
    timeline = advance(timeline, "e2e4")
    const first = timeline.transitions[0]!
    actor.send({
      type: "EVALUATION.POSITION_REQUESTED",
      request: { position: first.after, requestId: "first" },
    })
    timeline = advance(timeline, "e7e5")
    const second = timeline.transitions[1]!
    actor.send({
      type: "EVALUATION.POSITION_REQUESTED",
      request: { position: second.after, requestId: "second" },
    })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(searched).toEqual([initial.fen, first.after.fen, second.after.fen])
    expect(
      records.map(({ ply, mover, grade }) => ({ ply, mover, grade })),
    ).toEqual([
      { ply: 1, mover: "white", grade: "best" },
      { ply: 2, mover: "black", grade: "best" },
    ])
    expect(records[0]?.afterFen).toBe(first.after.fen)
    expect(records[1]?.beforeFen).toBe(first.after.fen)
    await evaluator(
      { position: second.after, requestId: "redo" },
      new AbortController().signal,
    )
    expect(records).toHaveLength(2)
    actor.stop()
  })

  it("rejects stale and aborted evaluations before persistence", async () => {
    let writes = 0
    const input = {
      matchId: "test",
      timeline: () => createMatchTimeline(initial),
      records: () => [],
      persist: async () => {
        writes += 1
        return true
      },
    }
    const evaluator = createMoveFeedbackEvaluator({
      ...input,
      evaluate: async () => ({
        requestId: "wrong",
        positionFen: initial.fen,
        evaluation: { kind: "draw" },
      }),
    })
    await expect(
      evaluator(
        { position: initial, requestId: "right" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("stale")
    const cancelled = new AbortController()
    cancelled.abort()
    await expect(
      evaluator({ position: initial, requestId: "right" }, cancelled.signal),
    ).rejects.toThrow("aborted")
    expect(writes).toBe(0)
  })
})
