"use client"

import { useActorRef, useSelector } from "@xstate/react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ActorRefFrom } from "xstate"
import bindAcceptedMatchPresentation, {
  type AcceptedMatchPresentationBinding,
} from "@mapachess/match-presentation/accepted-match-presentation"
import matchPresentationMachine, {
  type MatchPresentationMachineSnapshot,
} from "@mapachess/match-presentation/match-presentation-machine"
import { deriveConclusionPresentationPhase } from "@mapachess/match-presentation/match-presentation-observation"
import type { MatchPresentationParticipant } from "@mapachess/match-presentation/match-reaction"
import type matchMachine from "@mapachess/match/match-machine"
import { selectMatchConclusion } from "@mapachess/match/match-machine"
import type { MatchColor } from "@mapachess/match/match-position"

export type AcceptedMatchPresentation = Readonly<{
  notifyParticipantAnimationCompleted: (
    participant: MatchPresentationParticipant,
    phaseIndex: number,
    reactionSequence: number,
  ) => void
  snapshot: MatchPresentationMachineSnapshot
}>

export default function useAcceptedMatchPresentation(
  matchActor: ActorRefFrom<typeof matchMachine>,
  playerColor: MatchColor,
  rewardsReplaySequence: number,
): AcceptedMatchPresentation {
  const [startingConclusionPhase] = useState(() => {
    const conclusion = selectMatchConclusion(matchActor.getSnapshot())
    return conclusion === null
      ? null
      : deriveConclusionPresentationPhase({ conclusion, playerColor })
  })
  const presentationActor = useActorRef(matchPresentationMachine, {
    input: { initialConclusionPhase: startingConclusionPhase },
  })
  const snapshot = useSelector(presentationActor, (current) => current)
  const binding = useRef<AcceptedMatchPresentationBinding | null>(null)
  const previousReplaySequence = useRef(rewardsReplaySequence)
  useEffect(() => {
    const opened = bindAcceptedMatchPresentation(
      matchActor,
      playerColor,
      presentationActor,
    )
    binding.current = opened
    return () => {
      binding.current = null
      opened.close()
    }
  }, [matchActor, playerColor, presentationActor])
  useEffect(() => {
    if (previousReplaySequence.current === rewardsReplaySequence) return
    previousReplaySequence.current = rewardsReplaySequence
    if (rewardsReplaySequence > 0) binding.current?.replay()
  }, [rewardsReplaySequence])
  const notifyParticipantAnimationCompleted = useCallback(
    (
      participant: MatchPresentationParticipant,
      phaseIndex: number,
      reactionSequence: number,
    ): void => {
      presentationActor.send({
        type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED",
        participant,
        phaseIndex,
        reactionSequence,
      })
    },
    [presentationActor],
  )
  return { notifyParticipantAnimationCompleted, snapshot }
}
