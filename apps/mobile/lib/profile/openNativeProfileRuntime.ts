import openProfileRuntime, {
  type ProfileRuntime,
} from "@mapachess/profile/profile-runtime"
import AsyncStorageDurableStore, {
  type AsyncStorageValueStore,
} from "./AsyncStorageDurableStore"
import expoSha256 from "./expoSha256"

export default async function openNativeProfileRuntime(
  input: Readonly<{ storage?: AsyncStorageValueStore }> = {},
): Promise<ProfileRuntime> {
  const storage =
    input.storage ??
    (await import("@react-native-async-storage/async-storage")).default
  const adapter = new AsyncStorageDurableStore(storage)
  return openProfileRuntime({
    adapter,
    sha256: expoSha256,
    closeStorage: () => adapter.flush(),
  })
}
