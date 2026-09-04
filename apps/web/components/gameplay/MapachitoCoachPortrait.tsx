"use client"

import { motion, useReducedMotion } from "motion/react"
import resolveCoachPortrait from "@mapachess/match-presentation/coach-portrait"
import type { MatchPresentationMachineSnapshot } from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchParticipantReaction } from "@mapachess/match-presentation/match-reaction"
import {
  AVAILABLE_COACH_PORTRAITS,
  coachPortraitSource,
} from "../../lib/presentation/webPresentationAssets"

const IDLE_REACTION = Object.freeze({
  family: "idle",
}) satisfies MatchParticipantReaction

export type MapachitoCoachPortraitProps = Readonly<{
  presentationSnapshot: MatchPresentationMachineSnapshot
}>

const readablePortraitLabel = (label: string): string =>
  label
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ")

export default function MapachitoCoachPortrait({
  presentationSnapshot,
}: MapachitoCoachPortraitProps) {
  const shouldReduceMotion = useReducedMotion() === true
  const playerReaction =
    presentationSnapshot.context.currentPhase?.player ?? IDLE_REACTION
  const portrait = resolveCoachPortrait(
    playerReaction,
    AVAILABLE_COACH_PORTRAITS,
  )
  const source =
    portrait.kind === "portrait" ? coachPortraitSource(portrait.label) : null
  const readableLabel = readablePortraitLabel(portrait.label)

  return (
    <figure aria-live="polite" className="mapachess-coach">
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="mapachess-coach__portrait-frame"
        initial={shouldReduceMotion ? false : { opacity: 0.65, scale: 0.92 }}
        key={`${String(presentationSnapshot.context.reactionSequence)}:${String(
          presentationSnapshot.context.phaseIndex,
        )}:${portrait.label}`}
        transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
      >
        {source === null ? (
          <span aria-hidden="true" className="mapachess-coach__fallback">
            M
          </span>
        ) : (
          <img
            alt=""
            aria-hidden="true"
            className="mapachess-coach__portrait"
            height="64"
            src={source}
            width="64"
          />
        )}
      </motion.div>
      <figcaption className="mapachess-coach__caption">
        <span>Mapachito coach</span>
        <strong>{readableLabel}</strong>
      </figcaption>
    </figure>
  )
}
