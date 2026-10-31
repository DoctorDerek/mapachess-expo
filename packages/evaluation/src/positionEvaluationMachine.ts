import { assign, fromPromise, setup, type SnapshotFrom } from "xstate"
import captureError, {
  type ErrorDiagnostic,
} from "@mapachess/diagnostics/error-diagnostic"
import type { PositionEvaluation } from "./positionEvaluation.js"
import type {
  PositionEvaluationRefinement,
  PositionEvaluationRefinementListener,
  PositionEvaluationRequest,
  PositionEvaluationResult,
  PositionEvaluator,
} from "./positionEvaluator.js"

export type PositionEvaluationFailure =
  | Readonly<{ requestId: string; type: "EVALUATION.RESPONSE_STALE" }>
  | Readonly<{
      requestId: string
      type: "EVALUATION.REQUEST_FAILED"
      diagnostic: ErrorDiagnostic
    }>

export type PositionEvaluationMachineEvent =
  | Readonly<{
      request: PositionEvaluationRequest
      type: "EVALUATION.POSITION_REQUESTED"
    }>
  | Readonly<{ type: "EVALUATION.RETRY_REQUESTED" }>
  | Readonly<{
      refinement: PositionEvaluationRefinement
      type: "EVALUATION.REFINEMENT_RECEIVED"
    }>

export type PositionEvaluationMachineInput = Readonly<{
  evaluator: PositionEvaluator
}>

export type PositionEvaluationMachineContext = Readonly<{
  evaluator: PositionEvaluator
  failure: PositionEvaluationFailure | null
  pendingRequest: PositionEvaluationRequest | null
  queuedRequest: PositionEvaluationRequest | null
  refinement: PositionEvaluationRefinement | null
  remainingRequests: readonly PositionEvaluationRequest[]
  result: PositionEvaluationResult | null
}>

type EvaluationActorInput = Readonly<{
  evaluator: PositionEvaluator
  onRefinement: PositionEvaluationRefinementListener
  request: PositionEvaluationRequest
}>

const requirePendingRequest = (
  context: PositionEvaluationMachineContext,
): PositionEvaluationRequest => {
  if (context.pendingRequest === null) {
    throw new Error("Position evaluation requires a pending request.")
  }
  return context.pendingRequest
}

const requireQueuedRequest = (
  context: PositionEvaluationMachineContext,
): PositionEvaluationRequest => {
  if (context.queuedRequest === null) {
    throw new Error("Position evaluation requires a queued request.")
  }
  return context.queuedRequest
}

const positionEvaluationMachineDefinition = setup({
  types: {
    context: {} as PositionEvaluationMachineContext,
    events: {} as PositionEvaluationMachineEvent,
    input: {} as PositionEvaluationMachineInput,
  },
  actors: {
    evaluatePosition: fromPromise<
      PositionEvaluationResult,
      EvaluationActorInput
    >(async ({ input, signal }) => {
      let active = true
      try {
        return await input.evaluator(input.request, signal, (refinement) => {
          if (active && !signal.aborted) input.onRefinement(refinement)
        })
      } finally {
        active = false
      }
    }),
  },
  actions: {
    captureRequest: assign(({ event }) => {
      if (event.type !== "EVALUATION.POSITION_REQUESTED") {
        throw new Error("Evaluation request action received another event.")
      }
      return {
        failure: null,
        pendingRequest: event.request,
        queuedRequest: null,
        refinement: null,
        remainingRequests: [],
      }
    }),
    acceptResult: assign((_, result: PositionEvaluationResult) => ({
      failure: null,
      pendingRequest: null,
      queuedRequest: null,
      refinement: null,
      remainingRequests: [],
      result,
    })),
    advanceQueuedRequest: assign(({ context }) => ({
      failure: null,
      pendingRequest: requireQueuedRequest(context),
      queuedRequest: context.remainingRequests[0] ?? null,
      refinement: null,
      remainingRequests: context.remainingRequests.slice(1),
    })),
    clearFailure: assign({ failure: null, refinement: null }),
    acceptRefinement: assign((_, refinement: PositionEvaluationRefinement) => ({
      refinement,
    })),
    markRequestFailed: assign(
      ({ context }, { error }: Readonly<{ error: unknown }>) => ({
        failure: Object.freeze({
          diagnostic: captureError(error),
          requestId: requirePendingRequest(context).requestId,
          type: "EVALUATION.REQUEST_FAILED" as const,
        }),
        result: null,
        refinement: null,
      }),
    ),
    markResponseStale: assign(({ context }) => ({
      failure: Object.freeze({
        requestId: requirePendingRequest(context).requestId,
        type: "EVALUATION.RESPONSE_STALE" as const,
      }),
      result: null,
      refinement: null,
    })),
    queueRequest: assign(({ context, event }) => {
      if (event.type !== "EVALUATION.POSITION_REQUESTED") {
        throw new Error("Evaluation queue action received another event.")
      }
      return {
        refinement: null,
        ...(context.queuedRequest === null
          ? { queuedRequest: event.request }
          : {
              remainingRequests: [...context.remainingRequests, event.request],
            }),
      }
    }),
  },
  guards: {
    hasQueuedRequest: ({ context }) => context.queuedRequest !== null,
    refinementMatchesCurrentRequest: (
      { context },
      refinement: PositionEvaluationRefinement,
    ) =>
      context.queuedRequest === null &&
      context.pendingRequest?.requestId === refinement.requestId &&
      context.pendingRequest.position.fen === refinement.positionFen,
    responseMatchesPendingRequest: (
      { context },
      result: PositionEvaluationResult,
    ) => {
      const request = requirePendingRequest(context)
      return (
        result.requestId === request.requestId &&
        result.positionFen === request.position.fen
      )
    },
  },
}).createMachine({
  id: "positionEvaluation",
  initial: "idle",
  context: ({ input }) => ({
    evaluator: input.evaluator,
    failure: null,
    pendingRequest: null,
    queuedRequest: null,
    refinement: null,
    remainingRequests: [],
    result: null,
  }),
  states: {
    idle: {
      on: {
        "EVALUATION.POSITION_REQUESTED": {
          actions: "captureRequest",
          target: "analyzing",
        },
      },
    },
    analyzing: {
      entry: "clearFailure",
      invoke: {
        id: "positionEvaluation.evaluatePosition",
        src: "evaluatePosition",
        input: ({ context, self }) => ({
          evaluator: context.evaluator,
          request: requirePendingRequest(context),
          onRefinement: (refinement) =>
            self.send({ type: "EVALUATION.REFINEMENT_RECEIVED", refinement }),
        }),
        onDone: [
          {
            actions: "advanceQueuedRequest",
            guard: "hasQueuedRequest",
            reenter: true,
            target: "analyzing",
          },
          {
            actions: {
              type: "acceptResult",
              params: ({ event }) => event.output,
            },
            guard: {
              type: "responseMatchesPendingRequest",
              params: ({ event }) => event.output,
            },
            target: "ready",
          },
          {
            actions: "markResponseStale",
            target: "failure",
          },
        ],
        onError: [
          {
            actions: "advanceQueuedRequest",
            guard: "hasQueuedRequest",
            reenter: true,
            target: "analyzing",
          },
          {
            actions: {
              type: "markRequestFailed",
              params: ({ event }) => ({ error: event.error }),
            },
            target: "failure",
          },
        ],
      },
      on: {
        "EVALUATION.REFINEMENT_RECEIVED": {
          actions: {
            type: "acceptRefinement",
            params: ({ event }) => event.refinement,
          },
          guard: {
            type: "refinementMatchesCurrentRequest",
            params: ({ event }) => event.refinement,
          },
        },
        "EVALUATION.POSITION_REQUESTED": {
          actions: "queueRequest",
        },
      },
    },
    ready: {
      on: {
        "EVALUATION.POSITION_REQUESTED": {
          actions: "captureRequest",
          target: "analyzing",
        },
      },
    },
    failure: {
      on: {
        "EVALUATION.POSITION_REQUESTED": {
          actions: "captureRequest",
          target: "analyzing",
        },
        "EVALUATION.RETRY_REQUESTED": {
          target: "analyzing",
        },
      },
    },
  },
})

export type PositionEvaluationMachineSnapshot = SnapshotFrom<
  typeof positionEvaluationMachineDefinition
>

export type PositionEvaluationStage = "idle" | "analyzing" | "ready" | "failure"

export const selectPositionEvaluation = (
  snapshot: PositionEvaluationMachineSnapshot,
): PositionEvaluation | null => snapshot.context.result?.evaluation ?? null

export const selectLivePositionEvaluation = (
  snapshot: PositionEvaluationMachineSnapshot,
): PositionEvaluation | null =>
  snapshot.context.refinement?.evaluation ?? selectPositionEvaluation(snapshot)

export const selectPositionEvaluationFailure = (
  snapshot: PositionEvaluationMachineSnapshot,
): PositionEvaluationFailure | null => snapshot.context.failure

export const selectPositionEvaluationStage = (
  snapshot: PositionEvaluationMachineSnapshot,
): PositionEvaluationStage =>
  snapshot.matches("analyzing")
    ? "analyzing"
    : snapshot.matches("ready")
      ? "ready"
      : snapshot.matches("failure")
        ? "failure"
        : "idle"

export default positionEvaluationMachineDefinition
