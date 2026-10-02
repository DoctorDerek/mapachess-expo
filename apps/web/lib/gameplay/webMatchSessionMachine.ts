import type { ActorRefFrom } from "xstate"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import matchMachine from "@mapachess/match/match-machine"
import createMatchSessionMachine, {
  selectMatchNavigationDestination,
  selectMatchSession,
  selectMatchSessionFailure,
  type MatchSessionActor,
  type MatchSessionFailureOperation,
  type MatchSessionIdentity,
  type MatchSessionMachineSnapshot,
  type MatchSessionOperations,
} from "@mapachess/match/match-session-machine"
import type { WebMatchRuntime } from "./webMatchRuntime"

export type WebMatchSession = MatchSessionIdentity &
  Readonly<{
    actor: ActorRefFrom<typeof matchMachine>
    close: () => Promise<void>
    evaluationActor: ActorRefFrom<typeof positionEvaluationMachine>
    match: DurableMatchRecord
    runtime: WebMatchRuntime
  }>

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
