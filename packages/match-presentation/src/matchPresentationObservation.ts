import type { MatchConclusion } from "@mapachess/match/match-conclusion"
import type { MatchMoveTransition } from "@mapachess/match/match-move"
import type { MatchColor } from "@mapachess/match/match-position"
import type {
  MatchParticipantReaction,
  MatchPresentationParticipant,
  MatchPresentationPhase,
} from "./matchReaction.js"

export type AcceptedMovePresentationInput = Readonly<{
  conclusion: MatchConclusion | null
  playerColor: MatchColor
  transition: MatchMoveTransition
}>

export type ConclusionPresentationInput = Readonly<{
  conclusion: MatchConclusion
  playerColor: MatchColor
}>

const participantForColor = (
  color: MatchColor,
  playerColor: MatchColor,
): MatchPresentationParticipant =>
  color === playerColor ? "player" : "opponent"

const opposingParticipant = (
  participant: MatchPresentationParticipant,
): MatchPresentationParticipant =>
  participant === "player" ? "opponent" : "player"

const interactionPhase = (
  kind: "capture" | "check",
  attacker: MatchPresentationParticipant,
): MatchPresentationPhase => {
  const attackerReaction: MatchParticipantReaction = Object.freeze({
    family: kind,
    role: "attacker",
  })
  const victimReaction: MatchParticipantReaction = Object.freeze({
    family: kind,
    role: "victim",
  })

  return attacker === "player"
    ? Object.freeze({
        kind,
        opponent: victimReaction,
        player: attackerReaction,
      })
    : Object.freeze({
        kind,
        opponent: attackerReaction,
        player: victimReaction,
      })
}

export const deriveConclusionPresentationPhase = ({
  conclusion,
  playerColor,
}: ConclusionPresentationInput): MatchPresentationPhase | null => {
  if (conclusion.type !== "checkmate" && conclusion.type !== "resignation") {
    return null
  }

  const winner = participantForColor(conclusion.winner, playerColor)
  const loser = opposingParticipant(winner)
  const victory: MatchParticipantReaction = Object.freeze({
    family: "victory",
  })
  const defeat: MatchParticipantReaction = Object.freeze({ family: "defeat" })

  return Object.freeze({
    kind: "conclusion",
    opponent: winner === "opponent" ? victory : defeat,
    player: winner === "player" ? victory : defeat,
  })
}

const moveIsCapture = (transition: MatchMoveTransition): boolean =>
  transition.after.pieces.length < transition.before.pieces.length

const deriveMoveAttacker = (
  transition: MatchMoveTransition,
  playerColor: MatchColor,
): MatchPresentationParticipant =>
  participantForColor(transition.before.turn, playerColor)

const appendConclusionPhase = (
  phases: MatchPresentationPhase[],
  input: AcceptedMovePresentationInput,
): void => {
  const { conclusion } = input
  if (conclusion === null) return

  const conclusionPhase = deriveConclusionPresentationPhase({
    conclusion,
    playerColor: input.playerColor,
  })
  if (conclusionPhase !== null) phases.push(conclusionPhase)
}

export default function deriveAcceptedMovePresentationPhases(
  input: AcceptedMovePresentationInput,
): readonly MatchPresentationPhase[] {
  const phases: MatchPresentationPhase[] = []
  const attacker = deriveMoveAttacker(input.transition, input.playerColor)

  if (moveIsCapture(input.transition)) {
    phases.push(interactionPhase("capture", attacker))
  }
  if (input.transition.after.inCheck) {
    phases.push(interactionPhase("check", attacker))
  }

  appendConclusionPhase(phases, input)
  return Object.freeze(phases)
}
