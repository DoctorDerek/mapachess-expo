import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import { canonicalActiveMatch } from "../src/durableMatchCodec.js"
import SerializedPlayerDataStore, {
  type DurableStoreAdapter,
} from "../src/durableStore.js"
import createInitialMapachessPlayerData, {
  MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  PLAYER_ELO_RATING_IDS,
  type MapachessPlayerDataV3,
} from "../src/playerData.js"
import { decodeMapachessPlayerData } from "../src/playerDataCodec.js"
import {
  createMapachessPortableBackup,
  decodeMapachessPortableBackup,
} from "../src/portableBackup.js"
import profileMachine, {
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "../src/profileMachine.js"
import { persistProfileActiveMatch } from "../src/profileMatchPersistence.js"
import { replaceActiveMatch } from "../src/profileMutations.js"
import { decodeStoredPlayerData } from "../src/storedPlayerData.js"
import { InMemoryDurableStoreAdapter, sha256 } from "./profileTestSupport.js"
import completedStoryMatch from "./storyProgressTestSupport.js"

describe("Story progress in durable profiles", () => {
  it("authenticates v3 save and backup bytes before preserving their retained Story win", async () => {
    const current = createInitialMapachessPlayerData()
    const legacy: MapachessPlayerDataV3 = {
      activeMatch: completedStoryMatch("chess960"),
      ratings: { ...current.ratings, standardChallenge: 512.5 },
      revision: 42,
      schema: current.schema,
      schemaVersion: 3,
      settings: current.settings,
    }
    const canonicalV3 = JSON.stringify([
      legacy.schema,
      3,
      legacy.revision,
      legacy.settings.autoHintMode,
      PLAYER_ELO_RATING_IDS.map((id) => legacy.ratings[id]),
      canonicalActiveMatch(completedStoryMatch("chess960")),
      [
        legacy.settings.challengeSetup.variant,
        legacy.settings.challengeSetup.playerColor,
        legacy.settings.challengeSetup.chess960PositionId,
      ],
    ])
    const integrity = {
      algorithm: "SHA-256",
      payloadHash: await sha256(canonicalV3),
    }
    const stored = {
      format: "mapachess-stored-player-data",
      formatVersion: 1,
      integrity,
      payload: legacy,
      saveSchemaVersion: 3,
    }
    const decoded = await decodeStoredPlayerData(JSON.stringify(stored), sha256)
    expect(decoded).toMatchObject({
      ok: true,
      data: {
        ...legacy,
        schemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
        storyProgress: {
          standard: [],
          chess960: [{ opponentId: "chicken-stockfish", highestMedal: "gold" }],
        },
      },
    })
    const portable = {
      ...stored,
      format: "mapachess-portable-backup",
      applicationVersion: "synthetic-v3",
      gddRevision: "synthetic-fixture",
    }
    const restored = await decodeMapachessPortableBackup(
      JSON.stringify(portable),
      sha256,
    )
    if (!decoded.ok || !restored.ok)
      throw new Error("Valid v3 fixture must migrate")
    expect(restored.backup.payload).toEqual(decoded.data)
    const reexported = await createMapachessPortableBackup({
      playerData: decoded.data,
      applicationVersion: "test",
      gddRevision: "test",
      sha256,
    })
    expect(
      await decodeMapachessPortableBackup(reexported, sha256),
    ).toMatchObject({ ok: true, backup: { payload: decoded.data } })
    const tampered = { ...stored, payload: { ...legacy, revision: 43 } }
    expect(
      await decodeStoredPlayerData(JSON.stringify(tampered), sha256),
    ).toEqual({
      ok: false,
      issue: { type: "PROFILE.STORED_DATA_INTEGRITY_MISMATCH" },
    })
  })

  it("rejects missing or regressed current-schema progress for a retained winning match", () => {
    const initial = createInitialMapachessPlayerData()
    const activeMatch = completedStoryMatch()
    expect(decodeMapachessPlayerData({ ...initial, activeMatch })).toEqual({
      ok: false,
      issue: { type: "PROFILE.DATA_INVALID", path: "$.storyProgress.standard" },
    })
    expect(
      decodeMapachessPlayerData({
        ...initial,
        activeMatch,
        storyProgress: {
          standard: [
            { opponentId: "chicken-stockfish", highestMedal: "bronze" },
          ],
          chess960: [],
        },
      }),
    ).toMatchObject({ ok: false })
    const awarded = replaceActiveMatch(initial, activeMatch)
    expect(decodeMapachessPlayerData(awarded)).toEqual({
      ok: true,
      data: awarded,
    })
    expect(awarded.ratings).toBe(initial.ratings)
    expect(replaceActiveMatch(awarded, null).storyProgress).toBe(
      awarded.storyProgress,
    )
  })

  it("retains an unsaved winning candidate and commits its medal once when storage recovers", async () => {
    const memory = new InMemoryDurableStoreAdapter()
    let failWrite = false
    const adapter: DurableStoreAdapter = {
      read: () => memory.read(),
      compareAndSwapVerified: async (write) =>
        failWrite
          ? {
              ok: false,
              type: "PROFILE.STORAGE_VERIFICATION_FAILED",
              actual: await memory.read(),
            }
          : memory.compareAndSwapVerified(write),
    }
    const store = new SerializedPlayerDataStore(adapter, sha256)
    const initial = createInitialMapachessPlayerData()
    const seeded = await store.commitCurrent(await store.load(), initial)
    if (!seeded.ok) throw new Error("Initial profile must save")
    const openActor = () =>
      createActor(profileMachine, {
        input: {
          store,
          decodePortableBackup: (raw) =>
            decodeMapachessPortableBackup(raw, sha256),
        },
      }).start()
    const actor = openActor()
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    const winner = completedStoryMatch()
    const signal = new AbortController().signal
    failWrite = true
    const saving = persistProfileActiveMatch({
      actor,
      candidate: winner,
      expectedActiveMatch: null,
      signal,
    })
    await waitFor(actor, (snapshot) => snapshot.matches("persistenceFailure"))
    expect(selectCurrentPlayerData(actor.getSnapshot())).toEqual(initial)
    expect(
      selectPendingPlayerData(actor.getSnapshot())?.storyProgress.standard,
    ).toEqual([{ opponentId: "chicken-stockfish", highestMedal: "gold" }])
    expect((await store.load()).current).toMatchObject({
      type: "valid",
      data: initial,
    })
    failWrite = false
    actor.send({ type: "PROFILE.PERSISTENCE_RETRY_REQUESTED" })
    await saving
    const accepted = selectCurrentPlayerData(actor.getSnapshot())
    expect(accepted).toMatchObject({
      activeMatch: winner,
      revision: 1,
      storyProgress: {
        standard: [{ opponentId: "chicken-stockfish", highestMedal: "gold" }],
        chess960: [],
      },
    })

    const rewound = {
      ...winner,
      cursor: 0,
      currentFen: createInitialMatchPosition(winner.startingPosition).fen,
    }
    await persistProfileActiveMatch({
      actor,
      candidate: rewound,
      expectedActiveMatch: winner,
      signal,
    })
    await persistProfileActiveMatch({
      actor,
      candidate: winner,
      expectedActiveMatch: rewound,
      signal,
    })
    expect(selectCurrentPlayerData(actor.getSnapshot())?.storyProgress).toEqual(
      accepted?.storyProgress,
    )
    actor.stop()
    const resumed = openActor()
    await waitFor(resumed, (snapshot) => snapshot.matches("ready"))
    await persistProfileActiveMatch({
      actor: resumed,
      candidate: winner,
      expectedActiveMatch: winner,
      signal,
    })
    expect(selectCurrentPlayerData(resumed.getSnapshot())?.revision).toBe(3)
    await persistProfileActiveMatch({
      actor: resumed,
      candidate: null,
      expectedActiveMatch: winner,
      signal,
    })
    expect(selectCurrentPlayerData(resumed.getSnapshot())).toMatchObject({
      activeMatch: null,
      ratings: initial.ratings,
      storyProgress: accepted?.storyProgress,
    })
    resumed.stop()
  })
})
