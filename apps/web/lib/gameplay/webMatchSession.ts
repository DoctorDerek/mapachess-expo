import openFreshMatchSession, {
  openCurrentMatchSession,
  returnMatchSessionToMenu,
  type FreshMatchSessionOptions,
  type MatchSession,
  type OpenMatchSessionInput,
  type ReturnMatchSessionToMenuInput,
} from "@mapachess/gameplay/match-session"
import openWebMatchRuntime, {
  type OpenWebMatchRuntimeInput,
} from "./openWebMatchRuntime"
import type { WebMatchRuntime } from "./webMatchRuntime"
import { webChallengeDifficultyTargets } from "./webOpponentPolicy"

type OpenWebMatchRuntime = (
  input?: OpenWebMatchRuntimeInput,
) => Promise<WebMatchRuntime>

export type OpenWebMatchSessionInput = Omit<
  OpenMatchSessionInput<WebMatchRuntime>,
  "openRuntime" | "monotonicClock"
> &
  Readonly<{
    openRuntime?: OpenWebMatchRuntime
  }>

export type OpenFreshWebMatchSessionInput = OpenWebMatchSessionInput &
  FreshMatchSessionOptions<WebMatchRuntime>
export type ReturnWebMatchSessionToMenuInput = ReturnMatchSessionToMenuInput

const monotonicClock = { now: () => performance.now() }

export async function openCurrentWebMatchSession(
  input: OpenWebMatchSessionInput,
): Promise<MatchSession<WebMatchRuntime>> {
  return openCurrentMatchSession({
    ...input,
    openRuntime: input.openRuntime ?? openWebMatchRuntime,
    monotonicClock,
  })
}

export async function openFreshWebMatchSession(
  input: OpenFreshWebMatchSessionInput,
): Promise<MatchSession<WebMatchRuntime>> {
  return openFreshMatchSession({
    ...input,
    openRuntime: input.openRuntime ?? openWebMatchRuntime,
    monotonicClock,
    challengeDifficultyTargets: webChallengeDifficultyTargets,
  })
}

export async function returnWebMatchSessionToMenu(
  input: ReturnWebMatchSessionToMenuInput,
): Promise<void> {
  await returnMatchSessionToMenu(input)
}
