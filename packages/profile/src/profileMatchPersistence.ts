import type { ActorRefFrom } from "xstate"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import type {
  MatchPersistence,
  MatchPersistenceReceipt,
  MatchPersistenceRequest,
} from "@mapachess/match/match-persistence"
import { canonicalActiveMatch } from "./durableMatchCodec.js"
import profileMachine, {
  selectCurrentPlayerData,
  type ProfileMachineSnapshot,
} from "./profileMachine.js"

type ProfileActor = ActorRefFrom<typeof profileMachine>

export type ProfileMatchPersistenceBridgeInput = Readonly<{
  actor: ProfileActor
  expectedActiveMatch: DurableMatchRecord | null
  initialMatch: DurableMatchRecord
}>

export type PersistProfileActiveMatchInput = Readonly<{
  actor: ProfileActor
  candidate: DurableMatchRecord | null
  expectedActiveMatch: DurableMatchRecord | null
  signal: AbortSignal
}>

const activeMatchesEqual = (
  left: DurableMatchRecord | null,
  right: DurableMatchRecord | null,
): boolean =>
  left === null || right === null
    ? left === right
    : JSON.stringify(canonicalActiveMatch(left)) ===
      JSON.stringify(canonicalActiveMatch(right))

const abortedPersistence = (): DOMException =>
  new DOMException("Match persistence was aborted.", "AbortError")

const actorStopped = (): Error =>
  new Error("Profile actor stopped before match persistence completed.")

const activeMatchChanged = (): Error =>
  new Error("Canonical active match changed before persistence completed.")

export const persistProfileActiveMatch = ({
  actor,
  candidate,
  expectedActiveMatch,
  signal,
}: PersistProfileActiveMatchInput): Promise<void> => {
  if (signal.aborted) return Promise.reject(abortedPersistence())

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let writeRequested = false
    let subscription: Readonly<{ unsubscribe: () => void }> | null = null

    const cleanup = (): void => {
      signal.removeEventListener("abort", onAbort)
      subscription?.unsubscribe()
    }
    const settle = (result: "accepted" | Error): void => {
      if (settled) return
      settled = true
      cleanup()
      if (result === "accepted") resolve()
      else reject(result)
    }
    const onAbort = (): void => settle(abortedPersistence())
    const inspect = (snapshot: ProfileMachineSnapshot): void => {
      if (settled) return
      const playerData = selectCurrentPlayerData(snapshot)
      if (activeMatchesEqual(playerData?.activeMatch ?? null, candidate)) {
        settle("accepted")
        return
      }
      if (!snapshot.matches("ready") || writeRequested) return
      if (
        playerData === null ||
        !activeMatchesEqual(playerData.activeMatch, expectedActiveMatch)
      ) {
        settle(activeMatchChanged())
        return
      }

      writeRequested = true
      actor.send({
        activeMatch: candidate,
        type: "PROFILE.ACTIVE_MATCH_SAVE_REQUESTED",
      })
    }

    signal.addEventListener("abort", onAbort, { once: true })
    subscription = actor.subscribe({
      complete: () => settle(actorStopped()),
      error: (error: unknown) =>
        settle(error instanceof Error ? error : actorStopped()),
      next: inspect,
    })
    if (settled) subscription.unsubscribe()
    else inspect(actor.getSnapshot())
  })
}

const candidateFromRequest = (
  initialMatch: DurableMatchRecord,
  request: MatchPersistenceRequest,
): DurableMatchRecord => {
  if (request.matchId !== initialMatch.matchId) {
    throw new TypeError("Match persistence request has a different matchId.")
  }
  if (request.moveHintsUsed && !request.pieceHintsUsed) {
    throw new TypeError("Move Hint use requires Piece Hint use.")
  }

  return Object.freeze({
    ...initialMatch,
    conclusion: request.conclusion,
    currentFen: request.currentFen,
    cursor: request.cursor,
    moveHintsUsed: request.moveHintsUsed,
    moveIds: Object.freeze([...request.moveIds]),
    pieceHintsUsed: request.pieceHintsUsed,
  })
}

const requireMonotonicHintUse = (
  accepted: DurableMatchRecord,
  candidate: DurableMatchRecord,
): void => {
  if (
    (accepted.pieceHintsUsed && !candidate.pieceHintsUsed) ||
    (accepted.moveHintsUsed && !candidate.moveHintsUsed)
  ) {
    throw new TypeError("Persisted hint use cannot move backward.")
  }
}

const conclusionsEqual = (
  left: DurableMatchRecord["conclusion"],
  right: DurableMatchRecord["conclusion"],
): boolean =>
  left?.type === right?.type &&
  (left?.type !== "checkmate" && left?.type !== "resignation"
    ? true
    : right?.type === left.type && right.winner === left.winner)

const requireMonotonicConclusion = (
  accepted: DurableMatchRecord,
  candidate: DurableMatchRecord,
): void => {
  if (
    accepted.conclusion !== null &&
    !conclusionsEqual(accepted.conclusion, candidate.conclusion)
  ) {
    throw new TypeError("Persisted match conclusion cannot change.")
  }
}

export default class ProfileMatchPersistenceBridge implements MatchPersistence {
  readonly #actor: ProfileActor
  readonly #initialMatch: DurableMatchRecord
  #acceptedMatch: DurableMatchRecord | null
  #established = false

  constructor(input: ProfileMatchPersistenceBridgeInput) {
    if (
      input.expectedActiveMatch !== null &&
      input.expectedActiveMatch.matchId !== input.initialMatch.matchId
    ) {
      throw new TypeError("Expected and initial matches have different IDs.")
    }

    this.#actor = input.actor
    this.#acceptedMatch = input.expectedActiveMatch
    this.#initialMatch = input.initialMatch
  }

  async establish(signal: AbortSignal): Promise<void> {
    if (this.#established) return
    await this.#persistCandidate(this.#initialMatch, signal)
    this.#established = true
  }

  async persist(
    request: MatchPersistenceRequest,
    signal: AbortSignal,
  ): Promise<MatchPersistenceReceipt> {
    if (!this.#established || this.#acceptedMatch === null) {
      throw new Error("Match persistence bridge is not established.")
    }

    const candidate = candidateFromRequest(this.#initialMatch, request)
    requireMonotonicHintUse(this.#acceptedMatch, candidate)
    requireMonotonicConclusion(this.#acceptedMatch, candidate)
    await this.#persistCandidate(candidate, signal)
    return Object.freeze({
      requestId: request.requestId,
      type: "MATCH.MUTATION_PERSISTED",
    })
  }

  #persistCandidate(
    candidate: DurableMatchRecord,
    signal: AbortSignal,
  ): Promise<void> {
    return persistProfileActiveMatch({
      actor: this.#actor,
      candidate,
      expectedActiveMatch: this.#acceptedMatch,
      signal,
    }).then(() => {
      this.#acceptedMatch = candidate
    })
  }
}
