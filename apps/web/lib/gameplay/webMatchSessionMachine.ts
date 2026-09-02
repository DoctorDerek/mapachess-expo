import {
  assign,
  fromPromise,
  setup,
  type ActorRefFrom,
  type SnapshotFrom,
} from "xstate"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import matchMachine from "@mapachess/match/match-machine"
import type { WebMatchRuntime } from "./webMatchRuntime"

export type WebMatchSession = Readonly<{
  actor: ActorRefFrom<typeof matchMachine>
  close: () => Promise<void>
  evaluationActor: ActorRefFrom<typeof positionEvaluationMachine>
  match: DurableMatchRecord
  runtime: WebMatchRuntime
}>

export type WebMatchSessionFailureOperation =
  "open-current-match" | "restart-match" | "return-to-menu" | "start-match"

export type WebMatchSessionFailure = Readonly<{
  cause: unknown
  operation: WebMatchSessionFailureOperation
}>

export type WebMatchSessionOperations = Readonly<{
  openCurrentMatch: (signal: AbortSignal) => Promise<WebMatchSession>
  openFreshMatch: (
    previousSession: WebMatchSession | null,
    signal: AbortSignal,
  ) => Promise<WebMatchSession>
  returnToMenu: (session: WebMatchSession, signal: AbortSignal) => Promise<void>
}>

export type WebMatchSessionMachineInput = Readonly<{
  activeMatchExists: boolean
  operations: WebMatchSessionOperations
}>

type WebMatchSessionMachineContext = Readonly<{
  activeMatchExists: boolean
  failure: WebMatchSessionFailure | null
  operations: WebMatchSessionOperations
  session: WebMatchSession | null
}>

export type WebMatchSessionMachineEvent =
  | Readonly<{ type: "WEB_MATCH_SESSION.MATCH_REQUESTED" }>
  | Readonly<{ type: "WEB_MATCH_SESSION.RESTART_REQUESTED" }>
  | Readonly<{ type: "WEB_MATCH_SESSION.RETRY_REQUESTED" }>
  | Readonly<{ type: "WEB_MATCH_SESSION.RETURN_TO_MENU_REQUESTED" }>

type OpenCurrentMatchInput = Readonly<{
  operations: WebMatchSessionOperations
}>

type OpenFreshMatchInput = Readonly<{
  operations: WebMatchSessionOperations
  previousSession: WebMatchSession | null
}>

type ReturnToMenuInput = Readonly<{
  operations: WebMatchSessionOperations
  session: WebMatchSession
}>

const requireSession = (
  context: WebMatchSessionMachineContext,
): WebMatchSession => {
  if (context.session === null) {
    throw new Error("Active web match session state requires a session.")
  }
  return context.session
}

const failure = (
  operation: WebMatchSessionFailureOperation,
  cause: unknown,
): WebMatchSessionFailure => Object.freeze({ cause, operation })

const webMatchSessionMachineDefinition = setup({
  types: {
    context: {} as WebMatchSessionMachineContext,
    events: {} as WebMatchSessionMachineEvent,
    input: {} as WebMatchSessionMachineInput,
  },
  actors: {
    openCurrentMatch: fromPromise<WebMatchSession, OpenCurrentMatchInput>(
      ({ input, signal }) => input.operations.openCurrentMatch(signal),
    ),
    openFreshMatch: fromPromise<WebMatchSession, OpenFreshMatchInput>(
      ({ input, signal }) =>
        input.operations.openFreshMatch(input.previousSession, signal),
    ),
    returnToMenu: fromPromise<void, ReturnToMenuInput>(({ input, signal }) =>
      input.operations.returnToMenu(input.session, signal),
    ),
  },
  actions: {
    acceptOpenedSession: assign(
      (_, params: Readonly<{ session: WebMatchSession }>) => ({
        failure: null,
        session: params.session,
      }),
    ),
    captureFailure: assign((_, params: WebMatchSessionFailure) => ({
      failure: failure(params.operation, params.cause),
    })),
    clearSession: assign({ failure: null, session: null }),
  },
  guards: {
    activeMatchExists: ({ context }) => context.activeMatchExists,
    failureWasOpenCurrent: ({ context }) =>
      context.failure?.operation === "open-current-match",
    failureWasRestart: ({ context }) =>
      context.failure?.operation === "restart-match",
    failureWasReturnToMenu: ({ context }) =>
      context.failure?.operation === "return-to-menu",
    failureWasStart: ({ context }) =>
      context.failure?.operation === "start-match",
  },
}).createMachine({
  id: "webMatchSession",
  initial: "routing",
  context: ({ input }) => ({
    activeMatchExists: input.activeMatchExists,
    failure: null,
    operations: input.operations,
    session: null,
  }),
  states: {
    routing: {
      always: [
        { guard: "activeMatchExists", target: "openingCurrentMatch" },
        { target: "menu" },
      ],
    },
    menu: {
      on: {
        "WEB_MATCH_SESSION.MATCH_REQUESTED": {
          target: "openingFreshMatch",
        },
      },
    },
    openingCurrentMatch: {
      invoke: {
        id: "webMatchSession.openCurrentMatch",
        src: "openCurrentMatch",
        input: ({ context }) => ({ operations: context.operations }),
        onDone: {
          actions: {
            type: "acceptOpenedSession",
            params: ({ event }) => ({ session: event.output }),
          },
          target: "active",
        },
        onError: {
          actions: {
            type: "captureFailure",
            params: ({ event }) => ({
              cause: event.error,
              operation: "open-current-match" as const,
            }),
          },
          target: "failed",
        },
      },
    },
    openingFreshMatch: {
      invoke: {
        id: "webMatchSession.openFreshMatch",
        src: "openFreshMatch",
        input: ({ context }) => ({
          operations: context.operations,
          previousSession: null,
        }),
        onDone: {
          actions: {
            type: "acceptOpenedSession",
            params: ({ event }) => ({ session: event.output }),
          },
          target: "active",
        },
        onError: {
          actions: {
            type: "captureFailure",
            params: ({ event }) => ({
              cause: event.error,
              operation: "start-match" as const,
            }),
          },
          target: "failed",
        },
      },
    },
    active: {
      on: {
        "WEB_MATCH_SESSION.RESTART_REQUESTED": {
          target: "restartingMatch",
        },
        "WEB_MATCH_SESSION.RETURN_TO_MENU_REQUESTED": {
          target: "returningToMenu",
        },
      },
    },
    restartingMatch: {
      invoke: {
        id: "webMatchSession.restartMatch",
        src: "openFreshMatch",
        input: ({ context }) => ({
          operations: context.operations,
          previousSession: requireSession(context),
        }),
        onDone: {
          actions: {
            type: "acceptOpenedSession",
            params: ({ event }) => ({ session: event.output }),
          },
          target: "active",
        },
        onError: {
          actions: {
            type: "captureFailure",
            params: ({ event }) => ({
              cause: event.error,
              operation: "restart-match" as const,
            }),
          },
          target: "failed",
        },
      },
    },
    returningToMenu: {
      invoke: {
        id: "webMatchSession.returnToMenu",
        src: "returnToMenu",
        input: ({ context }) => ({
          operations: context.operations,
          session: requireSession(context),
        }),
        onDone: {
          actions: "clearSession",
          target: "menu",
        },
        onError: {
          actions: {
            type: "captureFailure",
            params: ({ event }) => ({
              cause: event.error,
              operation: "return-to-menu" as const,
            }),
          },
          target: "failed",
        },
      },
    },
    failed: {
      on: {
        "WEB_MATCH_SESSION.RETRY_REQUESTED": [
          {
            guard: "failureWasOpenCurrent",
            target: "openingCurrentMatch",
          },
          { guard: "failureWasRestart", target: "restartingMatch" },
          { guard: "failureWasReturnToMenu", target: "returningToMenu" },
          { guard: "failureWasStart", target: "openingFreshMatch" },
        ],
      },
    },
  },
})

export type WebMatchSessionMachineSnapshot = SnapshotFrom<
  typeof webMatchSessionMachineDefinition
>

export const selectWebMatchSession = (
  snapshot: WebMatchSessionMachineSnapshot,
): WebMatchSession | null => snapshot.context.session

export const selectWebMatchSessionFailure = (
  snapshot: WebMatchSessionMachineSnapshot,
): WebMatchSessionFailure | null => snapshot.context.failure

export default webMatchSessionMachineDefinition
