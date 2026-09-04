import { assign, setup, type SnapshotFrom } from "xstate"
import {
  MATCH_PRESENTATION_PARTICIPANTS,
  type MatchPresentationParticipant,
  type MatchPresentationPhase,
} from "./matchReaction.js"

export type MatchPresentationMachineInput = Readonly<{
  initialConclusionPhase: MatchPresentationPhase | null
}>

export type MatchPresentationMachineEvent =
  | Readonly<{
      phases: readonly [MatchPresentationPhase, ...MatchPresentationPhase[]]
      type: "MATCH_PRESENTATION.REACTIONS_REQUESTED"
    }>
  | Readonly<{
      type: "MATCH_PRESENTATION.RESET_REQUESTED"
    }>
  | Readonly<{
      participant: MatchPresentationParticipant
      phaseIndex: number
      reactionSequence: number
      type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED"
    }>

type MatchPresentationMachineContext = Readonly<{
  currentPhase: MatchPresentationPhase | null
  pendingParticipants: readonly MatchPresentationParticipant[]
  phaseIndex: number
  reactionSequence: number
  remainingPhases: readonly MatchPresentationPhase[]
}>

const noParticipants: readonly MatchPresentationParticipant[] = Object.freeze(
  [],
)
const allParticipants = MATCH_PRESENTATION_PARTICIPANTS

const requireTerminalPhase = (
  phase: MatchPresentationPhase | undefined,
): MatchPresentationPhase => {
  if (phase?.kind !== "conclusion") {
    throw new TypeError("Match presentation terminal phase is missing.")
  }
  return phase
}

const createInitialContext = ({
  initialConclusionPhase,
}: MatchPresentationMachineInput): MatchPresentationMachineContext => {
  if (
    initialConclusionPhase !== null &&
    initialConclusionPhase.kind !== "conclusion"
  ) {
    throw new TypeError(
      "Initial match presentation phase must be a conclusion.",
    )
  }

  return Object.freeze({
    currentPhase: initialConclusionPhase,
    pendingParticipants: noParticipants,
    phaseIndex: 0,
    reactionSequence: 0,
    remainingPhases: Object.freeze([]),
  })
}

const requireRequestedReactions = (
  event: MatchPresentationMachineEvent,
): Extract<
  MatchPresentationMachineEvent,
  { type: "MATCH_PRESENTATION.REACTIONS_REQUESTED" }
> => {
  if (event.type !== "MATCH_PRESENTATION.REACTIONS_REQUESTED") {
    throw new TypeError("Match presentation reactions were not requested.")
  }
  return event
}

const requireParticipantCompletion = (
  event: MatchPresentationMachineEvent,
): Extract<
  MatchPresentationMachineEvent,
  { type: "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED" }
> => {
  if (event.type !== "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED") {
    throw new TypeError("Match presentation participant did not complete.")
  }
  return event
}

const completionMatchesCurrentPhase = (
  context: MatchPresentationMachineContext,
  event: MatchPresentationMachineEvent,
): boolean => {
  const completion = requireParticipantCompletion(event)
  return (
    completion.reactionSequence === context.reactionSequence &&
    completion.phaseIndex === context.phaseIndex &&
    context.pendingParticipants.includes(completion.participant)
  )
}

const completionFinishesCurrentPhase = (
  context: MatchPresentationMachineContext,
  event: MatchPresentationMachineEvent,
): boolean => {
  const completion = requireParticipantCompletion(event)
  return (
    completionMatchesCurrentPhase(context, event) &&
    context.pendingParticipants.length === 1 &&
    context.pendingParticipants[0] === completion.participant
  )
}

const matchPresentationMachine = setup({
  types: {
    context: {} as MatchPresentationMachineContext,
    events: {} as MatchPresentationMachineEvent,
    input: {} as MatchPresentationMachineInput,
  },
  actions: {
    advanceToTerminalPhase: assign(({ context }) => ({
      currentPhase: requireTerminalPhase(context.remainingPhases[0]),
      pendingParticipants: noParticipants,
      phaseIndex: context.phaseIndex + 1,
      remainingPhases: Object.freeze([]),
    })),
    advanceToNextPhase: assign(({ context }) => {
      const [currentPhase, ...remainingPhases] = context.remainingPhases
      if (currentPhase === undefined) {
        throw new Error("Match presentation has no next reaction phase.")
      }

      return {
        currentPhase,
        pendingParticipants: allParticipants,
        phaseIndex: context.phaseIndex + 1,
        remainingPhases: Object.freeze(remainingPhases),
      }
    }),
    recordParticipantCompletion: assign(({ context, event }) => {
      const completion = requireParticipantCompletion(event)
      return {
        pendingParticipants: Object.freeze(
          context.pendingParticipants.filter(
            (participant) => participant !== completion.participant,
          ),
        ),
      }
    }),
    resetPresentation: assign(({ context }) => ({
      currentPhase: null,
      pendingParticipants: noParticipants,
      phaseIndex: 0,
      reactionSequence: context.reactionSequence + 1,
      remainingPhases: Object.freeze([]),
    })),
    startRequestedReactions: assign(({ context, event }) => {
      const request = requireRequestedReactions(event)
      const [currentPhase, ...remainingPhases] = request.phases

      return {
        currentPhase,
        pendingParticipants: allParticipants,
        phaseIndex: 0,
        reactionSequence: context.reactionSequence + 1,
        remainingPhases: Object.freeze(remainingPhases),
      }
    }),
    startTerminalReaction: assign(({ context, event }) => {
      const request = requireRequestedReactions(event)
      return {
        currentPhase: requireTerminalPhase(request.phases[0]),
        pendingParticipants: noParticipants,
        phaseIndex: 0,
        reactionSequence: context.reactionSequence + 1,
        remainingPhases: Object.freeze([]),
      }
    }),
  },
  guards: {
    completionFinishesFinalTransientPhase: ({ context, event }) =>
      completionFinishesCurrentPhase(context, event) &&
      context.currentPhase?.kind !== "conclusion" &&
      context.remainingPhases.length === 0,
    completionFinishesPhaseWithNext: ({ context, event }) =>
      completionFinishesCurrentPhase(context, event) &&
      context.remainingPhases.length > 0 &&
      context.remainingPhases[0]?.kind !== "conclusion",
    completionReachesTerminalPhase: ({ context, event }) =>
      completionFinishesCurrentPhase(context, event) &&
      context.remainingPhases[0]?.kind === "conclusion",
    completionMatchesCurrentPhase: ({ context, event }) =>
      completionMatchesCurrentPhase(context, event),
    hasInitialConclusion: ({ context }) => context.currentPhase !== null,
    requestStartsWithConclusion: ({ event }) =>
      requireRequestedReactions(event).phases[0].kind === "conclusion",
  },
}).createMachine({
  id: "matchPresentation",
  initial: "initializing",
  context: ({ input }) => createInitialContext(input),
  on: {
    "MATCH_PRESENTATION.REACTIONS_REQUESTED": [
      {
        actions: "startTerminalReaction",
        guard: "requestStartsWithConclusion",
        target: ".terminal",
      },
      {
        actions: "startRequestedReactions",
        target: ".reacting",
      },
    ],
    "MATCH_PRESENTATION.RESET_REQUESTED": {
      actions: "resetPresentation",
      target: ".idle",
    },
  },
  states: {
    initializing: {
      always: [
        { guard: "hasInitialConclusion", target: "terminal" },
        { target: "idle" },
      ],
    },
    idle: {},
    reacting: {
      on: {
        "MATCH_PRESENTATION.PARTICIPANT_ANIMATION_COMPLETED": [
          {
            actions: "advanceToTerminalPhase",
            guard: "completionReachesTerminalPhase",
            target: "terminal",
          },
          {
            actions: "advanceToNextPhase",
            guard: "completionFinishesPhaseWithNext",
          },
          {
            actions: "resetPresentation",
            guard: "completionFinishesFinalTransientPhase",
            target: "idle",
          },
          {
            actions: "recordParticipantCompletion",
            guard: "completionMatchesCurrentPhase",
          },
        ],
      },
    },
    terminal: {},
  },
})

export type MatchPresentationMachineSnapshot = SnapshotFrom<
  typeof matchPresentationMachine
>

export default matchPresentationMachine
