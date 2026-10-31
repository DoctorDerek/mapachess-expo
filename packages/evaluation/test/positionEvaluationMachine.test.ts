import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import {
  applyMatchMove,
  listLegalMatchMoves,
} from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import decideChickenDrawOffer from "../src/chickenDrawDecision"
import positionEvaluationMachine, {
  selectLivePositionEvaluation,
  selectPositionEvaluation,
  selectPositionEvaluationFailure,
  selectPositionEvaluationStage,
} from "../src/positionEvaluationMachine"
import type {
  PositionEvaluationRefinementListener,
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
  it("publishes live refinements without completing or replacing the final result", async () => {
    const pending = deferred<PositionEvaluationResult>()
    const requested = request("evaluation/refining")
    let publish: PositionEvaluationRefinementListener | undefined
    const actor = startActor((_request, _signal, onRefinement) => {
      publish = onRefinement
      return pending.promise
    })
    actor.send({ request: requested, type: "EVALUATION.POSITION_REQUESTED" })
    publish?.({ ...result(requested, 80), depth: 4 })

    expect(actor.getSnapshot().matches("analyzing")).toBe(true)
    expect(actor.getSnapshot().context.refinement?.depth).toBe(4)
    expect(selectLivePositionEvaluation(actor.getSnapshot())).toMatchObject({
      whiteCentipawns: 80,
    })
    expect(selectPositionEvaluation(actor.getSnapshot())).toBeNull()
    expect(actor.getSnapshot().context.result).toBeNull()
    expect(
      decideChickenDrawOffer({
        evaluationResult: actor.getSnapshot().context.result,
        playerColor: "white",
        positionFen: requested.position.fen,
      }),
    ).toBeNull()

    pending.resolve(result(requested, 35))
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(actor.getSnapshot().context.refinement).toBeNull()
    expect(selectLivePositionEvaluation(actor.getSnapshot())).toMatchObject({
      whiteCentipawns: 35,
    })
    actor.stop()
  })

  it("rejects mismatched and superseded refinements while preserving the final-result queue", async () => {
    const attempts: Array<{
      request: PositionEvaluationRequest
      publish: PositionEvaluationRefinementListener | undefined
      pending: Deferred<PositionEvaluationResult>
    }> = []
    const actor = startActor((received, _signal, publish) => {
      const pending = deferred<PositionEvaluationResult>()
      attempts.push({ request: received, publish, pending })
      return pending.promise
    })
    const first = request("evaluation/first-live")
    const second = request("evaluation/second-live")
    actor.send({ request: first, type: "EVALUATION.POSITION_REQUESTED" })
    const firstAttempt = attempts[0]!
    firstAttempt.publish?.(result(second, 900))
    firstAttempt.publish?.({ ...result(first, 900), positionFen: "wrong-fen" })
    expect(selectLivePositionEvaluation(actor.getSnapshot())).toBeNull()
    firstAttempt.publish?.(result(first, 25))
    expect(selectLivePositionEvaluation(actor.getSnapshot())).toMatchObject({
      whiteCentipawns: 25,
    })
    actor.send({ request: second, type: "EVALUATION.POSITION_REQUESTED" })
    firstAttempt.publish?.(result(first, 900))
    expect(selectLivePositionEvaluation(actor.getSnapshot())).toBeNull()
    expect(attempts).toHaveLength(1)
    firstAttempt.pending.resolve(result(first, 40))
    await waitFor(actor, () => attempts.length === 2)
    const secondAttempt = attempts[1]!
    firstAttempt.publish?.(result(second, 900))
    expect(selectLivePositionEvaluation(actor.getSnapshot())).toBeNull()
    secondAttempt.publish?.(result(second, -15))
    expect(selectLivePositionEvaluation(actor.getSnapshot())).toMatchObject({
      whiteCentipawns: -15,
    })
    expect(actor.getSnapshot().context.result).toBeNull()
    secondAttempt.pending.resolve(result(second, -20))
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(actor.getSnapshot().context.result).toEqual(result(second, -20))
    actor.stop()
  })

  it.each(["completion", "failure"] as const)(
    "rejects a late callback after %s even when retry or Undo reuses request identity",
    async (ending) => {
      const requested = request("evaluation/reused")
      const attempts: Array<{
        publish: PositionEvaluationRefinementListener | undefined
        pending: Deferred<PositionEvaluationResult>
      }> = []
      const actor = startActor((_request, _signal, publish) => {
        const pending = deferred<PositionEvaluationResult>()
        attempts.push({ publish, pending })
        return pending.promise
      })
      actor.send({ request: requested, type: "EVALUATION.POSITION_REQUESTED" })
      const first = attempts[0]!
      first.publish?.(result(requested, 45))
      if (ending === "completion") first.pending.resolve(result(requested, 20))
      else first.pending.reject(new Error("Engine failed after a refinement"))
      await waitFor(actor, (snapshot) => !snapshot.matches("analyzing"))
      expect(actor.getSnapshot().context.refinement).toBeNull()
      if (ending === "completion") {
        actor.send({
          request: requested,
          type: "EVALUATION.POSITION_REQUESTED",
        })
      } else {
        expect(selectLivePositionEvaluation(actor.getSnapshot())).toBeNull()
        actor.send({ type: "EVALUATION.RETRY_REQUESTED" })
      }
      first.publish?.(result(requested, 999))
      expect(actor.getSnapshot().context.refinement).toBeNull()
      const second = attempts[1]!
      second.publish?.(result(requested, 30))
      expect(selectLivePositionEvaluation(actor.getSnapshot())).toMatchObject({
        whiteCentipawns: 30,
      })
      second.pending.resolve(result(requested, 22))
      await waitFor(actor, (snapshot) => snapshot.matches("ready"))
      actor.stop()
    },
  )

  it("stops live callbacks with the actor-owned abort signal", async () => {
    const requested = request("evaluation/disposed")
    const pending = deferred<PositionEvaluationResult>()
    let publish: PositionEvaluationRefinementListener | undefined
    let signal: AbortSignal | undefined
    const actor = startActor((_request, receivedSignal, onRefinement) => {
      signal = receivedSignal
      publish = onRefinement
      return pending.promise
    })
    actor.send({ request: requested, type: "EVALUATION.POSITION_REQUESTED" })
    actor.stop()
    expect(signal?.aborted).toBe(true)
    publish?.(result(requested, 999))
    expect(actor.getSnapshot().context.refinement).toBeNull()
    pending.resolve(result(requested, 25))
    await pending.promise
  })

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

  it("retains queued positions in order and retries the final failed request", async () => {
    const attempts: Array<{
      deferredResult: Deferred<PositionEvaluationResult>
      request: PositionEvaluationRequest
    }> = []
    const evaluator: PositionEvaluator = (received) => {
      const deferredResult = deferred<PositionEvaluationResult>()
      attempts.push({ deferredResult, request: received })
      return deferredResult.promise
    }
    const actor = startActor(evaluator)
    const first = request("evaluation/coalesced-first")
    const skipped = request("evaluation/coalesced-skipped")
    const latest = request("evaluation/coalesced-latest")

    actor.send({ request: first, type: "EVALUATION.POSITION_REQUESTED" })
    await waitFor(actor, () => attempts.length === 1)
    actor.send({ request: skipped, type: "EVALUATION.POSITION_REQUESTED" })
    actor.send({ request: latest, type: "EVALUATION.POSITION_REQUESTED" })
    await Promise.resolve()
    expect(attempts).toHaveLength(1)

    attempts[0]?.deferredResult.reject(new Error("superseded failure"))
    await waitFor(actor, () => attempts.length === 2)
    expect(selectPositionEvaluationFailure(actor.getSnapshot())).toBeNull()
    expect(
      attempts.map(({ request: attempted }) => attempted.requestId),
    ).toEqual([first.requestId, skipped.requestId])

    attempts[1]?.deferredResult.resolve(result(skipped, 20))
    await waitFor(actor, () => attempts.length === 3)
    expect(attempts[2]?.request).toBe(latest)

    const failure = new Error("latest failure")
    attempts[2]?.deferredResult.reject(failure)
    await waitFor(actor, (snapshot) => snapshot.matches("failure"))
    expect(selectPositionEvaluationFailure(actor.getSnapshot())).toEqual({
      requestId: latest.requestId,
      type: "EVALUATION.REQUEST_FAILED",
      diagnostic: { message: failure.message, cause: failure },
    })

    actor.send({ type: "EVALUATION.RETRY_REQUESTED" })
    await waitFor(actor, () => attempts.length === 4)
    expect(attempts[3]?.request).toBe(latest)
    attempts[3]?.deferredResult.resolve(result(latest, 42))
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(selectPositionEvaluation(actor.getSnapshot())).toMatchObject({
      whiteCentipawns: 42,
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
    const failure = { message: "scripted engine failure", code: "IO" }
    const evaluator: PositionEvaluator = async (received) => {
      receivedRequestIds.push(received.requestId)
      if (receivedRequestIds.length === 1) {
        throw failure
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
      diagnostic: { message: failure.message, cause: failure },
    })
    actor.send({ type: "EVALUATION.RETRY_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))

    expect(receivedRequestIds).toEqual(["evaluation/retry", "evaluation/retry"])
    expect(selectPositionEvaluationFailure(actor.getSnapshot())).toBeNull()
    expect(selectPositionEvaluation(actor.getSnapshot())).toMatchObject({
      whiteCentipawns: 7,
    })
    actor.stop()
  })
})
