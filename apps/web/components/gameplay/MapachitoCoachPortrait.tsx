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
    <figure aria-live="polite" className="flex items-center gap-2">
      <div className="bg-mapachito-violet size-10 shrink-0 overflow-hidden rounded">
        {visiblePortrait.source === null ? (
          <span
            aria-hidden="true"
            className="font-display text-mapachito-white grid size-full place-items-center text-2xl font-black"
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
        <span className="sr-only">Mapachito coach</span>
        <strong className="sr-only">{readableLabel}</strong>
        {portrait.kind === "portrait" && visiblePortrait.source === null ? (
          <span role="status" className="text-sm font-bold">
            Artwork unavailable
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}
