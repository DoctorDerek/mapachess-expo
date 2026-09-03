import { assign, fromPromise, setup, type SnapshotFrom } from "xstate"
import type { PositionEvaluation } from "./positionEvaluation.js"
import type {
  PositionEvaluationRequest,
  PositionEvaluationResult,
  PositionEvaluator,
} from "./positionEvaluator.js"

export type PositionEvaluationFailure = Readonly<{
  requestId: string
  type: "EVALUATION.REQUEST_FAILED" | "EVALUATION.RESPONSE_STALE"
}>

export type PositionEvaluationMachineEvent =
  | Readonly<{
      request: PositionEvaluationRequest
      type: "EVALUATION.POSITION_REQUESTED"
    }>
  | Readonly<{ type: "EVALUATION.RETRY_REQUESTED" }>

export type PositionEvaluationMachineInput = Readonly<{
  evaluator: PositionEvaluator
}>

export type PositionEvaluationMachineContext = Readonly<{
  evaluator: PositionEvaluator
  failure: PositionEvaluationFailure | null
  pendingRequest: PositionEvaluationRequest | null
  queuedRequest: PositionEvaluationRequest | null
  result: PositionEvaluationResult | null
}>

type EvaluationActorInput = Readonly<{
  evaluator: PositionEvaluator
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
    >(({ input, signal }) => input.evaluator(input.request, signal)),
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
      }
    }),
    acceptResult: assign((_, result: PositionEvaluationResult) => ({
      failure: null,
      pendingRequest: null,
      queuedRequest: null,
      result,
    })),
    advanceQueuedRequest: assign(({ context }) => ({
      failure: null,
      pendingRequest: requireQueuedRequest(context),
      queuedRequest: null,
    })),
    clearFailure: assign({ failure: null }),
    markRequestFailed: assign(({ context }) => ({
      failure: Object.freeze({
        requestId: requirePendingRequest(context).requestId,
        type: "EVALUATION.REQUEST_FAILED" as const,
      }),
      result: null,
    })),
    markResponseStale: assign(({ context }) => ({
      failure: Object.freeze({
        requestId: requirePendingRequest(context).requestId,
        type: "EVALUATION.RESPONSE_STALE" as const,
      }),
      result: null,
    })),
    queueRequest: assign(({ event }) => {
      if (event.type !== "EVALUATION.POSITION_REQUESTED") {
        throw new Error("Evaluation queue action received another event.")
      }
      return { queuedRequest: event.request }
    }),
  },
  guards: {
    hasQueuedRequest: ({ context }) => context.queuedRequest !== null,
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
        input: ({ context }) => ({
          evaluator: context.evaluator,
          request: requirePendingRequest(context),
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
            actions: "markRequestFailed",
            target: "failure",
          },
        ],
      },
      on: {
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
