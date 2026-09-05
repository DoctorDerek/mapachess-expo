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
    <figure
      aria-live="polite"
      className="border-mapachito-charcoal bg-mapachito-orange text-mapachito-charcoal shadow-mapachito-raspberry grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.9rem] rounded-[0.75rem_0.2rem_0.75rem_0.2rem] border-3 p-[0.8rem] shadow-[0.3rem_0.3rem_0]"
    >
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="border-mapachito-charcoal bg-mapachito-violet size-18 overflow-hidden border-3"
        initial={shouldReduceMotion ? false : { opacity: 0.65, scale: 0.92 }}
        key={`${String(presentationSnapshot.context.reactionSequence)}:${String(
          presentationSnapshot.context.phaseIndex,
        )}:${portrait.label}`}
        transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
      >
        {source === null ? (
          <span
            aria-hidden="true"
            className="font-display text-mapachito-white grid size-18 place-items-center text-[2.5rem] font-black"
          >
            M
          </span>
        ) : (
          <img
            alt=""
            aria-hidden="true"
            className="block size-full [image-rendering:pixelated]"
            height="64"
            src={source}
            width="64"
          />
        )}
      </motion.div>
      <figcaption className="grid gap-1">
        <span className="font-mono text-[0.68rem] font-black tracking-[0.12em] uppercase">
          Mapachito coach
        </span>
        <strong className="font-display text-2xl leading-none uppercase">
          {readableLabel}
        </strong>
      </figcaption>
    </figure>
  )
}
