import type { BetterHintsResult } from "./betterHints.js"
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

export const selectAreMatchMutationsFrozen = (
  snapshot: MatchMachineSnapshot,
): boolean =>
  snapshot.matches("persistingMutation") ||
  snapshot.matches("persistenceFailure")

export const selectCanUndo = (snapshot: MatchMachineSnapshot): boolean =>
  !selectAreMatchMutationsFrozen(snapshot) &&
  undoToPreviousPlayerDecision(
    snapshot.context.timeline,
    snapshot.context.playerColor,
  ) !== undefined

export const selectCanRedo = (snapshot: MatchMachineSnapshot): boolean =>
  !selectAreMatchMutationsFrozen(snapshot) &&
  redoToNextPlayerDecision(
    snapshot.context.timeline,
    snapshot.context.playerColor,
  ) !== undefined

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
