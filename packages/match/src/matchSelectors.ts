import type { AutoHintMode } from "./autoHintMode.js"
import type { BetterHintsResult } from "./betterHints.js"
import type { MatchConclusion } from "./matchConclusion.js"
import type { MatchMachineSnapshot } from "./matchMachine.js"
import type {
  MatchHintFailure,
  MatchHintStage,
  MatchOpponentFailure,
} from "./matchMachineTypes.js"
import type { MatchPersistenceFailure } from "./matchPersistence.js"
import type { MatchPosition } from "./matchPosition.js"
import { currentMatchPosition, type MatchTimeline } from "./matchTimeline.js"
import {
  redoToNextPlayerDecision,
  undoToPreviousPlayerDecision,
} from "./matchWorkflow.js"

export const selectMatchPosition = (
  snapshot: MatchMachineSnapshot,
): MatchPosition => currentMatchPosition(snapshot.context.timeline)

export const selectMatchTimeline = (
  snapshot: MatchMachineSnapshot,
): MatchTimeline => snapshot.context.timeline

export const selectAutoHintMode = (
  snapshot: MatchMachineSnapshot,
): AutoHintMode =>
  snapshot.context.pendingMutation?.request.autoHintMode ??
  snapshot.context.autoHintMode

export const selectMatchConclusion = (
  snapshot: MatchMachineSnapshot,
): MatchConclusion | null => snapshot.context.conclusion

export const selectDrawOfferResponse = (
  snapshot: MatchMachineSnapshot,
): "rejected" | null => snapshot.context.drawOfferResponse

export const selectAreMatchMutationsFrozen = (
  snapshot: MatchMachineSnapshot,
): boolean =>
  snapshot.matches("persistingMutation") ||
  snapshot.matches("persistenceFailure")

export const selectCanUndo = (snapshot: MatchMachineSnapshot): boolean =>
  !selectAreMatchMutationsFrozen(snapshot) && selectHasUndoHistory(snapshot)

export const selectHasUndoHistory = (snapshot: MatchMachineSnapshot): boolean =>
  undoToPreviousPlayerDecision(
    snapshot.context.timeline,
    snapshot.context.playerColor,
  ) !== undefined

export const selectCanRedo = (snapshot: MatchMachineSnapshot): boolean =>
  !selectAreMatchMutationsFrozen(snapshot) && selectHasRedoHistory(snapshot)

export const selectHasRedoHistory = (snapshot: MatchMachineSnapshot): boolean =>
  redoToNextPlayerDecision(
    snapshot.context.timeline,
    snapshot.context.playerColor,
  ) !== undefined

export const selectCanOfferDraw = (snapshot: MatchMachineSnapshot): boolean =>
  selectIsPlayerTurn(snapshot) &&
  !selectAreMatchMutationsFrozen(snapshot) &&
  snapshot.context.conclusion === null

export const selectCanResign = (snapshot: MatchMachineSnapshot): boolean =>
  !selectAreMatchMutationsFrozen(snapshot) &&
  snapshot.context.conclusion === null &&
  selectMatchPosition(snapshot).status.type === "playing"

export const selectIsPlayerTurn = (snapshot: MatchMachineSnapshot): boolean =>
  snapshot.matches("playerTurn")

export const selectIsOpponentTurn = (snapshot: MatchMachineSnapshot): boolean =>
  snapshot.matches("opponentThinking") || snapshot.matches("opponentFailure")

export const selectIsOpponentThinking = (
  snapshot: MatchMachineSnapshot,
): boolean => snapshot.matches("opponentThinking")

export const selectHintStage = (
  snapshot: MatchMachineSnapshot,
): MatchHintStage => {
  const pending = snapshot.context.pendingMutation
  if (pending !== null) {
    if (
      pending.conclusion !== null ||
      pending.request.currentFen !== selectMatchPosition(snapshot).fen
    )
      return "hidden"
    if (
      pending.retainedHintStage !== null &&
      snapshot.context.hints?.positionFen === pending.request.currentFen
    )
      return pending.retainedHintStage
    if (selectMatchPosition(snapshot).turn !== snapshot.context.playerColor)
      return "hidden"
    if (snapshot.context.hintAnalyst === null) return "unavailable"
    if (snapshot.matches("persistenceFailure")) return "ready"
    if (pending.route === "accepted-hints-visible") return "loading"
    return pending.request.autoHintMode === "no-auto-hints"
      ? "ready"
      : "loading"
  }
  if (!snapshot.matches("playerTurn")) return "hidden"
  if (snapshot.context.hintAnalyst === null) return "unavailable"
  if (snapshot.matches({ playerTurn: "analyzing" })) return "loading"
  if (snapshot.matches({ playerTurn: "pieceHintsVisible" })) {
    return "piece-hints"
  }
  if (snapshot.matches({ playerTurn: "moveHintsVisible" })) {
    return "move-hints"
  }
  if (snapshot.matches({ playerTurn: "hintFailure" })) return "failure"
  return "ready"
}

export const selectMatchHints = (
  snapshot: MatchMachineSnapshot,
): BetterHintsResult | null => snapshot.context.hints

export const selectHintFailure = (
  snapshot: MatchMachineSnapshot,
): MatchHintFailure | null => snapshot.context.hintFailure

export const selectMoveHintsUsed = (snapshot: MatchMachineSnapshot): boolean =>
  snapshot.context.moveHintsUsed

export const selectPieceHintsUsed = (snapshot: MatchMachineSnapshot): boolean =>
  snapshot.context.pieceHintsUsed

export const selectOpponentFailure = (
  snapshot: MatchMachineSnapshot,
): MatchOpponentFailure | null => snapshot.context.opponentFailure

export const selectPersistenceFailure = (
  snapshot: MatchMachineSnapshot,
): MatchPersistenceFailure | null => snapshot.context.persistenceFailure

export const selectIsPersistingMutation = (
  snapshot: MatchMachineSnapshot,
): boolean => snapshot.matches("persistingMutation")
