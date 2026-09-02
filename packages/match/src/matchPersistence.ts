import type { BetterHintsResult } from "./betterHints.js"
import type { MatchConclusion } from "./matchConclusion.js"
import type { MatchMoveId } from "./matchMove.js"
import { currentMatchPosition, type MatchTimeline } from "./matchTimeline.js"

export type MatchPersistenceRequest = Readonly<{
  conclusion: MatchConclusion | null
  currentFen: string
  cursor: number
  matchId: string
  moveHintsUsed: boolean
  moveIds: readonly MatchMoveId[]
  pieceHintsUsed: boolean
  requestId: string
}>

export type MatchPersistenceReceipt = Readonly<{
  requestId: string
  type: "MATCH.MUTATION_PERSISTED"
}>

export type MatchPersistenceFailure = Readonly<{
  type: "MATCH.PERSISTENCE_RECEIPT_STALE" | "MATCH.PERSISTENCE_REQUEST_FAILED"
}>

export type MatchPersistence = Readonly<{
  persist: (
    request: MatchPersistenceRequest,
    signal: AbortSignal,
  ) => Promise<MatchPersistenceReceipt>
}>

export type MatchDurability =
  | Readonly<{ type: "ephemeral" }>
  | Readonly<{
      persistence: MatchPersistence
      type: "durable"
    }>

export type PendingMatchMutationRoute =
  "complete" | "move-hints-visible" | "piece-hints-visible" | "resolve-position"

export type PendingMatchMutation = Readonly<{
  conclusion: MatchConclusion | null
  hints: BetterHintsResult | null
  moveHintsUsed: boolean
  pieceHintsUsed: boolean
  request: MatchPersistenceRequest
  route: PendingMatchMutationRoute
  timeline: MatchTimeline
}>

export type CreatePendingMatchMutationInput = Readonly<{
  conclusion: MatchConclusion | null
  hints: BetterHintsResult | null
  matchId: string
  moveHintsUsed: boolean
  mutationSequence: number
  pieceHintsUsed: boolean
  route: PendingMatchMutationRoute
  timeline: MatchTimeline
}>

export const createPendingMatchMutation = (
  input: CreatePendingMatchMutationInput,
): PendingMatchMutation => {
  const position = currentMatchPosition(input.timeline)
  const conclusionIdentity =
    input.conclusion === null
      ? "active"
      : input.conclusion.type === "checkmate" ||
          input.conclusion.type === "resignation"
        ? `${input.conclusion.type}-${input.conclusion.winner}`
        : input.conclusion.type
  const requestId = `${input.matchId}/persistence/${String(input.mutationSequence)}/conclusion/${conclusionIdentity}/cursor/${String(input.timeline.cursor)}/fen/${position.fen}`

  return Object.freeze({
    conclusion: input.conclusion,
    hints: input.hints,
    moveHintsUsed: input.moveHintsUsed,
    pieceHintsUsed: input.pieceHintsUsed,
    request: Object.freeze({
      conclusion: input.conclusion,
      currentFen: position.fen,
      cursor: input.timeline.cursor,
      matchId: input.matchId,
      moveHintsUsed: input.moveHintsUsed,
      moveIds: Object.freeze(
        input.timeline.transitions.map(({ move }) => move.id),
      ),
      pieceHintsUsed: input.pieceHintsUsed,
      requestId,
    }),
    route: input.route,
    timeline: input.timeline,
  })
}

export const persistenceReceiptMatches = (
  request: MatchPersistenceRequest,
  receipt: MatchPersistenceReceipt,
): boolean =>
  receipt.type === "MATCH.MUTATION_PERSISTED" &&
  receipt.requestId === request.requestId
