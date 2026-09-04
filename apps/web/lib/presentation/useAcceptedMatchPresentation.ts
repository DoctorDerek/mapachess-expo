"use client"

import { useActorRef, useSelector } from "@xstate/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ActorRefFrom } from "xstate"
import matchPresentationMachine from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationMachineSnapshot } from "@mapachess/match-presentation/match-presentation-machine"
import deriveAcceptedMovePresentationPhases, {
  deriveConclusionPresentationPhase,
} from "@mapachess/match-presentation/match-presentation-observation"
import type {
  MatchPresentationParticipant,
  MatchPresentationPhase,
} from "@mapachess/match-presentation/match-reaction"
import {
  selectMatchConclusion,
  selectMatchTimeline,
  type MatchMachineSnapshot,
} from "@mapachess/match/match-machine"
import type { MatchColor } from "@mapachess/match/match-position"
import type { MatchTimeline } from "@mapachess/match/match-timeline"

type ObservedMatchPresentationState = Readonly<{
  conclusion: ReturnType<typeof selectMatchConclusion>
  timeline: MatchTimeline
}>

export type AcceptedMatchPresentation = Readonly<{
  notifyParticipantAnimationCompleted: (
    participant: MatchPresentationParticipant,
    phaseIndex: number,
    reactionSequence: number,
  ) => void
  snapshot: MatchPresentationMachineSnapshot
}>

const initialConclusionPhase = (
  matchSnapshot: MatchMachineSnapshot,
  playerColor: MatchColor,
): MatchPresentationPhase | null => {
  const conclusion = selectMatchConclusion(matchSnapshot)
  return conclusion === null
    ? null
    : deriveConclusionPresentationPhase({ conclusion, playerColor })
}

const requestPresentationPhases = (
  presentationActor: ActorRefFrom<typeof matchPresentationMachine>,
  phases: readonly MatchPresentationPhase[],
): void => {
  const [firstPhase, ...remainingPhases] = phases
  if (firstPhase === undefined) {
    presentationActor.send({
      type: "MATCH_PRESENTATION.RESET_REQUESTED",
    })
    return
  }

  presentationActor.send({
    phases: Object.freeze([firstPhase, ...remainingPhases]),
    type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
  })
}

export default function useAcceptedMatchPresentation(
  matchSnapshot: MatchMachineSnapshot,
  playerColor: MatchColor,
): AcceptedMatchPresentation {
  const [startingConclusionPhase] = useState(() =>
    initialConclusionPhase(matchSnapshot, playerColor),
  )
  const presentationActor = useActorRef(matchPresentationMachine, {
    input: { initialConclusionPhase: startingConclusionPhase },
  })
  const presentationSnapshot = useSelector(
    presentationActor,
    (current) => current,
  )
  const currentConclusion = selectMatchConclusion(matchSnapshot)
  const currentTimeline = selectMatchTimeline(matchSnapshot)
  const currentObservation = useMemo(
    () =>
      Object.freeze({
        conclusion: currentConclusion,
        timeline: currentTimeline,
      }),
    [currentConclusion, currentTimeline],
  )
  const previousObservation = useRef(currentObservation)

  useEffect(() => {
    const previous = previousObservation.current
    const current = currentObservation
    const transitionsChanged =
      current.timeline.transitions !== previous.timeline.transitions
    const cursorChanged = current.timeline.cursor !== previous.timeline.cursor

    if (
      transitionsChanged &&
      current.timeline.cursor > 0 &&
      current.timeline.cursor === current.timeline.transitions.length
    ) {
      const transition = current.timeline.transitions.at(-1)
      if (transition === undefined) {
        throw new Error("Accepted presentation move has no transition.")
      }
      requestPresentationPhases(
        presentationActor,
        deriveAcceptedMovePresentationPhases({
          conclusion: current.conclusion,
          playerColor,
          transition,
        }),
      )
    } else if (transitionsChanged || cursorChanged) {
      presentationActor.send({
        type: "MATCH_PRESENTATION.RESET_REQUESTED",
      })
    } else if (current.conclusion !== previous.conclusion) {
      const conclusionPhase =
        current.conclusion === null
          ? null
          : deriveConclusionPresentationPhase({
              conclusion: current.conclusion,
              playerColor,
            })
      requestPresentationPhases(
        presentationActor,
        conclusionPhase === null ? [] : [conclusionPhase],
      )
    }

    previousObservation.current = current
  }, [currentObservation, playerColor, presentationActor])

  const notifyParticipantAnimationCompleted = useCallback(
    (
      participant: MatchPresentationParticipant,
      phaseIndex: number,
      reactionSequence: number,
    ): void => {
      presentationActor.send({
        participant,
        phaseIndex,
        reactionSequence,
        type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED",
      })
    },
    [presentationActor],
  )

  return Object.freeze({
    notifyParticipantAnimationCompleted,
    snapshot: presentationSnapshot,
  })
}
