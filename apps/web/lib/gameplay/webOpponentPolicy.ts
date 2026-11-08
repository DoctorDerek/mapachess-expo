import resolveOpponentPolicy, {
  resolveChallengePolicy,
  type OpponentPolicy,
} from "@mapachess/gameplay/opponent-policy"
import type { MatchVariant } from "@mapachess/match/match-variant"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import webSha256, { type Sha256SubtleCrypto } from "../profile/webSha256"

export {
  challengeDifficultyTargets as webChallengeDifficultyTargets,
  type OpponentPolicy as WebOpponentPolicy,
} from "@mapachess/gameplay/opponent-policy"

export default function resolveWebOpponentPolicy(
  opponentId: StockfishOpponentId,
  variant: MatchVariant,
  subtleCrypto: Sha256SubtleCrypto = globalThis.crypto.subtle,
  savedFingerprint?: string,
): Promise<OpponentPolicy> {
  return resolveOpponentPolicy(
    opponentId,
    variant,
    (text) => webSha256(text, subtleCrypto),
    savedFingerprint,
  )
}

export function resolveWebChallengePolicy(
  opponentId: StockfishOpponentId,
  variant: MatchVariant,
  difficultyTargetElo?: number,
  savedFingerprint?: string,
  subtleCrypto: Sha256SubtleCrypto = globalThis.crypto.subtle,
): Promise<OpponentPolicy> {
  return resolveChallengePolicy(
    opponentId,
    variant,
    (text) => webSha256(text, subtleCrypto),
    difficultyTargetElo,
    savedFingerprint,
  )
}
