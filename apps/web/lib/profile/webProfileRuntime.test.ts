import { webcrypto } from "node:crypto"
import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it } from "vitest"
import { waitFor } from "xstate"
import createInitialMapachessPlayerData from "@mapachess/profile/player-data"
import { decodeMapachessPortableBackup } from "@mapachess/profile/portable-backup"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import openWebProfileRuntime from "./openWebProfileRuntime"
import {
  createWebPlayerDataBackup,
  MAPACHESS_GDD_REVISION,
} from "./webPlayerDataFiles"
import webSha256 from "./webSha256"

describe("web durable profile runtime", () => {
  it("creates canonical SHA-256 digests through Web Crypto", async () => {
    await expect(webSha256("abc", webcrypto.subtle)).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    )
  })

  it("boots a fresh IndexedDB profile directly into ready play", async () => {
    const runtime = openWebProfileRuntime({
      indexedDb: new IDBFactory(),
      subtleCrypto: webcrypto.subtle,
    })

    await waitFor(runtime.actor, (snapshot) => snapshot.matches("ready"))
    expect(selectCurrentPlayerData(runtime.actor.getSnapshot())).toEqual(
      createInitialMapachessPlayerData(),
    )
    await runtime.close()
  })

  it("exports a verified backup with current application identities", async () => {
    const playerData = createInitialMapachessPlayerData()
    const rawBackup = await createWebPlayerDataBackup(
      playerData,
      webcrypto.subtle,
    )
    const decoded = await decodeMapachessPortableBackup(
      rawBackup,
      (canonicalValue) => webSha256(canonicalValue, webcrypto.subtle),
    )

    expect(decoded).toMatchObject({
      backup: {
        applicationVersion: "0.0.0",
        gddRevision: MAPACHESS_GDD_REVISION,
        payload: playerData,
      },
      ok: true,
    })
  })
})
