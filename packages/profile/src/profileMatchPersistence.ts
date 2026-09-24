import type { ActorRefFrom } from "xstate"
import type { ChallengeSetup } from "@mapachess/match/challenge-setup"
import reconstructDurableMatch from "@mapachess/match/durable-match-reconstruction"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import type {
  MatchPersistence,
  MatchPersistenceReceipt,
  MatchPersistenceRequest,
} from "@mapachess/match/match-persistence"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import { canonicalActiveMatch } from "./durableMatchCodec.js"
import decodeMoveFeedback from "./moveFeedbackCodec.js"
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
  challengeSetup?: ChallengeSetup
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
  challengeSetup,
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
      if (
        playerData !== null &&
        (challengeSetup === undefined
          ? activeMatchesEqual(playerData.activeMatch, candidate)
          : playerData.activeMatch?.matchId === candidate?.matchId) &&
        (challengeSetup === undefined ||
          (playerData.settings.challengeSetup.variant ===
            challengeSetup.variant &&
            playerData.activeMatch?.opponentTargetElo ===
              challengeSetup.difficultyTargetElo &&
            playerData.settings.challengeSetup.opponentId ===
              challengeSetup.opponentId &&
            playerData.settings.challengeSetup.difficultyTargetElo ===
              challengeSetup.difficultyTargetElo &&
            playerData.settings.challengeSetup.playerColor ===
              challengeSetup.playerColor &&
            playerData.settings.challengeSetup.chess960PositionId ===
              challengeSetup.chess960PositionId &&
            playerData.challengeHistory[
              challengeSetup.variant
            ].difficulties.some(
              (record) =>
                record.targetElo === challengeSetup.difficultyTargetElo &&
                record.lastPlayedAnimal === challengeSetup.opponentId,
            )))
      ) {
        settle("accepted")
        return
      }
      if (!snapshot.matches("ready") || writeRequested) return
      if (
        playerData === null ||
        (!(
          challengeSetup !== undefined &&
          playerData.activeMatch?.matchId === candidate?.matchId
        ) &&
          !activeMatchesEqual(playerData.activeMatch, expectedActiveMatch))
      ) {
        settle(activeMatchChanged())
        return
      }

      writeRequested = true
      actor.send({
        activeMatch:
          challengeSetup !== undefined &&
          playerData.activeMatch?.matchId === candidate?.matchId
            ? playerData.activeMatch
            : candidate,
        ...(challengeSetup === undefined ? {} : { challengeSetup }),
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

  let commonPly = 0
  while (
    commonPly < initialMatch.moveIds.length &&
    initialMatch.moveIds[commonPly] === request.moveIds[commonPly]
  )
    commonPly += 1

  return Object.freeze({
    ...initialMatch,
    ...(initialMatch.moveFeedback === undefined
      ? {}
      : {
          moveFeedback: initialMatch.moveFeedback.filter(
            ({ ply }) => ply <= commonPly,
          ),
        }),
    autoHintMode: request.autoHintMode,
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
  #pendingWrite: Promise<void> = Promise.resolve()

  #enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
    const write = this.#pendingWrite.then(operation)
    this.#pendingWrite = write.then(
      () => undefined,
      () => undefined,
    )
    return write
  }

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
    return this.#enqueue(async () => {
      if (!this.#established || this.#acceptedMatch === null) {
        throw new Error("Match persistence bridge is not established.")
      }

      const candidate = candidateFromRequest(this.#acceptedMatch, request)
      requireMonotonicHintUse(this.#acceptedMatch, candidate)
      requireMonotonicConclusion(this.#acceptedMatch, candidate)
      await this.#persistCandidate(candidate, signal)
      return Object.freeze({
        requestId: request.requestId,
        type: "MATCH.MUTATION_PERSISTED",
      })
    })
  }

  async persistMoveFeedback(
    record: MoveFeedbackRecord,
    signal: AbortSignal,
  ): Promise<boolean> {
    return this.#enqueue(async () => {
      if (!this.#established || this.#acceptedMatch === null)
        throw new Error("Match persistence bridge is not established.")
      if (signal.aborted) throw abortedPersistence()
      const accepted = this.#acceptedMatch
      const reconstruction = reconstructDurableMatch(accepted)
      if (!reconstruction.ok)
        throw new Error("Accepted match cannot be reconstructed.")
      const transition = reconstruction.timeline.transitions[record.ply - 1]
      if (
        transition === undefined ||
        transition.move.id !== record.moveId ||
        transition.before.fen !== record.beforeFen ||
        transition.after.fen !== record.afterFen
      )
        return false
      if (accepted.moveFeedback?.some(({ ply }) => ply === record.ply))
        return true
      const moveFeedback = decodeMoveFeedback(
        [...(accepted.moveFeedback ?? []), record].sort(
          (left, right) => left.ply - right.ply,
        ),
        reconstruction.timeline,
        "activeMatch.moveFeedback",
      )
      await this.#persistCandidate({ ...accepted, moveFeedback }, signal)
      return true
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
