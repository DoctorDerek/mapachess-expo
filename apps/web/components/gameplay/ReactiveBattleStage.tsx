"use client"

import type { MatchPresentationMachineSnapshot } from "@mapachess/match-presentation/match-presentation-machine"
import type {
  MatchParticipantReaction,
  MatchPresentationParticipant,
  MatchPresentationPhase,
} from "@mapachess/match-presentation/match-reaction"
import resolveSpritePresentation from "@mapachess/match-presentation/presentation-asset-manifest"
import {
  AVAILABLE_CHICKEN_SPRITE_SOURCES,
  AVAILABLE_MAPACHITO_SPRITE_SOURCES,
  CHICKEN_SPRITE_MANIFEST,
  MAPACHITO_SPRITE_MANIFEST,
} from "../../lib/presentation/webPresentationAssets"
import BattleFighter from "./BattleFighter"

const IDLE_REACTION = Object.freeze({
  family: "idle",
}) satisfies MatchParticipantReaction

export type ReactiveBattleStageProps = Readonly<{
  onParticipantAnimationCompleted: (
    participant: MatchPresentationParticipant,
    phaseIndex: number,
    reactionSequence: number,
  ) => void
  presentationSnapshot: MatchPresentationMachineSnapshot
}>

const participantWithRole = (
  phase: MatchPresentationPhase,
  role: "attacker" | "victim",
): MatchPresentationParticipant => {
  const playerReaction = phase.player
  return (playerReaction.family === "capture" ||
    playerReaction.family === "check") &&
    playerReaction.role === role
    ? "player"
    : "opponent"
}

const stageAnnouncement = (phase: MatchPresentationPhase | null): string => {
  if (phase === null) {
    return "Mapachito and Chicken Stockfish are ready."
  }
  if (phase.kind === "capture" || phase.kind === "check") {
    const attacker = participantWithRole(phase, "attacker")
    const attackerName =
      attacker === "player" ? "Mapachito" : "Chicken Stockfish"
    const victimName =
      participantWithRole(phase, "victim") === "player"
        ? "Mapachito"
        : "Chicken Stockfish"
    return phase.kind === "capture"
      ? `${attackerName} captures; ${victimName} reacts.`
      : `${attackerName} gives check; ${victimName} reacts.`
  }

  return phase.player.family === "victory"
    ? "Mapachito wins the chess battle."
    : "Chicken Stockfish wins the chess battle."
}

export default function ReactiveBattleStage({
  onParticipantAnimationCompleted,
  presentationSnapshot,
}: ReactiveBattleStageProps) {
  const { currentPhase, pendingParticipants, phaseIndex, reactionSequence } =
    presentationSnapshot.context
  const playerReaction = currentPhase?.player ?? IDLE_REACTION
  const opponentReaction = currentPhase?.opponent ?? IDLE_REACTION
  const playerPresentation = resolveSpritePresentation(
    MAPACHITO_SPRITE_MANIFEST,
    playerReaction,
    AVAILABLE_MAPACHITO_SPRITE_SOURCES,
  )
  const opponentPresentation = resolveSpritePresentation(
    CHICKEN_SPRITE_MANIFEST,
    opponentReaction,
    AVAILABLE_CHICKEN_SPRITE_SOURCES,
  )
  const isReacting = presentationSnapshot.matches("reacting")

  return (
    <section
      aria-labelledby="reactive-battle-stage-title"
      className="mapachess-battle-stage"
    >
      <header className="mapachess-battle-stage__header">
        <div>
          <p className="mapachess-eyebrow">Chess becomes battle</p>
          <h2
            className="mapachess-battle-stage__title"
            id="reactive-battle-stage-title"
          >
            Reactive Battle Stage
          </h2>
        </div>
        <span className="mapachess-battle-stage__live">Live</span>
      </header>

      <p aria-live="polite" className="sr-only">
        {stageAnnouncement(currentPhase)}
      </p>

      <div className="mapachess-battle-stage__arena">
        <BattleFighter
          displayName="Mapachito"
          facing="right"
          key={`${String(reactionSequence)}:${String(phaseIndex)}:player`}
          onAnimationCompleted={onParticipantAnimationCompleted}
          participant="player"
          phaseIndex={phaseIndex}
          presentation={playerPresentation}
          reactionSequence={reactionSequence}
          shouldReportCompletion={
            isReacting && pendingParticipants.includes("player")
          }
        />

        <span aria-hidden="true" className="mapachess-battle-stage__versus">
          VS
        </span>

        <BattleFighter
          displayName="Chicken Stockfish"
          facing="left"
          key={`${String(reactionSequence)}:${String(phaseIndex)}:opponent`}
          onAnimationCompleted={onParticipantAnimationCompleted}
          participant="opponent"
          phaseIndex={phaseIndex}
          presentation={opponentPresentation}
          reactionSequence={reactionSequence}
          shouldReportCompletion={
            isReacting && pendingParticipants.includes("opponent")
          }
        />
      </div>
    </section>
  )
}
