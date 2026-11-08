import { createActor, type ActorRefFrom } from "xstate"
import SerializedPlayerDataStore from "./durableStore.js"
import type { DurableStoreAdapter } from "./durableStoreContract.js"
import {
  decodeMapachessPortableBackup,
  type Sha256HexDigest,
} from "./portableBackup.js"
import profileMachine from "./profileMachine.js"

export type ProfileActor = ActorRefFrom<typeof profileMachine>
export type ProfileRuntime = Readonly<{
  actor: ProfileActor
  close: () => Promise<void>
}>

export type OpenProfileRuntimeInput = Readonly<{
  adapter: DurableStoreAdapter
  sha256: Sha256HexDigest
  closeStorage: () => Promise<void>
}>

export default function openProfileRuntime(
  input: OpenProfileRuntimeInput,
): ProfileRuntime {
  const store = new SerializedPlayerDataStore(input.adapter, input.sha256)
  const actor = createActor(profileMachine, {
    input: {
      decodePortableBackup: (rawBackup) =>
        decodeMapachessPortableBackup(rawBackup, input.sha256),
      store,
    },
  }).start()
  return Object.freeze({
    actor,
    close: async () => {
      actor.stop()
      await input.closeStorage()
    },
  })
}
