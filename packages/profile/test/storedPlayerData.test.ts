import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import createInitialMapachessPlayerData from "../src/playerData.js"
import {
  decodeStoredPlayerData,
  encodeStoredPlayerData,
  MAX_STORED_PLAYER_DATA_UTF16_CODE_UNITS,
} from "../src/storedPlayerData.js"

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
      '"autoHintsEnabled":true',
      '"autoHintsEnabled":false',
    )

    await expect(decodeStoredPlayerData(damaged, sha256)).resolves.toEqual({
      issue: { type: "PROFILE.STORED_DATA_INTEGRITY_MISMATCH" },
      ok: false,
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
