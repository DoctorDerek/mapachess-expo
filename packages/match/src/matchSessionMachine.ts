import {
  assign,
  fromPromise,
  setup,
  type ActorRefFrom,
  type SnapshotFrom,
} from "xstate"
import {
  eligibleMatchNavigationOverlays,
  type MatchNavigationDestination,
  type MatchNavigationOverlay,
  type MatchNavigationSetupKey,
} from "./matchNavigation.js"
import type { MatchSetup } from "./matchSetup.js"

export type MatchSessionIdentity = Readonly<{
  match: Readonly<{ matchId: string }>
  setup: MatchSetup
}>

export type MatchSessionFailureOperation =
  "open-current-match" | "restart-match" | "return-to-menu" | "start-match"

export type MatchSessionFailure = Readonly<{
  cause: unknown
  operation: MatchSessionFailureOperation
}>

export type MatchSessionOperations<Session extends MatchSessionIdentity> =
  Readonly<{
    openCurrentMatch: (signal: AbortSignal) => Promise<Session>
    openFreshMatch: (
      previousSession: Session | null,
      setup: MatchSetup,
      signal: AbortSignal,
    ) => Promise<Session>
    returnToMenu: (session: Session, signal: AbortSignal) => Promise<void>
    canNavigate: () => boolean
  }>

export type MatchSessionMachineInput<Session extends MatchSessionIdentity> =
  Readonly<{
    activeMatchExists: boolean
    operations: MatchSessionOperations<Session>
  }>

type MatchSessionMachineContext<Session extends MatchSessionIdentity> =
  Readonly<{
    activeMatchExists: boolean
    failure: MatchSessionFailure | null
    operations: MatchSessionOperations<Session>
    requestedSetup: MatchSetup
    session: Session | null
    overlays: readonly MatchNavigationOverlay[]
    dismissedRewardMatchId: string | null
    presentedRewardMatchId: string | null
  }>

export type MatchSessionMachineEvent =
  | Readonly<{
      type: "MATCH_SESSION.MATCH_REQUESTED"
      setup: MatchSetup
    }>
  | Readonly<{ type: "MATCH_SESSION.SETUP_REQUESTED"; setup: MatchSetup }>
  | Readonly<{ type: "MATCH_SESSION.MAIN_MENU_REQUESTED" }>
  | Readonly<{ type: "MATCH_SESSION.RESTART_REQUESTED" }>
  | Readonly<{ type: "MATCH_SESSION.RETRY_REQUESTED" }>
  | Readonly<{ type: "MATCH_SESSION.RETURN_TO_MENU_REQUESTED" }>
  | Readonly<{ type: "MATCH_SESSION.RESUME_REQUESTED" }>
  | Readonly<{ type: "MATCH_SESSION.BACK_REQUESTED" }>
  | Readonly<{
      type: "MATCH_SESSION.PROFILE_REPLACED"
      activeMatchExists: boolean
    }>
  | Readonly<{
      type: "MATCH_SESSION.NAVIGATION_RESTORED"
      destination: MatchNavigationDestination
    }>
  | Readonly<{
      type: "MATCH_SESSION.OVERLAY_OPENED"
      overlay: MatchNavigationOverlay
    }>
  | Readonly<{ type: "MATCH_SESSION.OVERLAY_CLOSED" }>

type OpenCurrentMatchInput<Session extends MatchSessionIdentity> = Readonly<{
  operations: MatchSessionOperations<Session>
}>
type OpenFreshMatchInput<Session extends MatchSessionIdentity> = Readonly<{
  operations: MatchSessionOperations<Session>
  previousSession: Session | null
  setup: MatchSetup
}>
type ReturnToMenuInput<Session extends MatchSessionIdentity> = Readonly<{
  operations: MatchSessionOperations<Session>
  session: Session
}>

export default function createMatchSessionMachine<
  Session extends MatchSessionIdentity,
>() {
  const requireSession = (
    context: MatchSessionMachineContext<Session>,
  ): Session => {
    if (context.session === null) {
      throw new Error("Active match session state requires a session.")
    }
    return context.session
  }

  const failure = (
    operation: MatchSessionFailureOperation,
    cause: unknown,
  ): MatchSessionFailure => Object.freeze({ cause, operation })

  const setupKey = (
    context: MatchSessionMachineContext<Session>,
  ): MatchNavigationSetupKey =>
    `${context.requestedSetup.mode}:${context.requestedSetup.mode === "story" ? context.requestedSetup.variant : context.requestedSetup.challengeSetup.variant}`

  const ownsDestination = (
    context: MatchSessionMachineContext<Session>,
    destination: MatchNavigationDestination,
  ): boolean =>
    destination.matchId === (context.session?.match.matchId ?? null) &&
    destination.setupKey === setupKey(context)

  return setup({
    types: {
      context: {} as MatchSessionMachineContext<Session>,
      events: {} as MatchSessionMachineEvent,
      input: {} as MatchSessionMachineInput<Session>,
    },
    actors: {
      openCurrentMatch: fromPromise<Session, OpenCurrentMatchInput<Session>>(
        ({ input, signal }) => input.operations.openCurrentMatch(signal),
      ),
      openFreshMatch: fromPromise<Session, OpenFreshMatchInput<Session>>(
        ({ input, signal }) =>
          input.operations.openFreshMatch(
            input.previousSession,
            input.setup,
            signal,
          ),
      ),
      returnToMenu: fromPromise<void, ReturnToMenuInput<Session>>(
        ({ input, signal }) =>
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
        (_, params: Readonly<{ session: Session }>) => ({
          failure: null,
          requestedSetup: params.session.setup,
          session: params.session,
          overlays: [],
        }),
      ),
      captureFailure: assign((_, params: MatchSessionFailure) => ({
        failure: failure(params.operation, params.cause),
      })),
      clearSession: assign({ failure: null, session: null, overlays: [] }),
      openOverlay: assign(({ context, event }) => {
        if (event.type !== "MATCH_SESSION.OVERLAY_OPENED") return {}
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
        if (event.type !== "MATCH_SESSION.NAVIGATION_RESTORED") return {}
        const matchId = context.session?.match.matchId ?? null
        const rewardAvailable =
          context.presentedRewardMatchId === matchId &&
          context.dismissedRewardMatchId !== matchId
        const overlays = eligibleMatchNavigationOverlays(
          ownsDestination(context, event.destination)
            ? event.destination
            : { ...event.destination, screen: "menu", overlays: [] },
          rewardAvailable,
        )
        return {
          overlays,
          dismissedRewardMatchId:
            context.overlays.includes("rewards") &&
            !overlays.includes("rewards")
              ? matchId
              : context.dismissedRewardMatchId,
        }
      }),
      clearOverlays: assign({ overlays: [] }),
      acceptProfileReplacement: assign(({ event }) =>
        event.type === "MATCH_SESSION.PROFILE_REPLACED"
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
      navigationAllowed: ({ context }) => context.operations.canNavigate(),
      hasSession: ({ context }) =>
        context.operations.canNavigate() && context.session !== null,
      hasOverlays: ({ context }) =>
        context.operations.canNavigate() && context.overlays.length > 0,
      restoresOwnedMatch: ({ context, event }) =>
        context.operations.canNavigate() &&
        event.type === "MATCH_SESSION.NAVIGATION_RESTORED" &&
        event.destination.screen === "match" &&
        context.session !== null &&
        context.session.match.matchId === event.destination.matchId,
      restoresSetup: ({ context, event }) =>
        context.operations.canNavigate() &&
        event.type === "MATCH_SESSION.NAVIGATION_RESTORED" &&
        event.destination.screen === "setup" &&
        ownsDestination(context, event.destination),
      canOpenOverlay: (
        { context, event },
        params: Readonly<{ screen: MatchNavigationDestination["screen"] }>,
      ) => {
        if (
          !context.operations.canNavigate() ||
          event.type !== "MATCH_SESSION.OVERLAY_OPENED"
        )
          return false
        return eligibleMatchNavigationOverlays(
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
    id: "matchSession",
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
          "MATCH_SESSION.BACK_REQUESTED": {
            guard: "hasOverlays",
            actions: "closeOverlay",
          },
          "MATCH_SESSION.PROFILE_REPLACED": {
            actions: "acceptProfileReplacement",
            target: "routing",
          },
          "MATCH_SESSION.RESUME_REQUESTED": {
            guard: "hasSession",
            actions: "clearOverlays",
            target: "active",
          },
          "MATCH_SESSION.OVERLAY_OPENED": {
            guard: { type: "canOpenOverlay", params: { screen: "menu" } },
            actions: "openOverlay",
          },
          "MATCH_SESSION.OVERLAY_CLOSED": {
            guard: "navigationAllowed",
            actions: "closeOverlay",
          },
          "MATCH_SESSION.NAVIGATION_RESTORED": [
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
            {
              guard: "navigationAllowed",
              actions: "restoreNavigation",
              target: ".choosingMode",
            },
          ],
        },
        states: {
          choosingMode: {
            on: {
              "MATCH_SESSION.SETUP_REQUESTED": {
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
              "MATCH_SESSION.BACK_REQUESTED": [
                { guard: "hasOverlays", actions: "closeOverlay" },
                { guard: "navigationAllowed", target: "choosingMode" },
              ],
              "MATCH_SESSION.OVERLAY_OPENED": {
                guard: { type: "canOpenOverlay", params: { screen: "setup" } },
                actions: "openOverlay",
              },
              "MATCH_SESSION.MATCH_REQUESTED": {
                actions: {
                  type: "rememberRequestedSetup",
                  params: ({ event }) => ({ setup: event.setup }),
                },
                target: "#matchSession.openingFreshMatch",
              },
              "MATCH_SESSION.MAIN_MENU_REQUESTED": { target: "choosingMode" },
            },
          },
        },
      },
      openingCurrentMatch: {
        invoke: {
          id: "matchSession.openCurrentMatch",
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
          id: "matchSession.openFreshMatch",
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
          "MATCH_SESSION.BACK_REQUESTED": [
            { guard: "hasOverlays", actions: "closeOverlay" },
            {
              guard: "navigationAllowed",
              actions: "clearOverlays",
              target: "menu.choosingMode",
            },
          ],
          "MATCH_SESSION.PROFILE_REPLACED": {
            actions: "acceptProfileReplacement",
            target: "routing",
          },
          "MATCH_SESSION.OVERLAY_OPENED": {
            guard: { type: "canOpenOverlay", params: { screen: "match" } },
            actions: "openOverlay",
          },
          "MATCH_SESSION.OVERLAY_CLOSED": {
            guard: "navigationAllowed",
            actions: "closeOverlay",
          },
          "MATCH_SESSION.MAIN_MENU_REQUESTED": {
            guard: "navigationAllowed",
            actions: "clearOverlays",
            target: "menu.choosingMode",
          },
          "MATCH_SESSION.NAVIGATION_RESTORED": [
            { guard: "restoresOwnedMatch", actions: "restoreNavigation" },
            {
              guard: "restoresSetup",
              actions: "restoreNavigation",
              target: "menu.setup",
            },
            {
              guard: "navigationAllowed",
              actions: "restoreNavigation",
              target: "menu.choosingMode",
            },
          ],
          "MATCH_SESSION.SETUP_REQUESTED": {
            actions: {
              type: "rememberRequestedSetup",
              params: ({ event }) => ({ setup: event.setup }),
            },
            target: "returningToMenu",
          },
          "MATCH_SESSION.RESTART_REQUESTED": {
            target: "restartingMatch",
          },
          "MATCH_SESSION.RETURN_TO_MENU_REQUESTED": {
            target: "returningToMenu",
          },
        },
      },
      restartingMatch: {
        invoke: {
          id: "matchSession.restartMatch",
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
          id: "matchSession.returnToMenu",
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
          "MATCH_SESSION.RETRY_REQUESTED": [
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
}

export type MatchSessionMachineSnapshot<Session extends MatchSessionIdentity> =
  SnapshotFrom<ReturnType<typeof createMatchSessionMachine<Session>>>
export type MatchSessionActor<Session extends MatchSessionIdentity> =
  ActorRefFrom<ReturnType<typeof createMatchSessionMachine<Session>>>

export function selectMatchNavigationDestination<
  Session extends MatchSessionIdentity,
>(
  snapshot: MatchSessionMachineSnapshot<Session>,
): MatchNavigationDestination | null {
  if (!snapshot.matches("active") && !snapshot.matches("menu")) return null
  const requestedSetup = snapshot.context.requestedSetup
  return {
    screen: snapshot.matches("active")
      ? "match"
      : snapshot.matches({ menu: "setup" })
        ? "setup"
        : "menu",
    matchId: snapshot.context.session?.match.matchId ?? null,
    setupKey: `${requestedSetup.mode}:${requestedSetup.mode === "story" ? requestedSetup.variant : requestedSetup.challengeSetup.variant}`,
    overlays: snapshot.context.overlays,
  }
}

export function selectCanHandleMatchSessionBack<
  Session extends MatchSessionIdentity,
>(snapshot: MatchSessionMachineSnapshot<Session>): boolean {
  return (
    !snapshot.context.operations.canNavigate() ||
    !snapshot.matches({ menu: "choosingMode" }) ||
    snapshot.context.overlays.length > 0
  )
}
export function selectMatchSession<Session extends MatchSessionIdentity>(
  snapshot: MatchSessionMachineSnapshot<Session>,
): Session | null {
  return snapshot.context.session
}
export function selectMatchSessionFailure<Session extends MatchSessionIdentity>(
  snapshot: MatchSessionMachineSnapshot<Session>,
): MatchSessionFailure | null {
  return snapshot.context.failure
}
