import openProfileRuntime, {
  type ProfileRuntime,
} from "@mapachess/profile/profile-runtime"
import IndexedDbDurableStore from "./IndexedDbDurableStore"
import webSha256, { type Sha256SubtleCrypto } from "./webSha256"

export type WebProfileRuntime = ProfileRuntime

export type OpenWebProfileRuntimeInput = Readonly<{
  indexedDb: IDBFactory
  subtleCrypto: Sha256SubtleCrypto
}>

export default function openWebProfileRuntime(
  input: OpenWebProfileRuntimeInput,
): WebProfileRuntime {
  const adapter = new IndexedDbDurableStore(input.indexedDb)
  const sha256 = (canonicalValue: string): Promise<string> =>
    webSha256(canonicalValue, input.subtleCrypto)
  return openProfileRuntime({
    adapter,
    sha256,
    closeStorage: () => adapter.close(),
  })
}
