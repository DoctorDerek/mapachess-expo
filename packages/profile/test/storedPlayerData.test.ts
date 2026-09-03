import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import createInitialMapachessPlayerData from "../src/playerData.js"
import {
  decodeStoredPlayerData,
  encodeStoredPlayerData,
  MAPACHESS_STORED_PLAYER_DATA_FORMAT,
  MAPACHESS_STORED_PLAYER_DATA_FORMAT_VERSION,
  MAX_STORED_PLAYER_DATA_UTF16_CODE_UNITS,
} from "../src/storedPlayerData.js"
import portableActiveChickenV1 from "./fixtures/portableActiveChickenV1.json"

const sha256 = async (canonicalValue: string): Promise<string> =>
  createHash("sha256").update(canonicalValue).digest("hex")

describe("stored Mapachess player data", () => {
  it("round-trips the current schema with verified integrity", async () => {
    const data = createInitialMapachessPlayerData()
    const encoded = await encodeStoredPlayerData(data, sha256)

    await expect(decodeStoredPlayerData(encoded, sha256)).resolves.toEqual({
      data,
      ok: true,
    })
  })

  it("detects payload damage without silently resetting it", async () => {
    const encoded = await encodeStoredPlayerData(
      createInitialMapachessPlayerData(),
      sha256,
    )
    const damaged = encoded.replace(
      '"autoHintMode":"auto-move-hints"',
      '"autoHintMode":"no-auto-hints"',
    )

    await expect(decodeStoredPlayerData(damaged, sha256)).resolves.toEqual({
      issue: { type: "PROFILE.STORED_DATA_INTEGRITY_MISMATCH" },
      ok: false,
    })
  })

  it("authenticates legacy bytes before migrating their player schema", async () => {
    const legacyStoredData = JSON.stringify({
      format: MAPACHESS_STORED_PLAYER_DATA_FORMAT,
      formatVersion: MAPACHESS_STORED_PLAYER_DATA_FORMAT_VERSION,
      integrity: portableActiveChickenV1.integrity,
      payload: portableActiveChickenV1.payload,
      saveSchemaVersion: 1,
    })

    await expect(
      decodeStoredPlayerData(legacyStoredData, sha256),
    ).resolves.toMatchObject({
      data: {
        activeMatch: {
          autoHintMode: "auto-move-hints",
          recordVersion: 3,
        },
        schemaVersion: 2,
        settings: { autoHintMode: "no-auto-hints" },
      },
      ok: true,
    })
  })

  it("rejects oversized and unsupported future storage envelopes", async () => {
    await expect(
      decodeStoredPlayerData(
        "x".repeat(MAX_STORED_PLAYER_DATA_UTF16_CODE_UNITS + 1),
        sha256,
      ),
    ).resolves.toEqual({
      issue: { type: "PROFILE.STORED_DATA_INVALID" },
      ok: false,
    })

    const encoded = await encodeStoredPlayerData(
      createInitialMapachessPlayerData(),
      sha256,
    )
    const future = encoded.replace('"formatVersion":1', '"formatVersion":2')
    await expect(decodeStoredPlayerData(future, sha256)).resolves.toEqual({
      issue: {
        receivedVersion: 2,
        type: "PROFILE.STORED_DATA_VERSION_UNSUPPORTED",
      },
      ok: false,
    })
  })
})
