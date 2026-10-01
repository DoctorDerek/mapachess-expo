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
import createMatchSetupForMode, {
  type MatchSetup,
} from "@mapachess/match/match-setup"
import type { WebMatchRuntime } from "./webMatchRuntime"
import {
  eligibleWebNavigationOverlays,
  type WebNavigationDestination,
  type WebNavigationOverlay,
  type WebNavigationSetupKey,
} from "./webNavigationDestination"

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
    setup: MatchSetup,
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
  requestedSetup: MatchSetup
  session: WebMatchSession | null
  overlays: readonly WebNavigationOverlay[]
  dismissedRewardMatchId: string | null
  presentedRewardMatchId: string | null
}>

export type WebMatchSessionMachineEvent =
  | Readonly<{
      type: "WEB_MATCH_SESSION.MATCH_REQUESTED"
      setup: MatchSetup
    }>
  | Readonly<{ type: "WEB_MATCH_SESSION.SETUP_REQUESTED"; setup: MatchSetup }>
  | Readonly<{ type: "WEB_MATCH_SESSION.MAIN_MENU_REQUESTED" }>
  | Readonly<{ type: "WEB_MATCH_SESSION.RESTART_REQUESTED" }>
  | Readonly<{ type: "WEB_MATCH_SESSION.RETRY_REQUESTED" }>
  | Readonly<{ type: "WEB_MATCH_SESSION.RETURN_TO_MENU_REQUESTED" }>
  | Readonly<{ type: "WEB_MATCH_SESSION.RESUME_REQUESTED" }>
  | Readonly<{
      type: "WEB_MATCH_SESSION.PROFILE_REPLACED"
      activeMatchExists: boolean
    }>
  | Readonly<{
      type: "WEB_MATCH_SESSION.NAVIGATION_RESTORED"
      destination: WebNavigationDestination
    }>
  | Readonly<{
      type: "WEB_MATCH_SESSION.OVERLAY_OPENED"
      overlay: WebNavigationOverlay
    }>
  | Readonly<{ type: "WEB_MATCH_SESSION.OVERLAY_CLOSED" }>

type OpenCurrentMatchInput = Readonly<{
  operations: WebMatchSessionOperations
}>

type OpenFreshMatchInput = Readonly<{
  operations: WebMatchSessionOperations
  previousSession: WebMatchSession | null
  setup: MatchSetup
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

const setupKey = (
  context: WebMatchSessionMachineContext,
): WebNavigationSetupKey =>
  `${context.requestedSetup.mode}:${context.requestedSetup.mode === "story" ? context.requestedSetup.variant : context.requestedSetup.challengeSetup.variant}`

const ownsDestination = (
  context: WebMatchSessionMachineContext,
  destination: WebNavigationDestination,
): boolean =>
  destination.matchId === (context.session?.match.matchId ?? null) &&
  destination.setupKey === setupKey(context)

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
        input.operations.openFreshMatch(
          input.previousSession,
          input.setup,
          signal,
        ),
    ),
    returnToMenu: fromPromise<void, ReturnToMenuInput>(({ input, signal }) =>
      input.operations.returnToMenu(input.session, signal),
    ),
  },
  actions: {
    rememberRequestedSetup: assign(
      (_, params: Readonly<{ setup: MatchSetup }>) => ({
        requestedSetup: params.setup,
        overlays: [],
      }),
    ),
    acceptOpenedSession: assign(
      (_, params: Readonly<{ session: WebMatchSession }>) => ({
        failure: null,
        requestedSetup: createMatchSetupForMode(
          {
            mode: params.session.match.mode,
            variant: params.session.match.startingPosition.variant,
          },
          {
            ...params.session.match.startingPosition,
            playerColor: params.session.match.playerColor,
            opponentId: params.session.match.opponentId,
            difficultyTargetElo: params.session.runtime.opponentTargetElo,
          },
        ),
        session: params.session,
        overlays: [],
      }),
    ),
    captureFailure: assign((_, params: WebMatchSessionFailure) => ({
      failure: failure(params.operation, params.cause),
    })),
    clearSession: assign({ failure: null, session: null, overlays: [] }),
    openOverlay: assign(({ context, event }) => {
      if (event.type !== "WEB_MATCH_SESSION.OVERLAY_OPENED") return {}
      return {
        overlays: context.overlays.includes(event.overlay)
          ? context.overlays
          : [...context.overlays, event.overlay],
        presentedRewardMatchId:
          event.overlay === "rewards"
            ? requireSession(context).match.matchId
            : context.presentedRewardMatchId,
      }
    }),
    closeOverlay: assign(({ context }) => ({
      overlays: context.overlays.slice(0, -1),
      dismissedRewardMatchId:
        context.overlays.at(-1) === "rewards"
          ? requireSession(context).match.matchId
          : context.dismissedRewardMatchId,
    })),
    restoreNavigation: assign(({ context, event }) => {
      if (event.type !== "WEB_MATCH_SESSION.NAVIGATION_RESTORED") return {}
      const matchId = context.session?.match.matchId ?? null
      const rewardAvailable =
        context.presentedRewardMatchId === matchId &&
        context.dismissedRewardMatchId !== matchId
      const overlays = eligibleWebNavigationOverlays(
        ownsDestination(context, event.destination)
          ? event.destination
          : { ...event.destination, screen: "menu", overlays: [] },
        rewardAvailable,
      )
      return {
        overlays,
        dismissedRewardMatchId:
          context.overlays.includes("rewards") && !overlays.includes("rewards")
            ? matchId
            : context.dismissedRewardMatchId,
      }
    }),
    clearOverlays: assign({ overlays: [] }),
    acceptProfileReplacement: assign(({ event }) =>
      event.type === "WEB_MATCH_SESSION.PROFILE_REPLACED"
        ? {
            activeMatchExists: event.activeMatchExists,
            session: null,
            overlays: [],
            failure: null,
            dismissedRewardMatchId: null,
            presentedRewardMatchId: null,
          }
        : {},
    ),
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
    hasSession: ({ context }) => context.session !== null,
    restoresOwnedMatch: ({ context, event }) =>
      event.type === "WEB_MATCH_SESSION.NAVIGATION_RESTORED" &&
      event.destination.screen === "match" &&
      context.session !== null &&
      context.session.match.matchId === event.destination.matchId,
    restoresSetup: ({ context, event }) =>
      event.type === "WEB_MATCH_SESSION.NAVIGATION_RESTORED" &&
      event.destination.screen === "setup" &&
      ownsDestination(context, event.destination),
    canOpenOverlay: (
      { context, event },
      params: Readonly<{ screen: WebNavigationDestination["screen"] }>,
    ) => {
      if (event.type !== "WEB_MATCH_SESSION.OVERLAY_OPENED") return false
      return eligibleWebNavigationOverlays(
        {
          screen: params.screen,
          matchId: context.session?.match.matchId ?? null,
          setupKey: setupKey(context),
          overlays: [...context.overlays, event.overlay],
        },
        context.session !== null &&
          context.dismissedRewardMatchId !== context.session.match.matchId,
      ).includes(event.overlay)
    },
  },
}).createMachine({
  id: "webMatchSession",
  initial: "routing",
  context: ({ input }) => ({
    activeMatchExists: input.activeMatchExists,
    failure: null,
    operations: input.operations,
    requestedSetup: { mode: "story", variant: "standard" },
    session: null,
    overlays: [],
    dismissedRewardMatchId: null,
    presentedRewardMatchId: null,
  }),
  states: {
    routing: {
      always: [
        { guard: "activeMatchExists", target: "openingCurrentMatch" },
        { target: "menu" },
      ],
    },
    menu: {
      initial: "choosingMode",
      on: {
        "WEB_MATCH_SESSION.PROFILE_REPLACED": {
          actions: "acceptProfileReplacement",
          target: "routing",
        },
        "WEB_MATCH_SESSION.RESUME_REQUESTED": {
          guard: "hasSession",
          actions: "clearOverlays",
          target: "active",
        },
        "WEB_MATCH_SESSION.OVERLAY_OPENED": {
          guard: { type: "canOpenOverlay", params: { screen: "menu" } },
          actions: "openOverlay",
        },
        "WEB_MATCH_SESSION.OVERLAY_CLOSED": { actions: "closeOverlay" },
        "WEB_MATCH_SESSION.NAVIGATION_RESTORED": [
          {
            guard: "restoresOwnedMatch",
            actions: "restoreNavigation",
            target: "active",
          },
          {
            guard: "restoresSetup",
            actions: "restoreNavigation",
            target: ".setup",
          },
          { actions: "restoreNavigation", target: ".choosingMode" },
        ],
      },
      states: {
        choosingMode: {
          on: {
            "WEB_MATCH_SESSION.SETUP_REQUESTED": {
              actions: {
                type: "rememberRequestedSetup",
                params: ({ event }) => ({ setup: event.setup }),
              },
              target: "setup",
            },
          },
        },
        setup: {
          on: {
            "WEB_MATCH_SESSION.OVERLAY_OPENED": {
              guard: { type: "canOpenOverlay", params: { screen: "setup" } },
              actions: "openOverlay",
            },
            "WEB_MATCH_SESSION.MATCH_REQUESTED": {
              actions: {
                type: "rememberRequestedSetup",
                params: ({ event }) => ({ setup: event.setup }),
              },
              target: "#webMatchSession.openingFreshMatch",
            },
            "WEB_MATCH_SESSION.MAIN_MENU_REQUESTED": { target: "choosingMode" },
          },
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
          setup: context.requestedSetup,
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
        "WEB_MATCH_SESSION.PROFILE_REPLACED": {
          actions: "acceptProfileReplacement",
          target: "routing",
        },
        "WEB_MATCH_SESSION.OVERLAY_OPENED": {
          guard: { type: "canOpenOverlay", params: { screen: "match" } },
          actions: "openOverlay",
        },
        "WEB_MATCH_SESSION.OVERLAY_CLOSED": { actions: "closeOverlay" },
        "WEB_MATCH_SESSION.MAIN_MENU_REQUESTED": {
          actions: "clearOverlays",
          target: "menu.choosingMode",
        },
        "WEB_MATCH_SESSION.NAVIGATION_RESTORED": [
          { guard: "restoresOwnedMatch", actions: "restoreNavigation" },
          {
            guard: "restoresSetup",
            actions: "restoreNavigation",
            target: "menu.setup",
          },
          { actions: "restoreNavigation", target: "menu.choosingMode" },
        ],
        "WEB_MATCH_SESSION.SETUP_REQUESTED": {
          actions: {
            type: "rememberRequestedSetup",
            params: ({ event }) => ({ setup: event.setup }),
          },
          target: "returningToMenu",
        },
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
          setup: context.requestedSetup,
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
          target: "menu.setup",
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
export type WebMatchSessionActor = ActorRefFrom<
  typeof webMatchSessionMachineDefinition
>

export function selectWebNavigationDestination(
  snapshot: WebMatchSessionMachineSnapshot,
): WebNavigationDestination | null {
  if (!snapshot.matches("active") && !snapshot.matches("menu")) return null
  return {
    screen: snapshot.matches("active")
      ? "match"
      : snapshot.matches({ menu: "setup" })
        ? "setup"
        : "menu",
    matchId: snapshot.context.session?.match.matchId ?? null,
    setupKey: setupKey(snapshot.context),
    overlays: snapshot.context.overlays,
  }
}

export const selectWebMatchSession = (
  snapshot: WebMatchSessionMachineSnapshot,
): WebMatchSession | null => snapshot.context.session

export const selectWebMatchSessionFailure = (
  snapshot: WebMatchSessionMachineSnapshot,
): WebMatchSessionFailure | null => snapshot.context.failure

export default webMatchSessionMachineDefinition
