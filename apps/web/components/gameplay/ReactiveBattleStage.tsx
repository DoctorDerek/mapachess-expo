"use client"

import { useMemo } from "react"
import {
  selectMatchPresentationBeat,
  selectMatchPresentationVariationOrdinal,
  type MatchPresentationMachineSnapshot,
} from "@mapachess/match-presentation/match-presentation-machine"
import type {
  MatchParticipantReaction,
  MatchPresentationParticipant,
  MatchPresentationPhase,
} from "@mapachess/match-presentation/match-reaction"
import resolveSpritePresentation, {
  type ResolvedSpritePresentation,
} from "@mapachess/match-presentation/presentation-asset-manifest"
import type { StockfishOpponentDefinition } from "@mapachess/match/stockfish-opponent"
import { battleStageStyle } from "../../lib/presentation/battleSpriteFrames"
import {
  AVAILABLE_MAPACHITO_SPRITE_SOURCES,
  MAPACHITO_SPRITE_MANIFEST,
} from "../../lib/presentation/webPresentationAssets"
import BattleFighter from "./BattleFighter"

const IDLE_REACTION = Object.freeze({
  family: "idle",
}) satisfies MatchParticipantReaction

export type ReactiveBattleStageProps = Readonly<{
  opponentName: StockfishOpponentDefinition["displayName"]
  opponentPresentation: ResolvedSpritePresentation<string, string>
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

const stageAnnouncement = (
  phase: MatchPresentationPhase | null,
  opponentName: ReactiveBattleStageProps["opponentName"],
): string => {
  if (phase === null) {
    return `Mapachito and ${opponentName} are ready.`
  }
  if (phase.kind === "capture" || phase.kind === "check") {
    const attacker = participantWithRole(phase, "attacker")
    const attackerName = attacker === "player" ? "Mapachito" : opponentName
    const victimName =
      participantWithRole(phase, "victim") === "player"
        ? "Mapachito"
        : opponentName
    return phase.kind === "capture"
      ? `${attackerName} captures; ${victimName} reacts.`
      : `${attackerName} gives check; ${victimName} reacts.`
  }

  return phase.player.family === "victory"
    ? "Mapachito wins the chess battle."
    : `${opponentName} wins the chess battle.`
}

export default function ReactiveBattleStage({
  onParticipantAnimationCompleted,
  opponentName,
  opponentPresentation,
  presentationSnapshot,
}: ReactiveBattleStageProps) {
  const { currentPhase, pendingParticipants, phaseIndex, reactionSequence } =
    presentationSnapshot.context
  const playerReaction = currentPhase?.player ?? IDLE_REACTION
  const playerVariationOrdinal = selectMatchPresentationVariationOrdinal(
    presentationSnapshot,
    "player",
  )
  const playerPresentation = useMemo(
    () =>
      resolveSpritePresentation(
        MAPACHITO_SPRITE_MANIFEST,
        playerReaction,
        AVAILABLE_MAPACHITO_SPRITE_SOURCES,
        playerVariationOrdinal,
      ),
    [playerReaction, playerVariationOrdinal],
  )
  const beat = selectMatchPresentationBeat(presentationSnapshot)
  const isReacting = presentationSnapshot.matches("reacting")

  return (
    <section
      aria-labelledby="reactive-battle-stage-title"
      className="text-mapachito-white relative isolate"
    >
      <h2 className="sr-only" id="reactive-battle-stage-title">
        Reactive Battle Stage
      </h2>

      <p aria-live="polite" className="sr-only">
        {stageAnnouncement(currentPhase, opponentName)}
      </p>

      <div
        className="bg-mapachito-blue before:bg-mapachito-deep-gold relative isolate grid grid-cols-2 gap-x-(--battle-gap) overflow-hidden pr-[calc(var(--battle-opponent-radius)+var(--battle-recoil-limit))] pb-2 pl-[calc(var(--battle-player-radius)+var(--battle-recoil-limit))] [--battle-above:var(--battle-mobile-above)] [--battle-below:var(--battle-mobile-below)] [--battle-fallback-size:--spacing(18)] [--battle-gap:--spacing(8)] [--battle-opponent-radius:var(--battle-mobile-opponent-radius)] [--battle-player-radius:var(--battle-mobile-player-radius)] [--battle-recoil-limit:10px] before:absolute before:inset-x-0 before:bottom-0 before:h-2 xl:[--battle-above:var(--battle-desktop-above)] xl:[--battle-below:var(--battle-desktop-below)] xl:[--battle-opponent-radius:var(--battle-desktop-opponent-radius)] xl:[--battle-player-radius:var(--battle-desktop-player-radius)] forced-colors:before:hidden"
        style={battleStageStyle(playerPresentation, opponentPresentation)}
      >
        <BattleFighter
          beat={beat}
          displayName="Mapachito"
          facing="right"
          onAnimationCompleted={onParticipantAnimationCompleted}
          opposingPresentation={opponentPresentation}
          participant="player"
          phaseIndex={phaseIndex}
          presentation={playerPresentation}
          reactionSequence={reactionSequence}
          shouldReportCompletion={
            isReacting && pendingParticipants.includes("player")
          }
        />

        <BattleFighter
          beat={beat}
          displayName={opponentName}
          facing="left"
          onAnimationCompleted={onParticipantAnimationCompleted}
          opposingPresentation={playerPresentation}
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
