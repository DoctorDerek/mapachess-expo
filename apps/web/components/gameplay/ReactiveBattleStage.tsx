"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  selectMatchPresentationBeat,
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
import { battleContactDistancePixels } from "@mapachess/match-presentation/sprite-presentation-geometry"
import type { StockfishOpponentDefinition } from "@mapachess/match/stockfish-opponent"
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
  const playerPresentation = useMemo(
    () =>
      resolveSpritePresentation(
        MAPACHITO_SPRITE_MANIFEST,
        playerReaction,
        AVAILABLE_MAPACHITO_SPRITE_SOURCES,
      ),
    [playerReaction],
  )
  const playerAnchor = useRef<HTMLDivElement>(null)
  const opponentAnchor = useRef<HTMLDivElement>(null)
  const [contactDistance, setContactDistance] = useState(0)
  const beat = selectMatchPresentationBeat(presentationSnapshot)
  useEffect(() => {
    const player = playerAnchor.current
    const opponent = opponentAnchor.current
    if (player === null || opponent === null) return
    const measure = (): void => {
      const first = player.getBoundingClientRect()
      const second = opponent.getBoundingClientRect()
      setContactDistance(battleContactDistancePixels(first.right, second.left))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(player)
    observer.observe(opponent)
    if (player.parentElement?.parentElement)
      observer.observe(player.parentElement.parentElement)
    measure()
    return () => observer.disconnect()
  }, [])
  const isReacting = presentationSnapshot.matches("reacting")

  return (
    <section
      aria-labelledby="reactive-battle-stage-title"
      className="border-mapachito-charcoal bg-mapachito-violet text-mapachito-white relative isolate overflow-hidden rounded-[1rem_0.25rem_1rem_0.25rem] border-3 shadow-[0.35rem_0.35rem_0_var(--color-mapachito-orange),0.65rem_0.65rem_0_var(--color-mapachito-raspberry)] forced-colors:border-[CanvasText] forced-colors:shadow-none"
    >
      <header className="border-mapachito-charcoal bg-mapachito-orange text-mapachito-charcoal border-b-3 px-4 py-2 forced-colors:border-[CanvasText]">
        <h2
          className="font-display text-xl font-black tracking-wide uppercase"
          id="reactive-battle-stage-title"
        >
          Reactive Battle Stage
        </h2>
      </header>

      <p aria-live="polite" className="sr-only">
        {stageAnnouncement(currentPhase, opponentName)}
      </p>

      <div className="bg-mapachito-blue before:border-mapachito-charcoal before:bg-mapachito-deep-gold relative isolate grid grid-cols-2 grid-rows-[8rem_auto] gap-x-8 overflow-hidden px-4 pt-4 pb-3 before:absolute before:inset-x-0 before:top-36 before:bottom-0 before:border-t-4 forced-colors:before:hidden">
        <BattleFighter
          anchorRef={playerAnchor}
          beat={beat}
          contactDistance={contactDistance}
          displayName="Mapachito"
          facing="right"
          onAnimationCompleted={onParticipantAnimationCompleted}
          participant="player"
          phaseIndex={phaseIndex}
          presentation={playerPresentation}
          reactionSequence={reactionSequence}
          shouldReportCompletion={
            isReacting && pendingParticipants.includes("player")
          }
        />

        <BattleFighter
          anchorRef={opponentAnchor}
          beat={beat}
          contactDistance={contactDistance}
          displayName={opponentName}
          facing="left"
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
