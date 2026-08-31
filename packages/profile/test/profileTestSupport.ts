import { createHash } from "node:crypto"
import {
  durableStoreSnapshotsEqual,
  EMPTY_DURABLE_STORE_SNAPSHOT,
  type DurableStoreAdapter,
  type DurableStoreSnapshot,
} from "../src/durableStore.js"

export const sha256 = async (canonicalValue: string): Promise<string> =>
  createHash("sha256").update(canonicalValue).digest("hex")

export class InMemoryDurableStoreAdapter implements DurableStoreAdapter {
  snapshot: DurableStoreSnapshot

  constructor(snapshot = EMPTY_DURABLE_STORE_SNAPSHOT) {
    this.snapshot = snapshot
  }

  async read(): Promise<DurableStoreSnapshot> {
    return this.snapshot
  }

  async compareAndSwapVerified({
    expected,
    next,
  }: Parameters<DurableStoreAdapter["compareAndSwapVerified"]>[0]) {
    if (!durableStoreSnapshotsEqual(this.snapshot, expected)) {
      return {
        actual: this.snapshot,
        ok: false as const,
        type: "PROFILE.STORAGE_CONFLICT" as const,
      }
    }

    this.snapshot = next
    return { ok: true as const, snapshot: this.snapshot }
  }
}
