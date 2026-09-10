"use client"

import resolveCoachPortrait from "@mapachess/match-presentation/coach-portrait"
import type { MatchPresentationMachineSnapshot } from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchParticipantReaction } from "@mapachess/match-presentation/match-reaction"
import useDecodedCoachPortrait from "../../lib/presentation/useDecodedCoachPortrait"
import { AVAILABLE_COACH_PORTRAITS } from "../../lib/presentation/webPresentationAssets"

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
  const playerReaction =
    presentationSnapshot.context.currentPhase?.player ?? IDLE_REACTION
  const portrait = resolveCoachPortrait(
    playerReaction,
    AVAILABLE_COACH_PORTRAITS,
  )
  const visiblePortrait = useDecodedCoachPortrait(portrait)
  const readableLabel = readablePortraitLabel(visiblePortrait.label)

  return (
    <figure
      aria-live="polite"
      className="border-mapachito-charcoal bg-mapachito-orange text-mapachito-charcoal shadow-mapachito-raspberry grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.9rem] rounded-[0.75rem_0.2rem_0.75rem_0.2rem] border-3 p-[0.8rem] shadow-[0.3rem_0.3rem_0]"
    >
      <div className="border-mapachito-charcoal bg-mapachito-violet size-18 overflow-hidden border-3">
        {visiblePortrait.source === null ? (
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
            onError={visiblePortrait.onImageError}
            src={visiblePortrait.source}
            width="64"
          />
        )}
      </div>
      <figcaption className="grid gap-1">
        <span className="font-mono text-[0.68rem] font-black tracking-[0.12em] uppercase">
          Mapachito coach
        </span>
        <strong className="font-display text-2xl leading-none uppercase">
          {readableLabel}
        </strong>
        {portrait.kind === "portrait" && visiblePortrait.source === null ? (
          <span role="status" className="text-sm font-bold">
            Artwork unavailable
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}
