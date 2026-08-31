export type DurableStoreSnapshot = Readonly<{
  current: string | null
  lastKnownGood: string | null
  preImportBackup: string | null
}>

export type DurableStoreWrite = Readonly<{
  expected: DurableStoreSnapshot
  next: DurableStoreSnapshot
}>

export type DurableStoreWriteResult =
  | Readonly<{
      ok: true
      snapshot: DurableStoreSnapshot
    }>
  | Readonly<{
      actual: DurableStoreSnapshot
      ok: false
      type: "PROFILE.STORAGE_CONFLICT" | "PROFILE.STORAGE_VERIFICATION_FAILED"
    }>

export type DurableStoreAdapter = Readonly<{
  compareAndSwapVerified: (
    write: DurableStoreWrite,
  ) => Promise<DurableStoreWriteResult>
  read: () => Promise<DurableStoreSnapshot>
}>

export const freezeDurableStoreSnapshot = (
  snapshot: DurableStoreSnapshot,
): DurableStoreSnapshot =>
  Object.freeze({
    current: snapshot.current,
    lastKnownGood: snapshot.lastKnownGood,
    preImportBackup: snapshot.preImportBackup,
  })

export const durableStoreSnapshotsEqual = (
  left: DurableStoreSnapshot,
  right: DurableStoreSnapshot,
): boolean =>
  left.current === right.current &&
  left.lastKnownGood === right.lastKnownGood &&
  left.preImportBackup === right.preImportBackup

export const EMPTY_DURABLE_STORE_SNAPSHOT = freezeDurableStoreSnapshot({
  current: null,
  lastKnownGood: null,
  preImportBackup: null,
})
