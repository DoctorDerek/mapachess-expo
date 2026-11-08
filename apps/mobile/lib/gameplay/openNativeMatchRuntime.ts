import { evaluatePositionWithStockfish } from "@mapachess/evaluation/position-evaluator"
import {
  createMatchId,
  selectMatchStartingPosition,
  selectStoryPlayerColor,
} from "@mapachess/gameplay/match-identity"
import type {
  MatchRuntime,
  OpenMatchRuntimeInput,
} from "@mapachess/gameplay/match-runtime"
import createMatchOpponent, {
  generateMatchSeed,
} from "@mapachess/gameplay/opponent"
import resolveOpponentPolicy, {
  resolveChallengePolicy,
} from "@mapachess/gameplay/opponent-policy"
import closeAfterFailedRuntimeOpen, {
  closeOwnedEngineSessions,
} from "@mapachess/gameplay/runtime-lifetime"
import createBetterHintsAnalyst, {
  BETTER_HINTS_ENGINE_MULTIPV,
} from "@mapachess/hints/better-hints"
import {
  STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST,
  type StockfishNativeBuildManifest,
} from "@mapachess/stockfish-native/build-identity"
import createNativeStockfishSession, {
  loadNativeStockfishBridge,
} from "@mapachess/stockfish-native/open-session"
import type {
  StockfishEngineConfiguration,
  StockfishEngineIdentity,
  StockfishEngineSession,
} from "@mapachess/stockfish/engine-session"
import { assertStockfishOperationNotAborted } from "@mapachess/stockfish/engine-validation"
import { WEB_OPPONENT_ENGINE_CONFIGURATION } from "@mapachess/stockfish/web-opponent-policy"
import nativeCryptography, {
  type NativeMatchCryptography,
} from "./nativeCryptography"

export type NativeMatchRuntime = MatchRuntime &
  Readonly<{ nativeBuildIdentity: StockfishNativeBuildManifest }>

export type OpenNativeMatchRuntimeInput = OpenMatchRuntimeInput &
  Readonly<{
    cryptography?: NativeMatchCryptography
    openSession?: (
      configuration: StockfishEngineConfiguration,
    ) => StockfishEngineSession
  }>

const RUNTIME_FAILURE_MESSAGES = {
  close: "Native match sessions failed to close cleanly.",
  openAndClose: "Native match failed to open and close cleanly.",
} as const

export default async function openNativeMatchRuntime(
  input: OpenNativeMatchRuntimeInput = {},
): Promise<NativeMatchRuntime> {
  const cryptography = input.cryptography ?? nativeCryptography
  const variant = input.setup?.variant ?? "standard"
  const opponentId = input.opponentId ?? "chicken-stockfish"
  const policy =
    input.mode === "challenge"
      ? await resolveChallengePolicy(
          opponentId,
          variant,
          cryptography.sha256,
          input.difficultyTargetElo,
          input.opponentPolicyFingerprint,
        )
      : await resolveOpponentPolicy(
          opponentId,
          variant,
          cryptography.sha256,
          input.opponentPolicyFingerprint,
        )
  assertStockfishOperationNotAborted(input.signal, "native match opening")
  const matchSeed =
    input.matchSeed ?? generateMatchSeed(cryptography.fillRandomWords)
  const startingPosition = selectMatchStartingPosition(input.setup, matchSeed)
  const playerColor =
    input.mode === "challenge" && input.playerColor !== "random"
      ? input.playerColor
      : selectStoryPlayerColor(matchSeed)
  let openSession = input.openSession
  if (openSession === undefined) {
    const bridge = await loadNativeStockfishBridge()
    assertStockfishOperationNotAborted(input.signal, "native match opening")
    openSession = (configuration) =>
      createNativeStockfishSession(configuration, bridge)
  }
  const createSession = openSession
  const sessions: StockfishEngineSession[] = []
  const own = (
    configuration: StockfishEngineConfiguration,
  ): StockfishEngineSession => {
    const session = createSession(configuration)
    sessions.push(session)
    return session
  }
  const configuration: StockfishEngineConfiguration = {
    ...WEB_OPPONENT_ENGINE_CONFIGURATION,
    variant,
  }
  let opponent: StockfishEngineSession
  let hints: StockfishEngineSession
  let evaluation: StockfishEngineSession
  let engineIdentity: StockfishEngineIdentity
  try {
    opponent = own(configuration)
    hints = own({ ...configuration, multiPv: BETTER_HINTS_ENGINE_MULTIPV })
    evaluation = own(configuration)
    const identities = await Promise.all([
      opponent.boot(input.signal),
      hints.boot(input.signal),
      evaluation.boot(input.signal),
    ])
    engineIdentity = identities[0]
    assertStockfishOperationNotAborted(input.signal, "native match opening")
  } catch (error) {
    return closeAfterFailedRuntimeOpen(
      sessions,
      error,
      RUNTIME_FAILURE_MESSAGES,
    )
  }
  let closing: Promise<void> | undefined
  return Object.freeze<NativeMatchRuntime>({
    close: () => {
      closing ??= closeOwnedEngineSessions(
        sessions,
        RUNTIME_FAILURE_MESSAGES.close,
      )
      return closing
    },
    engineIdentity,
    nativeBuildIdentity: STOCKFISH_18_LITE_NATIVE_BUILD_MANIFEST,
    hintAnalyst: createBetterHintsAnalyst({ engine: hints }),
    matchId: createMatchId(
      matchSeed,
      startingPosition,
      input.mode === "challenge"
        ? { mode: "challenge", playerColor }
        : { mode: "story" },
      opponentId,
    ),
    matchSeed,
    opponent: createMatchOpponent(
      opponent,
      cryptography.digestBytes,
      matchSeed,
      policy,
    ),
    opponentId,
    opponentPolicyFingerprint: policy.fingerprint,
    opponentTargetElo: policy.targetElo,
    ratedOpponentElo:
      policy.calibrationFingerprint === undefined ? null : policy.targetElo,
    playerColor,
    positionEvaluator: (request, signal, onRefinement) =>
      evaluatePositionWithStockfish(evaluation, request, signal, onRefinement),
    startingPosition,
  })
}
