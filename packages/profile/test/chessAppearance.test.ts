import { describe, expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import {
  CHESS_BOARDS,
  CHESS_PIECE_SETS,
} from "@mapachess/match-presentation/chess-appearance-catalog"
import decodeChessAppearance, {
  DEFAULT_CHESS_APPEARANCE,
} from "../src/chessAppearanceSettings.js"
import SerializedPlayerDataStore from "../src/durableStore.js"
import createInitialMapachessPlayerData from "../src/playerData.js"
import {
  canonicalPlayerData,
  decodeMapachessPlayerDataWithSource,
} from "../src/playerDataCodec.js"
import {
  createMapachessPortableBackup,
  decodeMapachessPortableBackup,
} from "../src/portableBackup.js"
import profileMachine, {
  selectCanChangeChessAppearance,
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "../src/profileMachine.js"
import { persistProfileActiveMatch } from "../src/profileMatchPersistence.js"
import {
  changeChessAppearance,
  replaceActiveMatch,
} from "../src/profileMutations.js"
import { decodeStoredPlayerData } from "../src/storedPlayerData.js"
import { InMemoryDurableStoreAdapter, sha256 } from "./profileTestSupport.js"
import completedStoryMatch from "./storyProgressTestSupport.js"

describe("independent saved chess artwork", () => {
  it("accepts every catalog combination and rejects unknown or incomplete preferences", () => {
    for (const board of CHESS_BOARDS)
      for (const pieces of CHESS_PIECE_SETS) {
        const choice = { boardId: board.id, pieceSetId: pieces.id }
        expect(decodeChessAppearance(choice)).toEqual(choice)
      }
    for (const value of [
      null,
      {},
      { boardId: "unavailable", pieceSetId: "current" },
      { boardId: "current", pieceSetId: "greyfox" },
      { ...DEFAULT_CHESS_APPEARANCE, extra: true },
    ])
      expect(() => decodeChessAppearance(value)).toThrow()
  })

  it("authenticates unchanged v11 bytes before migrating without losing avatar equipment", async () => {
    const current = createInitialMapachessPlayerData()
    const { chessAppearance: _chessAppearance, ...settings } = current.settings
    const appearance = { ...current.appearance, face: 7, weapon: "weapon5_c4" }
    const payload = { ...current, schemaVersion: 11, settings, appearance }
    const canonical = `["mapachess-player-data",11,0,"auto-move-hints",[100,100],null,["standard","white",null,"chicken-stockfish",100],[[],[]],[[[],[]],[[],[]]],[100,100,100,100],[0,0],[],0,[],null,${JSON.stringify(appearance)}]`
    const decoded = decodeMapachessPlayerDataWithSource(payload)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("Schema 11 must migrate")
    expect(decoded.source.canonical).toBe(canonical)
    expect(decoded.data.appearance).toEqual(appearance)
    expect(decoded.data.settings.chessAppearance).toEqual(
      DEFAULT_CHESS_APPEARANCE,
    )
    const stored = {
      format: "mapachess-stored-player-data",
      formatVersion: 1,
      saveSchemaVersion: 11,
      payload,
      integrity: { algorithm: "SHA-256", payloadHash: await sha256(canonical) },
    }
    expect(
      await decodeStoredPlayerData(JSON.stringify(stored), sha256),
    ).toEqual({ ok: true, data: decoded.data })
    const portable = {
      ...stored,
      format: "mapachess-portable-backup",
      applicationVersion: "test",
      gddRevision: "5.0",
    }
    expect(
      await decodeMapachessPortableBackup(JSON.stringify(portable), sha256),
    ).toMatchObject({ ok: true, backup: { payload: decoded.data } })
    expect(
      await decodeStoredPlayerData(
        JSON.stringify({
          ...stored,
          payload: {
            ...payload,
            appearance: { ...appearance, weapon: "none" },
          },
        }),
        sha256,
      ),
    ).toMatchObject({
      ok: false,
      issue: { type: "PROFILE.STORED_DATA_INTEGRITY_MISMATCH" },
    })
  })

  it("round-trips independent preferences in checksummed portable data", async () => {
    const original = replaceActiveMatch(
      createInitialMapachessPlayerData(),
      completedStoryMatch(),
    )
    const changed = changeChessAppearance(original, {
      pieceSetId: "skoll",
      boardId: "toffee-ice",
    })
    expect({
      ...changed,
      revision: original.revision,
      settings: original.settings,
    }).toEqual(original)
    expect(canonicalPlayerData(changed)).not.toBe(canonicalPlayerData(original))
    const backup = await createMapachessPortableBackup({
      playerData: changed,
      applicationVersion: "test",
      gddRevision: "5.1",
      sha256,
    })
    expect(await decodeMapachessPortableBackup(backup, sha256)).toMatchObject({
      ok: true,
      backup: { payload: changed },
    })
  })

  it.each([
    { fail: false, matchFirst: false },
    { fail: true, matchFirst: false },
    { fail: false, matchFirst: true },
    { fail: true, matchFirst: true },
  ])(
    "serializes rapid choices and a match save: failure=$fail, matchFirst=$matchFirst",
    async ({ fail, matchFirst }) => {
      const store = new SerializedPlayerDataStore(
        new InMemoryDurableStoreAdapter(),
        sha256,
      )
      const match = completedStoryMatch()
      const initial = replaceActiveMatch(
        createInitialMapachessPlayerData(),
        match,
      )
      const fresh = await store.commitCurrent(
        await store.load(),
        createInitialMapachessPlayerData(),
      )
      if (!fresh.ok) throw new Error("Expected initial profile seed")
      const seeded = await store.commitCurrent(fresh.state, initial)
      if (!seeded.ok) throw new Error("Expected match profile seed")
      const actor = createActor(profileMachine, {
        input: {
          store,
          decodePortableBackup: (raw) =>
            decodeMapachessPortableBackup(raw, sha256),
        },
      }).start()
      await waitFor(actor, (snapshot) => snapshot.matches("ready"))
      const acceptedMatch = selectCurrentPlayerData(
        actor.getSnapshot(),
      )?.activeMatch
      if (acceptedMatch === null || acceptedMatch === undefined)
        throw new Error("Expected decoded saved match")
      const gate = Promise.withResolvers<void>()
      const commit = store.commitCurrent.bind(store)
      vi.spyOn(store, "commitCurrent").mockImplementationOnce(
        async (...args) => {
          await gate.promise
          if (fail) throw new Error("Temporary storage failure")
          return commit(...args)
        },
      )
      const updatedMatch = {
        ...acceptedMatch,
        autoHintMode: "auto-piece-hints" as const,
      }
      const saveMatch = (): Promise<void> =>
        persistProfileActiveMatch({
          actor,
          candidate: updatedMatch,
          expectedActiveMatch: acceptedMatch,
          signal: new AbortController().signal,
        })
      let savingMatch = matchFirst ? saveMatch() : null
      actor.send({
        type: "PROFILE.CHESS_APPEARANCE_CHANGED",
        change: { pieceSetId: "chessnut" },
      })
      expect(selectCanChangeChessAppearance(actor.getSnapshot())).toBe(true)
      actor.send({
        type: "PROFILE.CHESS_APPEARANCE_CHANGED",
        change: { boardId: "toffee-wood" },
      })
      actor.send({
        type: "PROFILE.CHESS_APPEARANCE_CHANGED",
        change: { pieceSetId: "cat-chess" },
      })
      const expected = { boardId: "toffee-wood", pieceSetId: "cat-chess" }
      expect(
        selectPendingPlayerData(actor.getSnapshot())?.settings.chessAppearance,
      ).toEqual(expected)
      savingMatch ??= saveMatch()
      gate.resolve()
      if (fail) {
        await waitFor(actor, (snapshot) =>
          snapshot.matches("persistenceFailure"),
        )
        expect(selectCanChangeChessAppearance(actor.getSnapshot())).toBe(false)
        expect(
          selectPendingPlayerData(actor.getSnapshot())?.settings
            .chessAppearance,
        ).toEqual(expected)
        actor.send({ type: "PROFILE.PERSISTENCE_RETRY_REQUESTED" })
      }
      await savingMatch
      await waitFor(actor, (snapshot) => snapshot.matches("ready"))
      const accepted = selectCurrentPlayerData(actor.getSnapshot())
      expect(accepted?.settings.chessAppearance).toEqual(expected)
      expect(accepted?.activeMatch).toEqual(updatedMatch)
      expect(accepted?.totalXp).toBe(initial.totalXp)
      expect(accepted?.lastAcceptedResultReward).toEqual(
        initial.lastAcceptedResultReward,
      )
      expect(accepted?.appearance).toEqual(initial.appearance)
      const loaded = await store.load()
      expect(
        loaded.current.type === "valid" &&
          loaded.current.data.settings.chessAppearance,
      ).toEqual(expected)
      actor.stop()
    },
  )
})
