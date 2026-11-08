import type { AsyncStorageValueStore } from "@/lib/profile/AsyncStorageDurableStore"

export default class InMemoryAsyncStorage implements AsyncStorageValueStore {
  public readonly values = new Map<string, string>()

  public async multiGet(
    keys: readonly string[],
  ): Promise<readonly (readonly [string, string | null])[]> {
    return keys.map((key) => [key, this.values.get(key) ?? null] as const)
  }

  public async multiRemove(keys: readonly string[]): Promise<void> {
    for (const key of keys) this.values.delete(key)
  }

  public async multiSet(
    entries: readonly (readonly [string, string])[],
  ): Promise<void> {
    for (const [key, value] of entries) this.values.set(key, value)
  }
}
