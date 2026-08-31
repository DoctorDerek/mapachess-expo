import {
  freezeDurableStoreSnapshot,
  type DurableStoreAdapter,
  type DurableStoreSnapshot,
} from "./durableStoreContract.js"
import type { MapachessPlayerData } from "./playerData.js"
import type { Sha256HexDigest } from "./sha256.js"
import {
  decodeStoredPlayerData,
  encodeStoredPlayerData,
  type StoredPlayerDataDecodeIssue,
} from "./storedPlayerData.js"

export {
  durableStoreSnapshotsEqual,
  EMPTY_DURABLE_STORE_SNAPSHOT,
  type DurableStoreAdapter,
  type DurableStoreSnapshot,
  type DurableStoreWrite,
  type DurableStoreWriteResult,
} from "./durableStoreContract.js"

export type DurablePlayerDataSlot =
  | Readonly<{ type: "missing" }>
  | Readonly<{
      data: MapachessPlayerData
      raw: string
      type: "valid"
    }>
  | Readonly<{
      issue: StoredPlayerDataDecodeIssue
      raw: string
      type: "invalid"
    }>

export type LoadedDurablePlayerData = Readonly<{
  current: DurablePlayerDataSlot
  lastKnownGood: DurablePlayerDataSlot
  preImportBackup: DurablePlayerDataSlot
  snapshot: DurableStoreSnapshot
}>

export type DurablePlayerDataWriteFailure = Readonly<{
  type:
    | "PROFILE.CURRENT_DATA_INVALID"
    | "PROFILE.REVISION_INVALID"
    | "PROFILE.STORAGE_CONFLICT"
    | "PROFILE.STORAGE_VERIFICATION_FAILED"
}>

export type DurablePlayerDataWriteResult =
  | Readonly<{
      ok: true
      state: LoadedDurablePlayerData
    }>
  | Readonly<{
      failure: DurablePlayerDataWriteFailure
      ok: false
    }>

const decodedSlot = async (
  raw: string | null,
  sha256: Sha256HexDigest,
): Promise<DurablePlayerDataSlot> => {
  if (raw === null) return Object.freeze({ type: "missing" })

  const decoded = await decodeStoredPlayerData(raw, sha256)
  return decoded.ok
    ? Object.freeze({ data: decoded.data, raw, type: "valid" })
    : Object.freeze({ issue: decoded.issue, raw, type: "invalid" })
}

const loadedState = async (
  snapshot: DurableStoreSnapshot,
  sha256: Sha256HexDigest,
): Promise<LoadedDurablePlayerData> => {
  const frozenSnapshot = freezeDurableStoreSnapshot(snapshot)
  const [current, lastKnownGood, preImportBackup] = await Promise.all([
    decodedSlot(frozenSnapshot.current, sha256),
    decodedSlot(frozenSnapshot.lastKnownGood, sha256),
    decodedSlot(frozenSnapshot.preImportBackup, sha256),
  ])
  return Object.freeze({
    current,
    lastKnownGood,
    preImportBackup,
    snapshot: frozenSnapshot,
  })
}

const writeFailure = (
  type: DurablePlayerDataWriteFailure["type"],
): DurablePlayerDataWriteResult => ({
  failure: Object.freeze({ type }),
  ok: false,
})

const requiredNextRevision = (current: DurablePlayerDataSlot): number => {
  if (current.type === "invalid") {
    throw new Error("Invalid current data has no implicit next revision.")
  }
  return current.type === "missing" ? 0 : current.data.revision + 1
}

export default class SerializedPlayerDataStore {
  readonly #adapter: DurableStoreAdapter
  readonly #sha256: Sha256HexDigest
  #operationTail: Promise<void> = Promise.resolve()

  constructor(adapter: DurableStoreAdapter, sha256: Sha256HexDigest) {
    this.#adapter = adapter
    this.#sha256 = sha256
  }

  load(): Promise<LoadedDurablePlayerData> {
    return this.#serialize(async () =>
      loadedState(await this.#adapter.read(), this.#sha256),
    )
  }

  commitCurrent(
    expected: LoadedDurablePlayerData,
    candidate: MapachessPlayerData,
  ): Promise<DurablePlayerDataWriteResult> {
    return this.#serialize(async () => {
      if (expected.current.type === "invalid") {
        return writeFailure("PROFILE.CURRENT_DATA_INVALID")
      }
      if (candidate.revision !== requiredNextRevision(expected.current)) {
        return writeFailure("PROFILE.REVISION_INVALID")
      }

      return this.#writeCandidate(expected, candidate, false)
    })
  }

  replaceWithImportedData(
    expected: LoadedDurablePlayerData,
    imported: MapachessPlayerData,
  ): Promise<DurablePlayerDataWriteResult> {
    return this.#serialize(async () => {
      if (expected.current.type === "invalid") {
        return writeFailure("PROFILE.CURRENT_DATA_INVALID")
      }

      const candidate = Object.freeze({
        ...imported,
        revision: requiredNextRevision(expected.current),
      })
      return this.#writeCandidate(expected, candidate, true)
    })
  }

  async #writeCandidate(
    expected: LoadedDurablePlayerData,
    candidate: MapachessPlayerData,
    preservePreImportBackup: boolean,
  ): Promise<DurablePlayerDataWriteResult> {
    const encodedCandidate = await encodeStoredPlayerData(
      candidate,
      this.#sha256,
    )
    const previousValidCurrent =
      expected.current.type === "valid" ? expected.current.raw : null
    const nextSnapshot = freezeDurableStoreSnapshot({
      current: encodedCandidate,
      lastKnownGood: previousValidCurrent ?? expected.snapshot.lastKnownGood,
      preImportBackup: preservePreImportBackup
        ? previousValidCurrent
        : expected.snapshot.preImportBackup,
    })
    const writeResult = await this.#adapter.compareAndSwapVerified({
      expected: expected.snapshot,
      next: nextSnapshot,
    })
    if (!writeResult.ok) return writeFailure(writeResult.type)

    return {
      ok: true,
      state: await loadedState(writeResult.snapshot, this.#sha256),
    }
  }

  #serialize<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.#operationTail.then(operation, operation)
    this.#operationTail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
}
