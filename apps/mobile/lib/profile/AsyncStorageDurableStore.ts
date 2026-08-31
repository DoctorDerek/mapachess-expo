import type {
  DurableStoreAdapter,
  DurableStoreSnapshot,
  DurableStoreWrite,
  DurableStoreWriteResult,
} from "@mapachess/profile/durable-store-contract"
import { durableStoreSnapshotsEqual } from "@mapachess/profile/durable-store-contract"

export const MAPACHESS_ASYNC_STORAGE_NAMESPACE =
  "@mapachess/player-data/v1" as const

export type AsyncStorageValueStore = Readonly<{
  multiGet: (
    keys: readonly string[],
  ) => Promise<readonly (readonly [string, string | null])[]>
  multiRemove: (keys: readonly string[]) => Promise<void>
  multiSet: (entries: readonly (readonly [string, string])[]) => Promise<void>
}>

type NamespacedKeys = Readonly<{
  current: string
  lastKnownGood: string
  preImportBackup: string
}>

const namespacedKeys = (namespace: string): NamespacedKeys => {
  if (namespace.length === 0 || namespace !== namespace.trim()) {
    throw new TypeError("AsyncStorage namespace must be nonempty and trimmed.")
  }
  return Object.freeze({
    current: `${namespace}/current`,
    lastKnownGood: `${namespace}/last-known-good`,
    preImportBackup: `${namespace}/pre-import-backup`,
  })
}

const snapshotEntries = (
  keys: NamespacedKeys,
  snapshot: DurableStoreSnapshot,
): Readonly<{
  removals: readonly string[]
  writes: readonly (readonly [string, string])[]
}> => {
  const entries = [
    [keys.current, snapshot.current],
    [keys.lastKnownGood, snapshot.lastKnownGood],
    [keys.preImportBackup, snapshot.preImportBackup],
  ] as const

  return Object.freeze({
    removals: Object.freeze(
      entries.flatMap(([key, value]) => (value === null ? [key] : [])),
    ),
    writes: Object.freeze(
      entries.flatMap(([key, value]) =>
        value === null ? [] : [[key, value] as const],
      ),
    ),
  })
}

export default class AsyncStorageDurableStore implements DurableStoreAdapter {
  readonly #keys: NamespacedKeys
  readonly #storage: AsyncStorageValueStore
  #operationTail: Promise<void> = Promise.resolve()

  constructor(
    storage: AsyncStorageValueStore,
    namespace: string = MAPACHESS_ASYNC_STORAGE_NAMESPACE,
  ) {
    this.#keys = namespacedKeys(namespace)
    this.#storage = storage
  }

  read(): Promise<DurableStoreSnapshot> {
    return this.#serialize(() => this.#read())
  }

  compareAndSwapVerified(
    write: DurableStoreWrite,
  ): Promise<DurableStoreWriteResult> {
    return this.#serialize(async () => {
      const actual = await this.#read()
      if (!durableStoreSnapshotsEqual(actual, write.expected)) {
        return { actual, ok: false, type: "PROFILE.STORAGE_CONFLICT" }
      }

      const entries = snapshotEntries(this.#keys, write.next)
      if (entries.writes.length > 0) {
        await this.#storage.multiSet(entries.writes)
      }
      if (entries.removals.length > 0) {
        await this.#storage.multiRemove(entries.removals)
      }

      const readback = await this.#read()
      return durableStoreSnapshotsEqual(readback, write.next)
        ? { ok: true, snapshot: readback }
        : {
            actual: readback,
            ok: false,
            type: "PROFILE.STORAGE_VERIFICATION_FAILED",
          }
    })
  }

  async #read(): Promise<DurableStoreSnapshot> {
    const pairs = await this.#storage.multiGet([
      this.#keys.current,
      this.#keys.lastKnownGood,
      this.#keys.preImportBackup,
    ])
    const values = new Map(pairs)
    return Object.freeze({
      current: values.get(this.#keys.current) ?? null,
      lastKnownGood: values.get(this.#keys.lastKnownGood) ?? null,
      preImportBackup: values.get(this.#keys.preImportBackup) ?? null,
    })
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
