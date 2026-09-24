import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import {
  DEFAULT_CHALLENGE_SETUP,
  type ChallengeSetup,
} from "@mapachess/match/challenge-setup"
import {
  DURABLE_MATCH_RECORD_VERSION,
  type DurableMatchRecord,
} from "@mapachess/match/durable-match-record"
import {
  applyMatchMove,
  listLegalMatchMoves,
} from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import { decodeDurableMatch } from "../src/durableMatchCodec.js"
import SerializedPlayerDataStore from "../src/durableStore.js"
import createInitialMapachessPlayerData from "../src/playerData.js"
import {
  createMapachessPortableBackup,
  decodeMapachessPortableBackup,
} from "../src/portableBackup.js"
import profileMachine, {
  selectCurrentPlayerData,
} from "../src/profileMachine.js"
import ProfileMatchPersistenceBridge, {
  persistProfileActiveMatch,
} from "../src/profileMatchPersistence.js"
import { replaceActiveMatch } from "../src/profileMutations.js"
import { InMemoryDurableStoreAdapter, sha256 } from "./profileTestSupport.js"

const initialPosition = createInitialMatchPosition({
  chess960PositionId: null,
  variant: "standard",
})

const durableMatch = (
  matchSeed = "00000001000000020000000300000004",
): DurableMatchRecord =>
  Object.freeze({
    autoHintMode: "auto-move-hints",
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

const openProfile = async () => {
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
  it("orders feedback with moves, round-trips backups, and trims only an abandoned branch", async () => {
    const actor = await openProfile()
    const initial = durableMatch()
    const bridge = new ProfileMatchPersistenceBridge({
      actor,
      expectedActiveMatch: null,
      initialMatch: initial,
    })
    const signal = new AbortController().signal
    await bridge.establish(signal)
    const firstMove = listLegalMatchMoves(initialPosition).find(
      ({ uci }) => uci === "e2e4",
    )
    if (!firstMove) throw new Error("Expected e4")
    const first = applyMatchMove(initialPosition, firstMove.id)
    if (!first.ok) throw new Error("Expected e4 transition")
    const replyMove = listLegalMatchMoves(first.transition.after).find(
      ({ uci }) => uci === "e7e5",
    )
    if (!replyMove) throw new Error("Expected e5")
    const reply = applyMatchMove(first.transition.after, replyMove.id)
    if (!reply.ok) throw new Error("Expected e5 transition")
    const firstRequest = {
      ...initial,
      currentFen: first.transition.after.fen,
      cursor: 1,
      moveIds: [firstMove.id],
      requestId: "first",
    }
    await bridge.persist(firstRequest, signal)
    const record: MoveFeedbackRecord = {
      ply: 1,
      moveId: firstMove.id,
      mover: "white",
      beforeFen: initialPosition.fen,
      afterFen: first.transition.after.fen,
      before: { bound: "exact", kind: "centipawns", whiteCentipawns: 0 },
      after: { kind: "centipawns", whiteCentipawns: 30, bound: "exact" },
      grade: "best",
      reason: null,
      policyId: "mapachess-gdd-3.1",
    }
    await Promise.all([
      bridge.persistMoveFeedback(record, signal),
      bridge.persist(
        {
          ...firstRequest,
          currentFen: reply.transition.after.fen,
          cursor: 2,
          moveIds: [firstMove.id, replyMove.id],
          requestId: "reply",
        },
        signal,
      ),
    ])
    const data = selectCurrentPlayerData(actor.getSnapshot())
    if (!data) throw new Error("Expected saved data")
    expect(data.activeMatch).toMatchObject({
      cursor: 2,
      moveFeedback: [record],
    })
    const backup = await createMapachessPortableBackup({
      applicationVersion: "test",
      gddRevision: "v3.1",
      playerData: data,
      sha256,
    })
    const restored = await decodeMapachessPortableBackup(backup, sha256)
    expect(restored.ok).toBe(true)
    expect(
      decodeDurableMatch(JSON.parse(JSON.stringify(data.activeMatch)), "match"),
    ).toEqual(data.activeMatch)
    expect(() =>
      decodeDurableMatch(
        {
          ...data.activeMatch,
          moveFeedback: [{ ...record, afterFen: initialPosition.fen }],
        },
        "match",
      ),
    ).toThrow()
    expect(() =>
      decodeDurableMatch(
        { ...data.activeMatch, moveFeedback: [record, record] },
        "match",
      ),
    ).toThrow()
    expect(() =>
      decodeDurableMatch(
        {
          ...data.activeMatch,
          moveFeedback: [
            {
              ...record,
              after: {
                kind: "centipawns",
                bound: "exact",
                whiteCentipawns: Infinity,
              },
            },
          ],
        },
        "match",
      ),
    ).toThrow()
    await bridge.persist(
      {
        ...firstRequest,
        cursor: 0,
        currentFen: initialPosition.fen,
        moveIds: [firstMove.id, replyMove.id],
        requestId: "undo",
      },
      signal,
    )
    expect(
      selectCurrentPlayerData(actor.getSnapshot())?.activeMatch?.moveFeedback,
    ).toEqual([record])
    const branchMove = listLegalMatchMoves(initialPosition).find(
      ({ uci }) => uci === "d2d4",
    )
    if (!branchMove) throw new Error("Expected d4")
    const branch = applyMatchMove(initialPosition, branchMove.id)
    if (!branch.ok) throw new Error("Expected d4 transition")
    await bridge.persist(
      {
        ...firstRequest,
        moveIds: [branchMove.id],
        currentFen: branch.transition.after.fen,
        requestId: "branch",
      },
      signal,
    )
    expect(
      selectCurrentPlayerData(actor.getSnapshot())?.activeMatch?.moveFeedback,
    ).toEqual([])
    expect(await bridge.persistMoveFeedback(record, signal)).toBe(false)
    const aborted = new AbortController()
    aborted.abort()
    await expect(
      bridge.persistMoveFeedback(record, aborted.signal),
    ).rejects.toThrow("aborted")
    await bridge.persist(
      {
        ...firstRequest,
        moveIds: [branchMove.id],
        currentFen: branch.transition.after.fen,
        requestId: "after-abort",
      },
      signal,
    )
    actor.stop()
  })
  it("does not accept an unchanged match as acknowledgement of a different difficulty preference", async () => {
    const actor = await openProfile()
    const match: DurableMatchRecord = {
      ...durableMatch(),
      mode: "challenge",
      opponentTargetElo: 1000,
    }
    const signal = new AbortController().signal
    await persistProfileActiveMatch({
      actor,
      candidate: match,
      expectedActiveMatch: null,
      signal,
    })
    const before = selectCurrentPlayerData(actor.getSnapshot())
    const setup = { ...DEFAULT_CHALLENGE_SETUP, difficultyTargetElo: 1000 }
    await persistProfileActiveMatch({
      actor,
      candidate: match,
      expectedActiveMatch: match,
      challengeSetup: setup,
      signal,
    })
    expect(selectCurrentPlayerData(actor.getSnapshot())).toMatchObject({
      revision: (before?.revision ?? 0) + 1,
      settings: { challengeSetup: setup },
      activeMatch: match,
    })
    expect(() =>
      replaceActiveMatch(createInitialMapachessPlayerData(), match, {
        ...setup,
        opponentId: "bunny-stockfish",
      }),
    ).toThrow("Challenge setup must describe")
    actor.stop()
  })
  it("commits Challenge setup with its match and preserves it through hint changes and exit", async () => {
    const actor = await openProfile()
    const initial = selectCurrentPlayerData(actor.getSnapshot())
    if (initial === null) throw new Error("Profile must be ready")
    const challengeSetup: ChallengeSetup = {
      ...DEFAULT_CHALLENGE_SETUP,
      difficultyTargetElo: 1000,
      variant: "standard",
      playerColor: "black",
      chess960PositionId: null,
    }
    const match: DurableMatchRecord = {
      ...durableMatch(),
      mode: "challenge",
      opponentTargetElo: 1000,
      playerColor: "black",
    }
    const signal = new AbortController().signal
    await persistProfileActiveMatch({
      actor,
      candidate: match,
      challengeSetup,
      expectedActiveMatch: null,
      signal,
    })
    expect(selectCurrentPlayerData(actor.getSnapshot())).toEqual({
      ...initial,
      activeMatch: match,
      revision: initial.revision + 1,
      challengeHistory: {
        standard: {
          animals: [],
          difficulties: [
            {
              targetElo: 1000,
              lastPlayedAnimal: match.opponentId,
              highestMedal: null,
            },
          ],
        },
        chess960: { animals: [], difficulties: [] },
      },
      settings: { ...initial.settings, challengeSetup },
    })

    const updated: DurableMatchRecord = {
      ...match,
      autoHintMode: "auto-piece-hints",
    }
    await persistProfileActiveMatch({
      actor,
      candidate: updated,
      expectedActiveMatch: match,
      signal,
    })
    expect(selectCurrentPlayerData(actor.getSnapshot())?.settings).toEqual({
      autoHintMode: "auto-piece-hints",
      challengeSetup,
    })
    await persistProfileActiveMatch({
      actor,
      candidate: null,
      expectedActiveMatch: updated,
      signal,
    })
    actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "no-auto-hints",
    })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(selectCurrentPlayerData(actor.getSnapshot())).toMatchObject({
      activeMatch: null,
      ratings: initial.ratings,
      settings: { autoHintMode: "no-auto-hints", challengeSetup },
    })
    actor.stop()
  })

  it("atomically replaces and clears the active match", async () => {
    const actor = await openProfile()
    const initialMatch = durableMatch()
    const replacementMatch = durableMatch("00000005000000060000000700000008")
    const controller = new AbortController()

    await persistProfileActiveMatch({
      actor,
      candidate: initialMatch,
      expectedActiveMatch: null,
      signal: controller.signal,
    })
    await persistProfileActiveMatch({
      actor,
      candidate: replacementMatch,
      expectedActiveMatch: initialMatch,
      signal: controller.signal,
    })
    expect(selectCurrentPlayerData(actor.getSnapshot())?.activeMatch).toEqual(
      replacementMatch,
    )

    await persistProfileActiveMatch({
      actor,
      candidate: null,
      expectedActiveMatch: replacementMatch,
      signal: controller.signal,
    })
    expect(selectCurrentPlayerData(actor.getSnapshot())?.activeMatch).toBeNull()
    actor.stop()
  })

  it("rejects replacement when the expected active match is stale", async () => {
    const actor = await openProfile()
    const acceptedMatch = durableMatch("00000005000000060000000700000008")
    const controller = new AbortController()

    await persistProfileActiveMatch({
      actor,
      candidate: acceptedMatch,
      expectedActiveMatch: null,
      signal: controller.signal,
    })

    await expect(
      persistProfileActiveMatch({
        actor,
        candidate: durableMatch("000000090000000a0000000b0000000c"),
        expectedActiveMatch: durableMatch(),
        signal: controller.signal,
      }),
    ).rejects.toThrow("Canonical active match changed")
    expect(selectCurrentPlayerData(actor.getSnapshot())?.activeMatch).toEqual(
      acceptedMatch,
    )
    actor.stop()
  })

  it("accepts one conclusion and rejects every later result change", async () => {
    const actor = await openProfile()
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
        autoHintMode: initialMatch.autoHintMode,
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
        autoHintMode: initialMatch.autoHintMode,
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
      autoHintMode: initialMatch.autoHintMode,
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
    const actor = await openProfile()
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
        autoHintMode: initialMatch.autoHintMode,
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
          autoHintMode: initialMatch.autoHintMode,
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

  it("waits behind a profile write and syncs the active hint preference", async () => {
    const actor = await openProfile()
    actor.send({
      autoHintMode: "no-auto-hints",
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
    })
    const initialMatch = durableMatch()
    const bridge = new ProfileMatchPersistenceBridge({
      actor,
      expectedActiveMatch: null,
      initialMatch,
    })
    const controller = new AbortController()
    await bridge.establish(controller.signal)
    actor.send({
      autoHintMode: "no-auto-hints",
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
    })
    expect(selectCurrentPlayerData(actor.getSnapshot())?.settings).toEqual({
      ...createInitialMapachessPlayerData().settings,
      autoHintMode: "auto-move-hints",
    })
    const persistence = bridge.persist(
      {
        autoHintMode: initialMatch.autoHintMode,
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
      settings: { autoHintMode: "auto-move-hints" },
    })
    actor.stop()
  })

  it("refuses to overwrite an independently replaced active match", async () => {
    const actor = await openProfile()
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
          autoHintMode: initialMatch.autoHintMode,
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
