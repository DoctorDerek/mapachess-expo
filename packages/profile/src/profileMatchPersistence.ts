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
        if (result === "accepted") {
          this.#acceptedMatch = candidate
          resolve()
        } else {
          reject(result)
        }
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
          !activeMatchesEqual(playerData.activeMatch, this.#acceptedMatch)
        ) {
          settle(activeMatchChanged())
          return
        }

        writeRequested = true
        this.#actor.send({
          activeMatch: candidate,
          type: "PROFILE.ACTIVE_MATCH_SAVE_REQUESTED",
        })
      }

      signal.addEventListener("abort", onAbort, { once: true })
      subscription = this.#actor.subscribe({
        complete: () => settle(actorStopped()),
        error: (error: unknown) =>
          settle(error instanceof Error ? error : actorStopped()),
        next: inspect,
      })
      if (settled) subscription.unsubscribe()
      else inspect(this.#actor.getSnapshot())
    })
  }
}
