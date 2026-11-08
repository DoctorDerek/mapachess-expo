import { evaluatePositionWithStockfish } from "@mapachess/evaluation/position-evaluator"
import {
  createMatchId,
  selectMatchStartingPosition,
  selectStoryPlayerColor,
} from "@mapachess/gameplay/match-identity"
import type { OpenMatchRuntimeInput } from "@mapachess/gameplay/match-runtime"
import closeAfterFailedRuntimeOpen, {
  closeOwnedEngineSessions,
} from "@mapachess/gameplay/runtime-lifetime"
import createBetterHintsAnalyst, {
  BETTER_HINTS_ENGINE_MULTIPV,
} from "@mapachess/hints/better-hints"
import type { StockfishEngineConfiguration } from "@mapachess/stockfish/engine-session"
import type {
  StockfishUciIdentity,
  StockfishUciSession,
} from "@mapachess/stockfish/uci-session"
import { WEB_OPPONENT_ENGINE_CONFIGURATION } from "@mapachess/stockfish/web-opponent-policy"
import createWebStockfishSession, {
  type CreateWebStockfishSessionOptions,
} from "../stockfish/createWebStockfishSession"
import prepareWebStockfishProgram from "../stockfish/prepareWebStockfishProgram"
import type { WebMatchRuntime } from "./webMatchRuntime"
import createWebOpponent, {
  generateWebMatchSeed,
  type WebOpponentCryptography,
} from "./webOpponent"
import resolveWebOpponentPolicy, {
  resolveWebChallengePolicy,
} from "./webOpponentPolicy"

const SINGLE_PV_ENGINE_CONFIGURATION: StockfishEngineConfiguration =
  Object.freeze({
    ...WEB_OPPONENT_ENGINE_CONFIGURATION,
    variant: "standard",
  })

const OPPONENT_WORKER_NAME = "mapachess-stockfish-18-opponent" as const
const HINT_WORKER_NAME = "mapachess-stockfish-18-better-hints" as const
const EVALUATION_WORKER_NAME = "mapachess-stockfish-18-evaluation" as const

export type OpenWebMatchRuntimeInput = OpenMatchRuntimeInput &
  Readonly<{
    cryptography?: WebOpponentCryptography
    openSession?: (
      configuration: StockfishEngineConfiguration,
      options?: CreateWebStockfishSessionOptions,
    ) => StockfishUciSession
  }>

const RUNTIME_FAILURE_MESSAGES = {
  close: "Web match sessions failed to close cleanly.",
  openAndClose: "Web match failed to open and close cleanly.",
} as const

export default async function openWebMatchRuntime(
  input: OpenWebMatchRuntimeInput = {},
): Promise<WebMatchRuntime> {
  const setup = input.setup ?? {
    chess960PositionId: null,
    variant: "standard",
  }
  const cryptography = input.cryptography ?? globalThis.crypto
  const opponentId = input.opponentId ?? "chicken-stockfish"
  const policy =
    input.mode === "challenge"
      ? await resolveWebChallengePolicy(
          opponentId,
          setup.variant,
          input.difficultyTargetElo,
          input.opponentPolicyFingerprint,
          cryptography.subtle,
        )
      : await resolveWebOpponentPolicy(
          opponentId,
          setup.variant,
          cryptography.subtle,
          input.opponentPolicyFingerprint,
        )
  input.signal?.throwIfAborted()
  const matchSeed = input.matchSeed ?? generateWebMatchSeed(cryptography)
  const playerColor =
    input.mode === "challenge" && input.playerColor !== "random"
      ? input.playerColor
      : selectStoryPlayerColor(matchSeed)
  const startingPosition = selectMatchStartingPosition(setup, matchSeed)
  const singlePvConfiguration: StockfishEngineConfiguration = {
    ...SINGLE_PV_ENGINE_CONFIGURATION,
    variant: startingPosition.variant,
  }
  const program = input.openSession
    ? null
    : await prepareWebStockfishProgram(input.signal)
  const openSession = input.openSession ?? createWebStockfishSession
  const sessions: StockfishUciSession[] = []
  const own = (
    configuration: StockfishEngineConfiguration,
    workerName: string,
  ) => {
    const session = openSession(
      configuration,
      program ? { workerName, workerUrl: program.url } : { workerName },
    )
    sessions.push(session)
    return session
  }
  let opponentSession: StockfishUciSession
  let hintSession: StockfishUciSession
  let evaluationSession: StockfishUciSession
  let engineIdentity: StockfishUciIdentity
  try {
    opponentSession = own(singlePvConfiguration, OPPONENT_WORKER_NAME)
    hintSession = own(
      { ...singlePvConfiguration, multiPv: BETTER_HINTS_ENGINE_MULTIPV },
      HINT_WORKER_NAME,
    )
    evaluationSession = own(singlePvConfiguration, EVALUATION_WORKER_NAME)
    const identities = await Promise.all([
      opponentSession.boot(input.signal),
      hintSession.boot(input.signal),
      evaluationSession.boot(input.signal),
    ])
    engineIdentity = identities[0]
    if (input.signal?.aborted === true) {
      throw new DOMException("Web match opening was aborted.", "AbortError")
    }
  } catch (error) {
    try {
      return await closeAfterFailedRuntimeOpen(
        sessions,
        error,
        RUNTIME_FAILURE_MESSAGES,
      )
    } finally {
      program?.release()
    }
  }

  return Object.freeze<WebMatchRuntime>({
    close: async () => {
      try {
        await closeOwnedEngineSessions(sessions, RUNTIME_FAILURE_MESSAGES.close)
      } finally {
        program?.release()
      }
    },
    engineIdentity,
    hintAnalyst: createBetterHintsAnalyst({ engine: hintSession }),
    matchId: createMatchId(
      matchSeed,
      startingPosition,
      input.mode === "challenge"
        ? { mode: "challenge", playerColor }
        : { mode: "story" },
      opponentId,
    ),
    matchSeed,
    opponent: createWebOpponent(
      opponentSession,
      cryptography,
      matchSeed,
      policy,
    ),
    opponentId,
    opponentPolicyFingerprint: policy.fingerprint,
    opponentTargetElo: policy.targetElo,
    ratedOpponentElo:
      policy.calibrationFingerprint === undefined ? null : policy.targetElo,
    playerColor,
    startingPosition,
    positionEvaluator: (request, signal, onRefinement) =>
      evaluatePositionWithStockfish(
        evaluationSession,
        request,
        signal,
        onRefinement,
      ),
  })
}
