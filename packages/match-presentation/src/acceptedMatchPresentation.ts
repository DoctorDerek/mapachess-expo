import { createActor, type ActorRefFrom } from "xstate"
import type matchMachine from "@mapachess/match/match-machine"
import {
  selectMatchConclusion,
  selectMatchTimeline,
} from "@mapachess/match/match-machine"
import type { MatchColor } from "@mapachess/match/match-position"
import matchPresentationMachine from "./matchPresentationMachine.js"
import {
  deriveAcceptedMatchPresentationUpdate,
  deriveConcludingMatchPresentationPhases,
  deriveConclusionPresentationPhase,
  type AcceptedMatchPresentationObservation,
} from "./matchPresentationObservation.js"
import type { MatchPresentationPhase } from "./matchReaction.js"

export type AcceptedMatchPresentationBinding = Readonly<{
  actor: ActorRefFrom<typeof matchPresentationMachine>
  replay: () => void
  close: () => void
}>

export default function bindAcceptedMatchPresentation(
  matchActor: ActorRefFrom<typeof matchMachine>,
  playerColor: MatchColor,
  providedActor?: ActorRefFrom<typeof matchPresentationMachine>,
): AcceptedMatchPresentationBinding {
  const observation = (): AcceptedMatchPresentationObservation => {
    const snapshot = matchActor.getSnapshot()
    return {
      conclusion: selectMatchConclusion(snapshot),
      timeline: selectMatchTimeline(snapshot),
    }
  }
  let previous = observation()
  const actor =
    providedActor ??
    createActor(matchPresentationMachine, {
      input: {
        initialConclusionPhase:
          previous.conclusion === null
            ? null
            : deriveConclusionPresentationPhase({
                conclusion: previous.conclusion,
                playerColor,
              }),
      },
    }).start()
  const request = (phases: readonly MatchPresentationPhase[]): void => {
    const [first, ...rest] = phases
    if (first !== undefined)
      actor.send({
        type: "MATCH_PRESENTATION.REACTIONS_REQUESTED",
        phases: [first, ...rest],
      })
  }
  const subscription = matchActor.subscribe(() => {
    const current = observation()
    const update = deriveAcceptedMatchPresentationUpdate(
      previous,
      current,
      playerColor,
    )
    previous = current
    if (update.reset) actor.send({ type: "MATCH_PRESENTATION.RESET_REQUESTED" })
    request(update.phases)
  })
  return {
    actor,
    replay: () => {
      actor.send({ type: "MATCH_PRESENTATION.RESET_REQUESTED" })
      request(
        deriveConcludingMatchPresentationPhases(observation(), playerColor),
      )
    },
    close: () => {
      subscription.unsubscribe()
      if (providedActor === undefined) actor.stop()
    },
  }
}
