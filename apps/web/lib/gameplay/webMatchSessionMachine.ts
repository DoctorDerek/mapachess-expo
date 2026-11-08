import type { MatchSession } from "@mapachess/gameplay/match-session"
import createMatchSessionMachine, {
  selectMatchNavigationDestination,
  selectMatchSession,
  selectMatchSessionFailure,
  type MatchSessionActor,
  type MatchSessionFailureOperation,
  type MatchSessionMachineSnapshot,
  type MatchSessionOperations,
} from "@mapachess/match/match-session-machine"
import type { WebMatchRuntime } from "./webMatchRuntime"

export type WebMatchSession = MatchSession<WebMatchRuntime>

export type WebMatchSessionFailureOperation = MatchSessionFailureOperation
export type WebMatchSessionOperations = MatchSessionOperations<WebMatchSession>
export type WebMatchSessionMachineSnapshot =
  MatchSessionMachineSnapshot<WebMatchSession>
export type WebMatchSessionActor = MatchSessionActor<WebMatchSession>

export const selectWebNavigationDestination =
  selectMatchNavigationDestination<WebMatchSession>
export const selectWebMatchSession = selectMatchSession<WebMatchSession>
export const selectWebMatchSessionFailure =
  selectMatchSessionFailure<WebMatchSession>

export default createMatchSessionMachine<WebMatchSession>()
