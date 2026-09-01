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

const requestTransition = {
  actions: "captureRequest",
  target: "analyzing",
} as const

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
      }
    }),
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
  },
}).createMachine({
  id: "positionEvaluation",
  initial: "idle",
  context: ({ input }) => ({
    evaluator: input.evaluator,
    failure: null,
    pendingRequest: null,
    result: null,
  }),
  states: {
    idle: {
      on: {
        "EVALUATION.POSITION_REQUESTED": requestTransition,
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
            actions: assign(({ event }) => ({
              failure: null,
              pendingRequest: null,
              result: event.output,
            })),
            guard: ({ context, event }) => {
              const request = requirePendingRequest(context)
              return (
                event.output.requestId === request.requestId &&
                event.output.positionFen === request.position.fen
              )
            },
            target: "ready",
          },
          {
            actions: "markResponseStale",
            target: "failure",
          },
        ],
        onError: {
          actions: "markRequestFailed",
          target: "failure",
        },
      },
      on: {
        "EVALUATION.POSITION_REQUESTED": {
          ...requestTransition,
          reenter: true,
        },
      },
    },
    ready: {
      on: {
        "EVALUATION.POSITION_REQUESTED": requestTransition,
      },
    },
    failure: {
      on: {
        "EVALUATION.POSITION_REQUESTED": requestTransition,
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
