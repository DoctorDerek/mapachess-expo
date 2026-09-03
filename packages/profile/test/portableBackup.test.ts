import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import createInitialMapachessPlayerData from "../src/playerData.js"
import { decodeMapachessPlayerData } from "../src/playerDataCodec.js"
import {
  createMapachessPortableBackup,
  decodeMapachessPortableBackup,
  MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS,
} from "../src/portableBackup.js"
import portableActiveChickenV1 from "./fixtures/portableActiveChickenV1.json"

const sha256 = async (canonicalValue: string): Promise<string> =>
  createHash("sha256").update(canonicalValue).digest("hex")

describe("Mapachess portable backups", () => {
  it("accepts the synthetic cross-platform active-match fixture", async () => {
    await expect(
      decodeMapachessPortableBackup(
        JSON.stringify(portableActiveChickenV1),
        sha256,
      ),
    ).resolves.toMatchObject({
      backup: {
        payload: {
          activeMatch: {
            autoHintMode: "auto-move-hints",
            cursor: 1,
            moveHintsUsed: true,
            moveIds: ["e2e4", "e7e5"],
            pieceHintsUsed: true,
          },
          ratings: portableActiveChickenV1.payload.ratings,
          settings: { autoHintsEnabled: false },
        },
      },
      ok: true,
    })
  })

  it.each([
    [
      "an illegal replay move",
      {
        ...portableActiveChickenV1.payload.activeMatch,
        currentFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        cursor: 1,
        moveIds: ["e2e5"],
      },
      "$.activeMatch.moveIds[0]",
    ],
    [
      "a false current FEN",
      {
        ...portableActiveChickenV1.payload.activeMatch,
        currentFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      },
      "$.activeMatch.currentFen",
    ],
    [
      "Move Hint use without Piece Hint use",
      {
        ...portableActiveChickenV1.payload.activeMatch,
        pieceHintsUsed: false,
      },
      "$.activeMatch.moveHintsUsed",
    ],
    [
      "a cursor beyond the retained branch",
      {
        ...portableActiveChickenV1.payload.activeMatch,
        cursor: 3,
      },
      "$.activeMatch.cursor",
    ],
  ])("rejects %s before accepting its hash", async (_label, match, path) => {
    const corrupted = JSON.stringify({
      ...portableActiveChickenV1,
      payload: { ...portableActiveChickenV1.payload, activeMatch: match },
    })

    await expect(
      decodeMapachessPortableBackup(corrupted, sha256),
    ).resolves.toEqual({
      issue: { path, type: "PROFILE.DATA_INVALID" },
      ok: false,
    })
  })

  it("round-trips the canonical first-run profile", async () => {
    const playerData = createInitialMapachessPlayerData()
    const encoded = await createMapachessPortableBackup({
      applicationVersion: "0.0.0-test",
      gddRevision: "v1-test",
      playerData,
      sha256,
    })

    const decoded = await decodeMapachessPortableBackup(encoded, sha256)

    expect(decoded).toEqual({
      backup: {
        applicationVersion: "0.0.0-test",
        format: "mapachess-portable-backup",
        formatVersion: 1,
        gddRevision: "v1-test",
        integrity: {
          algorithm: "SHA-256",
          payloadHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
        },
        payload: playerData,
        saveSchemaVersion: 1,
      },
      ok: true,
    })
  })

  it("round-trips an exact active-match timeline and hint evidence", async () => {
    const initial = createInitialMapachessPlayerData()
    const decodedPlayerData = decodeMapachessPlayerData({
      ...initial,
      activeMatch: {
        autoHintsEnabledAtStart: true,
        currentFen:
          "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        cursor: 1,
        matchId: "standard-story-chicken/0123456789abcdef0123456789abcdef",
        matchSeed: "0123456789abcdef0123456789abcdef",
        mode: "story",
        moveHintsUsed: true,
        moveIds: ["e2e4", "e7e5"],
        opponentId: "chicken-stockfish",
        opponentPolicyFingerprint: "stockfish-18/standard-chicken/v1",
        pieceHintsUsed: true,
        playerColor: "white",
        playerEloAtStart: 100.25,
        recordVersion: 1,
        startingPosition: { chess960PositionId: null, variant: "standard" },
        timeControl: { type: "untimed" },
      },
      revision: 1,
    })
    if (!decodedPlayerData.ok) {
      throw new Error("Active-match fixture must decode")
    }

    const encoded = await createMapachessPortableBackup({
      applicationVersion: "0.0.0-test",
      gddRevision: "v1-test",
      playerData: decodedPlayerData.data,
      sha256,
    })

    await expect(
      decodeMapachessPortableBackup(encoded, sha256),
    ).resolves.toMatchObject({
      backup: { payload: decodedPlayerData.data },
      ok: true,
    })
  })

  it("rejects a payload changed after export", async () => {
    const encoded = await createMapachessPortableBackup({
      applicationVersion: "0.0.0-test",
      gddRevision: "v1-test",
      playerData: createInitialMapachessPlayerData(),
      sha256,
    })
    const tampered = encoded.replace(
      '"autoHintsEnabled": true',
      '"autoHintsEnabled": false',
    )

    await expect(
      decodeMapachessPortableBackup(tampered, sha256),
    ).resolves.toEqual({
      issue: {
        path: "$.integrity.payloadHash",
        type: "PROFILE.BACKUP_INTEGRITY_MISMATCH",
      },
      ok: false,
    })
  })

  it("rejects malformed, oversized, and future backup envelopes", async () => {
    await expect(decodeMapachessPortableBackup("{", sha256)).resolves.toEqual({
      issue: { path: "$", type: "PROFILE.BACKUP_INVALID" },
      ok: false,
    })
    await expect(
      decodeMapachessPortableBackup(
        "x".repeat(MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS + 1),
        sha256,
      ),
    ).resolves.toEqual({
      issue: { path: "$", type: "PROFILE.BACKUP_TOO_LARGE" },
      ok: false,
    })
    await expect(
      decodeMapachessPortableBackup(
        JSON.stringify({
          applicationVersion: "future",
          format: "mapachess-portable-backup",
          formatVersion: 2,
          gddRevision: "future",
          integrity: { algorithm: "SHA-256", payloadHash: "0".repeat(64) },
          payload: createInitialMapachessPlayerData(),
          saveSchemaVersion: 1,
        }),
        sha256,
      ),
    ).resolves.toEqual({
      issue: {
        receivedVersion: 2,
        type: "PROFILE.BACKUP_VERSION_UNSUPPORTED",
      },
      ok: false,
    })
  })
})

describe("Mapachess player-data decoding", () => {
  it("rejects unknown fields and unsupported newer save schemas", () => {
    expect(
      decodeMapachessPlayerData({
        ...createInitialMapachessPlayerData(),
        inventedField: true,
      }),
    ).toEqual({ issue: { path: "$", type: "PROFILE.DATA_INVALID" }, ok: false })

    expect(
      decodeMapachessPlayerData({
        ...createInitialMapachessPlayerData(),
        schemaVersion: 2,
      }),
    ).toEqual({
      issue: {
        receivedVersion: 2,
        type: "PROFILE.SCHEMA_VERSION_UNSUPPORTED",
      },
      ok: false,
    })
  })
})
