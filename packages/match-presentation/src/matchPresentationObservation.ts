import type { MatchConclusion } from "@mapachess/match/match-conclusion"
import type { MatchMoveTransition } from "@mapachess/match/match-move"
import type { MatchColor } from "@mapachess/match/match-position"
import type { MatchTimeline } from "@mapachess/match/match-timeline"
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

export type AcceptedMatchPresentationObservation = Readonly<{
  conclusion: MatchConclusion | null
  timeline: MatchTimeline
}>

export type AcceptedMatchPresentationUpdate = Readonly<{
  phases: readonly MatchPresentationPhase[]
  reset: boolean
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
    terminalDefeat: conclusion.type === "checkmate",
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

export const deriveAcceptedMatchPresentationUpdate = (
  previous: AcceptedMatchPresentationObservation,
  current: AcceptedMatchPresentationObservation,
  playerColor: MatchColor,
): AcceptedMatchPresentationUpdate => {
  const before = previous.timeline
  const after = current.timeline
  const transitionsChanged = before.transitions !== after.transitions
  const appended =
    transitionsChanged &&
    before.initialPosition === after.initialPosition &&
    after.cursor === after.transitions.length &&
    after.cursor > before.cursor &&
    before.transitions
      .slice(0, before.cursor)
      .every((transition, index) => transition === after.transitions[index])

  if (appended) {
    const phases = after.transitions
      .slice(before.cursor)
      .flatMap((transition, index, transitions) =>
        deriveAcceptedMovePresentationPhases({
          conclusion:
            index === transitions.length - 1 ? current.conclusion : null,
          playerColor,
          transition,
        }),
      )
    return Object.freeze({
      phases: Object.freeze(phases),
      reset: before.cursor !== before.transitions.length,
    })
  }

  if (transitionsChanged || before.cursor !== after.cursor) {
    return Object.freeze({ phases: Object.freeze([]), reset: true })
  }

  if (current.conclusion !== previous.conclusion) {
    const phase =
      current.conclusion === null
        ? null
        : deriveConclusionPresentationPhase({
            conclusion: current.conclusion,
            playerColor,
          })
    return Object.freeze({
      phases: Object.freeze(phase === null ? [] : [phase]),
      reset: current.conclusion === null,
    })
  }
  return Object.freeze({ phases: Object.freeze([]), reset: false })
}
