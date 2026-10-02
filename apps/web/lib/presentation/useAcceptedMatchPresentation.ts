"use client"

import { useActorRef, useSelector } from "@xstate/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ActorRefFrom } from "xstate"
import matchPresentationMachine from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationMachineSnapshot } from "@mapachess/match-presentation/match-presentation-machine"
import {
  deriveAcceptedMatchPresentationUpdate,
  deriveConcludingMatchPresentationPhases,
  deriveConclusionPresentationPhase,
  type AcceptedMatchPresentationObservation,
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
  if (firstPhase === undefined) return

  presentationActor.send({
    phases: Object.freeze([firstPhase, ...remainingPhases]),
    type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
  })
}

export default function useAcceptedMatchPresentation(
  matchSnapshot: MatchMachineSnapshot,
  playerColor: MatchColor,
  rewardsReplaySequence: number,
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
  const previousObservation =
    useRef<AcceptedMatchPresentationObservation>(currentObservation)
  const previousReplaySequence = useRef(rewardsReplaySequence)

  useEffect(() => {
    const update = deriveAcceptedMatchPresentationUpdate(
      previousObservation.current,
      currentObservation,
      playerColor,
    )
    previousObservation.current = currentObservation
    if (update.reset) {
      presentationActor.send({
        type: "MATCH_PRESENTATION.RESET_REQUESTED",
      })
    }
    requestPresentationPhases(presentationActor, update.phases)
  }, [currentObservation, playerColor, presentationActor])

  useEffect(() => {
    if (previousReplaySequence.current === rewardsReplaySequence) return
    previousReplaySequence.current = rewardsReplaySequence
    if (rewardsReplaySequence === 0) return
    presentationActor.send({ type: "MATCH_PRESENTATION.RESET_REQUESTED" })
    requestPresentationPhases(
      presentationActor,
      deriveConcludingMatchPresentationPhases(currentObservation, playerColor),
    )
  }, [
    currentObservation,
    playerColor,
    presentationActor,
    rewardsReplaySequence,
  ])

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
