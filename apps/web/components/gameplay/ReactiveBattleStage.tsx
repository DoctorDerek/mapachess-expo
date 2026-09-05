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
      className="border-mapachito-charcoal bg-mapachito-violet text-mapachito-white relative isolate overflow-hidden rounded-[1rem_0.25rem_1rem_0.25rem] border-3 shadow-[0.35rem_0.35rem_0_var(--color-mapachito-orange),0.65rem_0.65rem_0_var(--color-mapachito-raspberry)] forced-colors:border-[CanvasText] forced-colors:shadow-none"
    >
      <header className="border-mapachito-charcoal bg-mapachito-orange text-mapachito-charcoal flex items-center justify-between gap-4 border-b-3 px-4 py-3 forced-colors:border-[CanvasText] forced-colors:shadow-none">
        <div>
          <p className="text-mapachito-charcoal font-mono text-xs leading-[1.3] font-black tracking-[0.18em] uppercase">
            Chess becomes battle
          </p>
          <h2
            className="font-display mt-[0.2rem] text-[1.4rem] leading-none font-black tracking-[0.015em] uppercase"
            id="reactive-battle-stage-title"
          >
            Reactive Battle Stage
          </h2>
        </div>
        <span className="border-mapachito-charcoal bg-mapachito-red text-mapachito-white shadow-mapachito-charcoal border-2 px-[0.55rem] py-[0.35rem] font-mono text-[0.7rem] font-black tracking-[0.12em] uppercase shadow-[0.2rem_0.2rem_0]">
          Live
        </span>
      </header>

      <p aria-live="polite" className="sr-only">
        {stageAnnouncement(currentPhase)}
      </p>

      <div className="after:border-mapachito-charcoal relative isolate grid min-h-56 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end overflow-hidden px-[0.6rem] pt-4 pb-[0.9rem] [background:linear-gradient(_to_bottom,_var(--color-mapachito-blue)_0_56%,_var(--color-mapachito-deep-cyan)_56%_60%,_var(--color-mapachito-green)_60%_66%,_var(--color-mapachito-deep-gold)_66%_100%_)] before:absolute before:inset-0 before:z-0 before:[background:linear-gradient(var(--color-mapachito-white)_0_0)_9%_20%_/_3.25rem_0.75rem_no-repeat,_linear-gradient(var(--color-mapachito-white)_0_0)_16%_14%_/_1.5rem_0.75rem_no-repeat,_linear-gradient(var(--color-mapachito-white)_0_0)_79%_27%_/_3.75rem_0.75rem_no-repeat,_linear-gradient(var(--color-mapachito-white)_0_0)_87%_21%_/_1.5rem_0.75rem_no-repeat,_linear-gradient(var(--color-mapachito-orange)_0_0)_88%_8%_/_2.5rem_2.5rem_no-repeat,_linear-gradient(135deg,_transparent_50%,_var(--color-mapachito-violet)_50%)_0_100%_/_7rem_5rem_repeat-x] after:absolute after:inset-x-0 after:bottom-0 after:z-1 after:h-[34%] after:border-t-[0.35rem] after:[background:repeating-linear-gradient(_90deg,_transparent_0_1.4rem,_color-mix(in_srgb,_var(--color-mapachito-white)_15%,_transparent)_1.4rem_1.55rem_),_repeating-linear-gradient(_0deg,_transparent_0_0.7rem,_color-mix(in_srgb,_var(--color-mapachito-charcoal)_18%,_transparent)_0.7rem_0.85rem_),_var(--color-mapachito-deep-gold)] forced-colors:before:hidden forced-colors:after:hidden">
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

        <span
          aria-hidden="true"
          className="border-mapachito-charcoal bg-mapachito-raspberry font-display text-mapachito-white shadow-mapachito-charcoal relative z-3 -rotate-5 self-center border-2 px-2 py-[0.3rem] text-[1.35rem] font-black shadow-[0.2rem_0.2rem_0] forced-colors:border-[CanvasText] forced-colors:shadow-none"
        >
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
