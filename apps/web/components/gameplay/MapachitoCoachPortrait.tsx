"use client"

import resolveCoachPortrait, {
  COACH_COLLECTIONS,
  COACH_PORTRAIT_NAMES,
  type CoachMoveReaction,
} from "@mapachess/match-presentation/coach-portrait"
import { selectMatchPresentationVariationOrdinal } from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationMachineSnapshot } from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchParticipantReaction } from "@mapachess/match-presentation/match-reaction"
import { useCoachCollection } from "../../lib/presentation/CoachCollectionContext"
import useDecodedCoachPortrait from "../../lib/presentation/useDecodedCoachPortrait"
import { availableCoachPortraits } from "../../lib/presentation/webPresentationAssets"
import CoachPortraitImage from "../presentation/CoachPortraitImage"

const IDLE_REACTION = Object.freeze({
  family: "idle",
}) satisfies MatchParticipantReaction

export type MapachitoCoachPortraitProps = Readonly<{
  presentationSnapshot: MatchPresentationMachineSnapshot
  moveReaction?: CoachMoveReaction | null
}>

export default function MapachitoCoachPortrait({
  presentationSnapshot,
  moveReaction = null,
}: MapachitoCoachPortraitProps) {
  const collection = useCoachCollection()
  const playerReaction =
    presentationSnapshot.context.currentPhase?.player ?? IDLE_REACTION
  const portrait = resolveCoachPortrait(
    playerReaction.family === "idle" && moveReaction !== null
      ? moveReaction
      : playerReaction,
    availableCoachPortraits(collection),
    selectMatchPresentationVariationOrdinal(presentationSnapshot, "player"),
  )
  const visiblePortrait = useDecodedCoachPortrait(portrait, collection)
  const readableLabel = COACH_PORTRAIT_NAMES[visiblePortrait.label]

  return (
    <figure aria-live="polite" className="flex items-center gap-2">
      <div className="bg-mapachito-violet size-10 shrink-0 overflow-hidden rounded">
        <CoachPortraitImage portrait={visiblePortrait} />
      </div>
      <figcaption className="grid gap-1">
        <span className="sr-only">
          {COACH_COLLECTIONS[visiblePortrait.collection].label} coach
        </span>
        <strong className="sr-only">{readableLabel}</strong>
        {visiblePortrait.unavailable ? (
          <span role="status" className="text-sm font-bold">
            Artwork unavailable.{" "}
            <button
              type="button"
              onClick={visiblePortrait.retry}
              className="cursor-pointer underline focus-visible:outline-2"
            >
              Retry artwork
            </button>
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}
