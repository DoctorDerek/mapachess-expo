import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import {
  applyMatchMove,
  listLegalMatchMoves,
} from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import positionEvaluationMachine, {
  selectPositionEvaluation,
  selectPositionEvaluationFailure,
  selectPositionEvaluationStage,
} from "../src/positionEvaluationMachine"
import type {
  PositionEvaluationRequest,
  PositionEvaluationResult,
  PositionEvaluator,
} from "../src/positionEvaluator"

type Deferred<Value> = Readonly<{
  promise: Promise<Value>
  reject: (error: unknown) => void
  resolve: (value: Value) => void
}>

const deferred = <Value>(): Deferred<Value> => {
  let rejectPromise: (error: unknown) => void = () => undefined
  let resolvePromise: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((resolve, reject) => {
    rejectPromise = reject
    resolvePromise = resolve
  })
  return { promise, reject: rejectPromise, resolve: resolvePromise }
}

const position = createInitialMatchPosition({
  chess960PositionId: null,
  variant: "standard",
})

const request = (
  requestId: string,
  requestedPosition = position,
): PositionEvaluationRequest =>
  Object.freeze({ position: requestedPosition, requestId })

const result = (
  source: PositionEvaluationRequest,
  whiteCentipawns: number,
): PositionEvaluationResult =>
  Object.freeze({
    evaluation: Object.freeze({
      bound: "exact",
      kind: "centipawns",
      whiteCentipawns,
    }),
    positionFen: source.position.fen,
    requestId: source.requestId,
  })

const startActor = (evaluator: PositionEvaluator) =>
  createActor(positionEvaluationMachine, { input: { evaluator } }).start()

describe("position evaluation lifecycle", () => {
  it("moves from idle through analysis to an accepted result", async () => {
    const evaluator: PositionEvaluator = async (received) =>
      result(received, 18)
    const actor = startActor(evaluator)
    expect(selectPositionEvaluationStage(actor.getSnapshot())).toBe("idle")

    actor.send({
      request: request("evaluation/initial"),
      type: "EVALUATION.POSITION_REQUESTED",
    })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))

    expect(selectPositionEvaluationStage(actor.getSnapshot())).toBe("ready")
    expect(selectPositionEvaluation(actor.getSnapshot())).toEqual({
      bound: "exact",
      kind: "centipawns",
      whiteCentipawns: 18,
    })
    expect(selectPositionEvaluationFailure(actor.getSnapshot())).toBeNull()
    actor.stop()
  })

  it("waits for an active serialized search before evaluating the latest position", async () => {
    const attempts: Array<{
      deferredResult: Deferred<PositionEvaluationResult>
      request: PositionEvaluationRequest
      signal: AbortSignal
    }> = []
    let searchActive = false
    const evaluator: PositionEvaluator = (received, signal) => {
      if (searchActive) {
        return Promise.reject(
          new Error("A serialized evaluation session cannot overlap searches."),
        )
      }

      searchActive = true
      const deferredResult = deferred<PositionEvaluationResult>()
      attempts.push({ deferredResult, request: received, signal })
      return deferredResult.promise.finally(() => {
        searchActive = false
      })
    }
    const actor = startActor(evaluator)
    const first = request("evaluation/first")
    const second = request("evaluation/second")

    actor.send({ request: first, type: "EVALUATION.POSITION_REQUESTED" })
    await waitFor(actor, () => attempts.length === 1)
    actor.send({ request: second, type: "EVALUATION.POSITION_REQUESTED" })
    await Promise.resolve()

    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.signal.aborted).toBe(false)
    attempts[0]?.deferredResult.resolve(result(first, 99))
    await waitFor(actor, () => attempts.length === 2)
    attempts[1]?.deferredResult.resolve(result(second, -27))
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))

    expect(selectPositionEvaluation(actor.getSnapshot())).toMatchObject({
      whiteCentipawns: -27,
    })
    actor.stop()
  })

  it("retains an accepted score while a replacement position analyzes", async () => {
    const replacement = deferred<PositionEvaluationResult>()
    const e4 = listLegalMatchMoves(position).find(({ uci }) => uci === "e2e4")
    if (e4 === undefined) throw new Error("Test position must permit e2e4.")
    const applied = applyMatchMove(position, e4.id)
    if (!applied.ok) throw new Error("Test e2e4 must apply.")
    const first = request("evaluation/accepted")
    const second = request("evaluation/replacement", applied.transition.after)
    const evaluator: PositionEvaluator = (received) =>
      received.requestId === first.requestId
        ? Promise.resolve(result(first, 31))
        : replacement.promise
    const actor = startActor(evaluator)

    actor.send({ request: first, type: "EVALUATION.POSITION_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    actor.send({ request: second, type: "EVALUATION.POSITION_REQUESTED" })

    expect(selectPositionEvaluationStage(actor.getSnapshot())).toBe("analyzing")
    expect(selectPositionEvaluation(actor.getSnapshot())).toMatchObject({
      whiteCentipawns: 31,
    })

    replacement.resolve(result(second, -14))
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(selectPositionEvaluation(actor.getSnapshot())).toMatchObject({
      whiteCentipawns: -14,
    })
    actor.stop()
  })

  it("rejects an evaluator result for another request identity", async () => {
    const evaluator: PositionEvaluator = async (received) =>
      Object.freeze({
        ...result(received, 12),
        requestId: "evaluation/stale",
      })
    const actor = startActor(evaluator)
    actor.send({
      request: request("evaluation/current"),
      type: "EVALUATION.POSITION_REQUESTED",
    })
    await waitFor(actor, (snapshot) => snapshot.matches("failure"))

    expect(selectPositionEvaluation(actor.getSnapshot())).toBeNull()
    expect(selectPositionEvaluationFailure(actor.getSnapshot())).toEqual({
      requestId: "evaluation/current",
      type: "EVALUATION.RESPONSE_STALE",
    })
    actor.stop()
  })

  it("rejects an evaluator result for another position identity", async () => {
    const evaluator: PositionEvaluator = async (received) =>
      Object.freeze({
        ...result(received, 12),
        positionFen: "stale-position-fen",
      })
    const actor = startActor(evaluator)
    actor.send({
      request: request("evaluation/current-position"),
      type: "EVALUATION.POSITION_REQUESTED",
    })
    await waitFor(actor, (snapshot) => snapshot.matches("failure"))

    expect(selectPositionEvaluationFailure(actor.getSnapshot())).toEqual({
      requestId: "evaluation/current-position",
      type: "EVALUATION.RESPONSE_STALE",
    })
    actor.stop()
  })

  it("retains a failed request and retries it deterministically", async () => {
    const receivedRequestIds: string[] = []
    const evaluator: PositionEvaluator = async (received) => {
      receivedRequestIds.push(received.requestId)
      if (receivedRequestIds.length === 1) {
        throw new Error("scripted engine failure")
      }
      return result(received, 7)
    }
    const actor = startActor(evaluator)
    actor.send({
      request: request("evaluation/retry"),
      type: "EVALUATION.POSITION_REQUESTED",
    })
    await waitFor(actor, (snapshot) => snapshot.matches("failure"))

    expect(selectPositionEvaluationFailure(actor.getSnapshot())).toEqual({
      requestId: "evaluation/retry",
      type: "EVALUATION.REQUEST_FAILED",
    })
    actor.send({ type: "EVALUATION.RETRY_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))

    expect(receivedRequestIds).toEqual(["evaluation/retry", "evaluation/retry"])
    expect(selectPositionEvaluation(actor.getSnapshot())).toMatchObject({
      whiteCentipawns: 7,
    })
    actor.stop()
  })
})
