import { describe, expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import SerializedPlayerDataStore from "../src/durableStore.js"
import createInitialMapachessPlayerData, {
  MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
} from "../src/playerData.js"
import {
  canonicalPlayerData,
  decodeMapachessPlayerDataWithSource,
} from "../src/playerDataCodec.js"
import {
  createMapachessPortableBackup,
  decodeMapachessPortableBackup,
} from "../src/portableBackup.js"
import { MOVE_REACTION_PLACEMENTS } from "../src/presentationPreferences.js"
import profileMachine, {
  selectCurrentPlayerData,
} from "../src/profileMachine.js"
import {
  changePresentationPreferences,
  replaceActiveMatch,
} from "../src/profileMutations.js"
import { decodeStoredPlayerData } from "../src/storedPlayerData.js"
import {
  InMemoryDurableStoreAdapter,
  sha256,
  withoutMoveReactionPlacement,
} from "./profileTestSupport.js"
import completedStoryMatch from "./storyProgressTestSupport.js"

describe("saved move-feedback placement", () => {
  it("retains the frozen schema16 initial-profile hash from the prior build", async () => {
    const initial = createInitialMapachessPlayerData()
    const decoded = decodeMapachessPlayerDataWithSource({
      ...withoutMoveReactionPlacement(initial),
      schemaVersion: 16,
    })
    if (!decoded.ok) throw new Error("Expected schema16 migration")
    expect(await sha256(decoded.source.canonical)).toBe(
      "bd41278ea9b3d643f08f76b7bd157d63c1131c02068c2c3f9e49cf66f374ec2e",
    )
  })

  it("authenticates schema16 without altering its preimage or existing progress", async () => {
    const normalized = decodeMapachessPlayerDataWithSource(
      replaceActiveMatch(
        createInitialMapachessPlayerData(),
        completedStoryMatch(),
      ),
    )
    if (!normalized.ok) throw new Error("Expected valid current profile")
    const current = normalized.data
    const payload = {
      ...withoutMoveReactionPlacement(current),
      schemaVersion: 16,
    }
    const canonical = canonicalPlayerData(
      {
        ...current,
        ratings: payload.ratings,
        ratedMatchCounts: payload.ratedMatchCounts,
        lastAcceptedResultReward: payload.lastAcceptedResultReward,
      },
      16,
    )
    const decoded = decodeMapachessPlayerDataWithSource(payload)
    expect(decoded).toMatchObject({
      ok: true,
      source: { schemaVersion: 16, canonical },
    })
    if (!decoded.ok) throw new Error("Expected schema16 migration")
    expect(decoded.data).toEqual({
      ...current,
      lastAcceptedResultReward: {
        ...payload.lastAcceptedResultReward,
        ratedElo: null,
        contribution: {
          ...payload.lastAcceptedResultReward?.contribution,
          ratedMatchCountBefore: null,
          eloState: "superseded",
        },
      },
    })
    const envelope = {
      format: "mapachess-stored-player-data",
      formatVersion: 1,
      saveSchemaVersion: 16,
      payload,
      integrity: { algorithm: "SHA-256", payloadHash: await sha256(canonical) },
    }
    expect(
      await decodeStoredPlayerData(JSON.stringify(envelope), sha256),
    ).toEqual({
      ok: true,
      data: decoded.data,
    })
    expect(current.schemaVersion).toBe(MAPACHESS_PLAYER_DATA_SCHEMA_VERSION)
    expect(
      await decodeStoredPlayerData(
        JSON.stringify({
          ...envelope,
          payload: { ...payload, revision: payload.revision + 1 },
        }),
        sha256,
      ),
    ).toMatchObject({
      ok: false,
      issue: { type: "PROFILE.STORED_DATA_INTEGRITY_MISMATCH" },
    })
  })

  it.each(MOVE_REACTION_PLACEMENTS)(
    "round-trips %s without changing game or result data",
    async (placement) => {
      const initial = replaceActiveMatch(
        createInitialMapachessPlayerData(),
        completedStoryMatch(),
      )
      const changed = changePresentationPreferences(initial, {
        ...initial.settings,
        moveReactionPlacement: placement,
      })
      expect({
        ...changed,
        revision: initial.revision,
        settings: initial.settings,
      }).toEqual(initial)
      const raw = await createMapachessPortableBackup({
        playerData: changed,
        applicationVersion: "test",
        gddRevision: "5.2",
        sha256,
      })
      const imported = await decodeMapachessPortableBackup(raw, sha256)
      expect(imported).toMatchObject({ ok: true, backup: { payload: changed } })
    },
  )

  it.each(["center", "left", "", null, undefined, 1])(
    "preserves invalid %s data for the existing recovery flow",
    (placement) => {
      const current = createInitialMapachessPlayerData()
      expect(
        decodeMapachessPlayerDataWithSource({
          ...current,
          settings: { ...current.settings, moveReactionPlacement: placement },
        }),
      ).toMatchObject({
        ok: false,
        issue: { path: "$.settings.moveReactionPlacement" },
      })
    },
  )

  it("does not write when selecting the already saved midpoint", async () => {
    const store = new SerializedPlayerDataStore(
      new InMemoryDurableStoreAdapter(),
      sha256,
    )
    const initial = createInitialMapachessPlayerData()
    expect(initial.settings.moveReactionPlacement).toBe("top")
    const seeded = await store.commitCurrent(await store.load(), {
      ...initial,
      settings: { ...initial.settings, moveReactionPlacement: "middle" },
    })
    if (!seeded.ok) throw new Error("Expected initial profile")
    const actor = createActor(profileMachine, {
      input: {
        store,
        decodePortableBackup: (raw) =>
          decodeMapachessPortableBackup(raw, sha256),
      },
    }).start()
    try {
      await waitFor(actor, (snapshot) => snapshot.matches("ready"))
      const before = selectCurrentPlayerData(actor.getSnapshot())
      const commit = vi.spyOn(store, "commitCurrent")
      actor.send({
        type: "PROFILE.MOVE_REACTION_PLACEMENT_CHANGED",
        placement: "middle",
      })
      expect(actor.getSnapshot().matches("ready")).toBe(true)
      expect(selectCurrentPlayerData(actor.getSnapshot())).toBe(before)
      expect(commit).not.toHaveBeenCalled()
    } finally {
      actor.stop()
    }
  })
})
