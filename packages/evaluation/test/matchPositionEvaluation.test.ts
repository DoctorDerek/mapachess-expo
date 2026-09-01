import { describe, expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import matchMachine, {
  selectIsPlayerTurn,
  selectMatchPosition,
  type MatchOpponentRequest,
} from "@mapachess/match/match-machine"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import type {
  MatchPersistence,
  MatchPersistenceReceipt,
  MatchPersistenceRequest,
} from "@mapachess/match/match-persistence"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import bindMatchPositionEvaluation from "../src/matchPositionEvaluation"
import type { PositionEvaluationMachineEvent } from "../src/positionEvaluationMachine"

type PendingPersistence = Readonly<{
  request: MatchPersistenceRequest
  resolve: (receipt: MatchPersistenceReceipt) => void
}>

class ControlledPersistence implements MatchPersistence {
  readonly pending: PendingPersistence[] = []
  readonly requests: MatchPersistenceRequest[] = []

  persist(request: MatchPersistenceRequest): Promise<MatchPersistenceReceipt> {
    this.requests.push(request)
    return new Promise((resolve) => {
      this.pending.push({ request, resolve })
    })
  }

  succeedNext(): void {
    const pending = this.pending.shift()
    if (pending === undefined) {
      throw new Error("No evaluation-binding persistence request to accept.")
    }
    pending.resolve({
      requestId: pending.request.requestId,
      type: "MATCH.MUTATION_PERSISTED",
    })
  }
}

const initialPosition = () =>
  createInitialMatchPosition({
    chess960PositionId: null,
    variant: "standard",
  })

const requireMoveId = (
  position: ReturnType<typeof initialPosition>,
  uci: string,
) => {
  const move = listLegalMatchMoves(position).find(
    (candidate) => candidate.uci === uci,
  )
  if (move === undefined) throw new Error(`Missing legal test move ${uci}.`)
  return move.id
}

const chooseE5 = async (request: MatchOpponentRequest) => {
  const move = request.legalMoves.find((candidate) => candidate.uci === "e7e5")
  if (move === undefined) throw new Error("Scripted e7e5 must be legal.")
  return move.id
}

describe("accepted match position evaluation binding", () => {
  it("requests only the initial and durably accepted positions", async () => {
    const persistence = new ControlledPersistence()
    const actor = createActor(matchMachine, {
      input: {
        autoHintsEnabled: false,
        durability: { persistence, type: "durable" },
        initialPosition: initialPosition(),
        matchId: "evaluation-binding",
        opponent: { selectMove: chooseE5 },
        playerColor: "white",
      },
    }).start()
    const send = vi.fn<(event: PositionEvaluationMachineEvent) => void>()
    const binding = bindMatchPositionEvaluation(actor, { send })
    const initial = selectMatchPosition(actor.getSnapshot())

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenLastCalledWith({
      request: {
        position: initial,
        requestId: `evaluation-binding/evaluation/cursor/0/fen/${initial.fen}`,
      },
      type: "EVALUATION.POSITION_REQUESTED",
    })

    actor.send({
      moveId: requireMoveId(initial, "e2e4"),
      type: "MATCH.MOVE_REQUESTED",
    })
    await waitFor(actor, (snapshot) => snapshot.matches("persistingMutation"))
    expect(selectMatchPosition(actor.getSnapshot())).toBe(initial)
    expect(send).toHaveBeenCalledTimes(1)

    persistence.succeedNext()
    await waitFor(actor, () => persistence.requests.length === 2)
    const acceptedPlayerPosition = selectMatchPosition(actor.getSnapshot())
    expect(acceptedPlayerPosition.fen).not.toBe(initial.fen)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenLastCalledWith({
      request: {
        position: acceptedPlayerPosition,
        requestId: `evaluation-binding/evaluation/cursor/1/fen/${acceptedPlayerPosition.fen}`,
      },
      type: "EVALUATION.POSITION_REQUESTED",
    })

    binding.disconnect()
    persistence.succeedNext()
    await waitFor(actor, selectIsPlayerTurn)
    expect(send).toHaveBeenCalledTimes(2)
    actor.stop()
  })
})
