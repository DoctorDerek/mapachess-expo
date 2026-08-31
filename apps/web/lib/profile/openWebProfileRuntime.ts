import { createActor, type ActorRefFrom } from "xstate"
import SerializedPlayerDataStore from "@mapachess/profile/durable-store"
import { decodeMapachessPortableBackup } from "@mapachess/profile/portable-backup"
import profileMachine from "@mapachess/profile/profile-machine"
import IndexedDbDurableStore from "./IndexedDbDurableStore"
import webSha256, { type Sha256SubtleCrypto } from "./webSha256"

export type WebProfileRuntime = Readonly<{
  actor: ActorRefFrom<typeof profileMachine>
  close: () => Promise<void>
}>

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
  const store = new SerializedPlayerDataStore(adapter, sha256)
  const actor = createActor(profileMachine, {
    input: {
      decodePortableBackup: (rawBackup) =>
        decodeMapachessPortableBackup(rawBackup, sha256),
      store,
    },
  }).start()

  return Object.freeze({
    actor,
    close: async () => {
      actor.stop()
      await adapter.close()
    },
  })
}
