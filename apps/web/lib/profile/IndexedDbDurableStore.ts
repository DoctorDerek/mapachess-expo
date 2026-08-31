import type {
  DurableStoreAdapter,
  DurableStoreSnapshot,
  DurableStoreWrite,
  DurableStoreWriteResult,
} from "@mapachess/profile/durable-store-contract"
import { durableStoreSnapshotsEqual } from "@mapachess/profile/durable-store-contract"

export const MAPACHESS_INDEXED_DB_NAME = "mapachess-player-data" as const
export const MAPACHESS_INDEXED_DB_PLAYER_DATA_STORE =
  "durable-player-data" as const
export const MAPACHESS_INDEXED_DB_CURRENT_KEY = "current" as const

const DATABASE_VERSION = 1
const LAST_KNOWN_GOOD_KEY = "last-known-good"
const PRE_IMPORT_BACKUP_KEY = "pre-import-backup"

const requestResult = <Result>(request: IDBRequest<Result>): Promise<Result> =>
  new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    })
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB request failed.")),
      { once: true },
    )
  })

const transactionCompletion = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true })
    transaction.addEventListener(
      "abort",
      () =>
        reject(
          transaction.error ?? new Error("IndexedDB transaction aborted."),
        ),
      { once: true },
    )
    transaction.addEventListener(
      "error",
      () =>
        reject(transaction.error ?? new Error("IndexedDB transaction failed.")),
      { once: true },
    )
  })

const storedString = (received: unknown): string | null => {
  if (received === undefined) return null
  if (typeof received === "string") return received
  throw new TypeError(
    "Mapachess IndexedDB contains a non-string durable value.",
  )
}

const readSnapshot = async (
  objectStore: IDBObjectStore,
): Promise<DurableStoreSnapshot> => {
  const [current, lastKnownGood, preImportBackup] = await Promise.all([
    requestResult(objectStore.get(MAPACHESS_INDEXED_DB_CURRENT_KEY)),
    requestResult(objectStore.get(LAST_KNOWN_GOOD_KEY)),
    requestResult(objectStore.get(PRE_IMPORT_BACKUP_KEY)),
  ])

  return Object.freeze({
    current: storedString(current),
    lastKnownGood: storedString(lastKnownGood),
    preImportBackup: storedString(preImportBackup),
  })
}

const writeStoredValue = (
  objectStore: IDBObjectStore,
  key: string,
  value: string | null,
): Promise<IDBValidKey | undefined> =>
  value === null
    ? requestResult(objectStore.delete(key))
    : requestResult(objectStore.put(value, key))

const writeSnapshot = (
  objectStore: IDBObjectStore,
  snapshot: DurableStoreSnapshot,
): Promise<readonly (IDBValidKey | undefined)[]> =>
  Promise.all([
    writeStoredValue(
      objectStore,
      MAPACHESS_INDEXED_DB_CURRENT_KEY,
      snapshot.current,
    ),
    writeStoredValue(objectStore, LAST_KNOWN_GOOD_KEY, snapshot.lastKnownGood),
    writeStoredValue(
      objectStore,
      PRE_IMPORT_BACKUP_KEY,
      snapshot.preImportBackup,
    ),
  ])

const openDatabase = (
  indexedDb: IDBFactory,
  databaseName: string,
): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDb.open(databaseName, DATABASE_VERSION)
    request.addEventListener(
      "upgradeneeded",
      () => {
        if (
          !request.result.objectStoreNames.contains(
            MAPACHESS_INDEXED_DB_PLAYER_DATA_STORE,
          )
        ) {
          request.result.createObjectStore(
            MAPACHESS_INDEXED_DB_PLAYER_DATA_STORE,
          )
        }
      },
      { once: true },
    )
    request.addEventListener(
      "success",
      () => {
        const database = request.result
        database.addEventListener("versionchange", () => database.close())
        resolve(database)
      },
      { once: true },
    )
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB could not open.")),
      { once: true },
    )
    request.addEventListener(
      "blocked",
      () => reject(new Error("IndexedDB upgrade is blocked.")),
      { once: true },
    )
  })

export default class IndexedDbDurableStore implements DurableStoreAdapter {
  readonly #databaseName: string
  readonly #indexedDb: IDBFactory
  #databasePromise: Promise<IDBDatabase> | null = null

  constructor(
    indexedDb: IDBFactory,
    databaseName: string = MAPACHESS_INDEXED_DB_NAME,
  ) {
    this.#databaseName = databaseName
    this.#indexedDb = indexedDb
  }

  async read(): Promise<DurableStoreSnapshot> {
    const database = await this.#database()
    const transaction = database.transaction(
      MAPACHESS_INDEXED_DB_PLAYER_DATA_STORE,
      "readonly",
    )
    const completion = transactionCompletion(transaction)
    const snapshot = await readSnapshot(
      transaction.objectStore(MAPACHESS_INDEXED_DB_PLAYER_DATA_STORE),
    )
    await completion
    return snapshot
  }

  async compareAndSwapVerified(
    write: DurableStoreWrite,
  ): Promise<DurableStoreWriteResult> {
    const database = await this.#database()
    const transaction = database.transaction(
      MAPACHESS_INDEXED_DB_PLAYER_DATA_STORE,
      "readwrite",
    )
    const completion = transactionCompletion(transaction)
    const objectStore = transaction.objectStore(
      MAPACHESS_INDEXED_DB_PLAYER_DATA_STORE,
    )
    const actual = await readSnapshot(objectStore)
    if (!durableStoreSnapshotsEqual(actual, write.expected)) {
      await completion
      return { actual, ok: false, type: "PROFILE.STORAGE_CONFLICT" }
    }

    await writeSnapshot(objectStore, write.next)
    const readback = await readSnapshot(objectStore)
    if (!durableStoreSnapshotsEqual(readback, write.next)) {
      transaction.abort()
      await completion.catch(() => undefined)
      return {
        actual: await this.read(),
        ok: false,
        type: "PROFILE.STORAGE_VERIFICATION_FAILED",
      }
    }

    await completion
    return { ok: true, snapshot: readback }
  }

  async close(): Promise<void> {
    const databasePromise = this.#databasePromise
    this.#databasePromise = null
    if (databasePromise !== null) (await databasePromise).close()
  }

  #database(): Promise<IDBDatabase> {
    this.#databasePromise ??= openDatabase(
      this.#indexedDb,
      this.#databaseName,
    ).catch((error: unknown) => {
      this.#databasePromise = null
      throw error
    })
    return this.#databasePromise
  }
}
