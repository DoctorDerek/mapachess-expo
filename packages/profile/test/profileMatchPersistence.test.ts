import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import {
  DURABLE_MATCH_RECORD_VERSION,
  type DurableMatchRecord,
} from "@mapachess/match/durable-match-record"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import SerializedPlayerDataStore from "../src/durableStore.js"
import createInitialMapachessPlayerData from "../src/playerData.js"
import { decodeMapachessPortableBackup } from "../src/portableBackup.js"
import profileMachine, {
  selectCurrentPlayerData,
} from "../src/profileMachine.js"
import ProfileMatchPersistenceBridge from "../src/profileMatchPersistence.js"
import { completeAutoHintsFirstRun } from "../src/profileMutations.js"
import { InMemoryDurableStoreAdapter, sha256 } from "./profileTestSupport.js"

const initialPosition = createInitialMatchPosition({
  chess960PositionId: null,
  variant: "standard",
})

const durableMatch = (
  matchSeed = "00000001000000020000000300000004",
): DurableMatchRecord =>
  Object.freeze({
    autoHintsEnabledAtStart: true,
    conclusion: null,
    currentFen: initialPosition.fen,
    cursor: 0,
    matchId: `standard-story-chicken/${matchSeed}`,
    matchSeed,
    mode: "story",
    moveHintsUsed: false,
    moveIds: Object.freeze([]),
    opponentId: "chicken-stockfish",
    opponentPolicyFingerprint: "standard-chicken-web-policy-test",
    pieceHintsUsed: false,
    playerColor: "white",
    playerEloAtStart: 100,
    recordVersion: DURABLE_MATCH_RECORD_VERSION,
    startingPosition: Object.freeze({
      chess960PositionId: null,
      variant: "standard",
    }),
    timeControl: Object.freeze({ type: "untimed" }),
  })

const openCompletedProfile = async () => {
  const store = new SerializedPlayerDataStore(
    new InMemoryDurableStoreAdapter(),
    sha256,
  )
  const missing = await store.load()
  const initialWrite = await store.commitCurrent(
    missing,
    createInitialMapachessPlayerData(),
  )
  if (!initialWrite.ok) throw new Error("Initial test profile write failed")
  const completed = completeAutoHintsFirstRun(
    initialWrite.state.current.type === "valid"
      ? initialWrite.state.current.data
      : createInitialMapachessPlayerData(),
    true,
  )
  const completedWrite = await store.commitCurrent(
    initialWrite.state,
    completed,
  )
  if (!completedWrite.ok) throw new Error("Completed test profile write failed")

  const actor = createActor(profileMachine, {
    input: {
      decodePortableBackup: (rawBackup) =>
        decodeMapachessPortableBackup(rawBackup, sha256),
      store,
    },
  }).start()
  await waitFor(actor, (snapshot) => snapshot.matches("ready"))
  return actor
}

describe("profile-owned match persistence bridge", () => {
  it("accepts one conclusion and rejects every later result change", async () => {
    const actor = await openCompletedProfile()
    const initialMatch = durableMatch()
    const bridge = new ProfileMatchPersistenceBridge({
      actor,
      expectedActiveMatch: null,
      initialMatch,
    })
    const controller = new AbortController()
    await bridge.establish(controller.signal)

    await bridge.persist(
      {
        conclusion: { type: "draw-agreement" },
        currentFen: initialMatch.currentFen,
        cursor: 0,
        matchId: initialMatch.matchId,
        moveHintsUsed: false,
        moveIds: Object.freeze([]),
        pieceHintsUsed: false,
        requestId: `${initialMatch.matchId}/draw-agreement`,
      },
      controller.signal,
    )
    expect(
      selectCurrentPlayerData(actor.getSnapshot())?.activeMatch?.conclusion,
    ).toEqual({ type: "draw-agreement" })

    await bridge.persist(
      {
        conclusion: { type: "draw-agreement" },
        currentFen: initialMatch.currentFen,
        cursor: 0,
        matchId: initialMatch.matchId,
        moveHintsUsed: false,
        moveIds: Object.freeze([]),
        pieceHintsUsed: true,
        requestId: `${initialMatch.matchId}/review-update`,
      },
      controller.signal,
    )
    expect(
      selectCurrentPlayerData(actor.getSnapshot())?.activeMatch,
    ).toMatchObject({
      conclusion: { type: "draw-agreement" },
      pieceHintsUsed: true,
    })

    const changedConclusionRequest = {
      currentFen: initialMatch.currentFen,
      cursor: 0,
      matchId: initialMatch.matchId,
      moveHintsUsed: false,
      moveIds: Object.freeze([]),
      pieceHintsUsed: true,
    } as const
    await expect(
      bridge.persist(
        {
          ...changedConclusionRequest,
          conclusion: null,
          requestId: `${initialMatch.matchId}/cleared-result`,
        },
        controller.signal,
      ),
    ).rejects.toThrow("Persisted match conclusion cannot change")
    await expect(
      bridge.persist(
        {
          ...changedConclusionRequest,
          conclusion: { type: "resignation", winner: "black" },
          requestId: `${initialMatch.matchId}/replaced-result`,
        },
        controller.signal,
      ),
    ).rejects.toThrow("Persisted match conclusion cannot change")
    actor.stop()
  })

  it("establishes the initial match and verifies each candidate", async () => {
    const actor = await openCompletedProfile()
    const initialMatch = durableMatch()
    const bridge = new ProfileMatchPersistenceBridge({
      actor,
      expectedActiveMatch: null,
      initialMatch,
    })
    const controller = new AbortController()

    await bridge.establish(controller.signal)
    expect(selectCurrentPlayerData(actor.getSnapshot())?.activeMatch).toEqual(
      initialMatch,
    )

    const receipt = await bridge.persist(
      {
        conclusion: null,
        currentFen: initialMatch.currentFen,
        cursor: 0,
        matchId: initialMatch.matchId,
        moveHintsUsed: false,
        moveIds: Object.freeze([]),
        pieceHintsUsed: true,
        requestId: `${initialMatch.matchId}/piece-hints`,
      },
      controller.signal,
    )

    expect(receipt).toEqual({
      requestId: `${initialMatch.matchId}/piece-hints`,
      type: "MATCH.MUTATION_PERSISTED",
    })
    expect(
      selectCurrentPlayerData(actor.getSnapshot())?.activeMatch?.pieceHintsUsed,
    ).toBe(true)

    await expect(
      bridge.persist(
        {
          conclusion: null,
          currentFen: initialMatch.currentFen,
          cursor: 0,
          matchId: initialMatch.matchId,
          moveHintsUsed: false,
          moveIds: Object.freeze([]),
          pieceHintsUsed: false,
          requestId: `${initialMatch.matchId}/regressed-hints`,
        },
        controller.signal,
      ),
    ).rejects.toThrow("Persisted hint use cannot move backward")
    actor.stop()
  })

  it("waits behind another profile write without losing that update", async () => {
    const actor = await openCompletedProfile()
    const initialMatch = durableMatch()
    const bridge = new ProfileMatchPersistenceBridge({
      actor,
      expectedActiveMatch: null,
      initialMatch,
    })
    const controller = new AbortController()
    await bridge.establish(controller.signal)

    actor.send({
      enabled: false,
      type: "PROFILE.AUTO_HINTS_SETTING_CHANGED",
    })
    const persistence = bridge.persist(
      {
        conclusion: null,
        currentFen: initialMatch.currentFen,
        cursor: 0,
        matchId: initialMatch.matchId,
        moveHintsUsed: true,
        moveIds: Object.freeze([]),
        pieceHintsUsed: true,
        requestId: `${initialMatch.matchId}/move-hints`,
      },
      controller.signal,
    )

    await persistence
    expect(selectCurrentPlayerData(actor.getSnapshot())).toMatchObject({
      activeMatch: { moveHintsUsed: true, pieceHintsUsed: true },
      settings: { autoHintsEnabled: false },
    })
    actor.stop()
  })

  it("refuses to overwrite an independently replaced active match", async () => {
    const actor = await openCompletedProfile()
    const initialMatch = durableMatch()
    const bridge = new ProfileMatchPersistenceBridge({
      actor,
      expectedActiveMatch: null,
      initialMatch,
    })
    const controller = new AbortController()
    await bridge.establish(controller.signal)

    actor.send({
      activeMatch: durableMatch("00000005000000060000000700000008"),
      type: "PROFILE.ACTIVE_MATCH_SAVE_REQUESTED",
    })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))

    await expect(
      bridge.persist(
        {
          conclusion: null,
          currentFen: initialMatch.currentFen,
          cursor: 0,
          matchId: initialMatch.matchId,
          moveHintsUsed: false,
          moveIds: Object.freeze([]),
          pieceHintsUsed: true,
          requestId: `${initialMatch.matchId}/stale`,
        },
        controller.signal,
      ),
    ).rejects.toThrow("Canonical active match changed")
    expect(
      selectCurrentPlayerData(actor.getSnapshot())?.activeMatch?.matchId,
    ).toBe("standard-story-chicken/00000005000000060000000700000008")
    actor.stop()
  })
})
