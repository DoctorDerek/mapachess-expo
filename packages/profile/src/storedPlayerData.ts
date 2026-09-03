import {
  PlayerDataDecodeProblem,
  requireExactKeys,
  requireObject,
} from "./decodePrimitives.js"
import {
  MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  type MapachessPlayerData,
} from "./playerData.js"
import {
  canonicalPlayerData,
  decodeMapachessPlayerData,
  decodeMapachessPlayerDataWithSource,
  type PlayerDataDecodeIssue,
} from "./playerDataCodec.js"
import {
  isSha256Hex,
  requireSha256Hex,
  type Sha256HexDigest,
} from "./sha256.js"

export const MAPACHESS_STORED_PLAYER_DATA_FORMAT =
  "mapachess-stored-player-data" as const
export const MAPACHESS_STORED_PLAYER_DATA_FORMAT_VERSION = 1 as const
export const MAX_STORED_PLAYER_DATA_UTF16_CODE_UNITS = 5_242_880 as const

export type StoredPlayerDataDecodeIssue =
  | PlayerDataDecodeIssue
  | Readonly<{
      type:
        "PROFILE.STORED_DATA_INTEGRITY_MISMATCH" | "PROFILE.STORED_DATA_INVALID"
    }>
  | Readonly<{
      receivedVersion: number
      type: "PROFILE.STORED_DATA_VERSION_UNSUPPORTED"
    }>

export type StoredPlayerDataDecodeResult =
  | Readonly<{ data: MapachessPlayerData; ok: true }>
  | Readonly<{ issue: StoredPlayerDataDecodeIssue; ok: false }>

export const encodeStoredPlayerData = async (
  data: MapachessPlayerData,
  sha256: Sha256HexDigest,
): Promise<string> => {
  const decodedData = decodeMapachessPlayerData(data)
  if (!decodedData.ok) {
    throw new TypeError("Cannot store invalid Mapachess player data.")
  }

  return JSON.stringify({
    format: MAPACHESS_STORED_PLAYER_DATA_FORMAT,
    formatVersion: MAPACHESS_STORED_PLAYER_DATA_FORMAT_VERSION,
    integrity: {
      algorithm: "SHA-256",
      payloadHash: requireSha256Hex(
        await sha256(canonicalPlayerData(decodedData.data)),
      ),
    },
    payload: decodedData.data,
    saveSchemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  })
}

export const decodeStoredPlayerData = async (
  rawData: string,
  sha256: Sha256HexDigest,
): Promise<StoredPlayerDataDecodeResult> => {
  if (rawData.length > MAX_STORED_PLAYER_DATA_UTF16_CODE_UNITS) {
    return { issue: { type: "PROFILE.STORED_DATA_INVALID" }, ok: false }
  }

  let received: unknown
  try {
    received = JSON.parse(rawData) as unknown
  } catch {
    return { issue: { type: "PROFILE.STORED_DATA_INVALID" }, ok: false }
  }

  let object
  try {
    object = requireObject(received, "$")
    requireExactKeys(
      object,
      ["format", "formatVersion", "integrity", "payload", "saveSchemaVersion"],
      "$",
    )
  } catch (error) {
    if (error instanceof PlayerDataDecodeProblem) {
      return { issue: { type: "PROFILE.STORED_DATA_INVALID" }, ok: false }
    }
    throw error
  }

  if (object.format !== MAPACHESS_STORED_PLAYER_DATA_FORMAT) {
    return { issue: { type: "PROFILE.STORED_DATA_INVALID" }, ok: false }
  }
  if (
    typeof object.formatVersion === "number" &&
    object.formatVersion > MAPACHESS_STORED_PLAYER_DATA_FORMAT_VERSION
  ) {
    return {
      issue: {
        receivedVersion: object.formatVersion,
        type: "PROFILE.STORED_DATA_VERSION_UNSUPPORTED",
      },
      ok: false,
    }
  }
  if (object.formatVersion !== MAPACHESS_STORED_PLAYER_DATA_FORMAT_VERSION) {
    return { issue: { type: "PROFILE.STORED_DATA_INVALID" }, ok: false }
  }

  const decodedData = decodeMapachessPlayerDataWithSource(object.payload)
  if (!decodedData.ok) return decodedData
  if (object.saveSchemaVersion !== decodedData.source.schemaVersion) {
    return { issue: { type: "PROFILE.STORED_DATA_INVALID" }, ok: false }
  }

  let integrity
  try {
    integrity = requireObject(object.integrity, "$.integrity")
    requireExactKeys(integrity, ["algorithm", "payloadHash"], "$.integrity")
  } catch (error) {
    if (error instanceof PlayerDataDecodeProblem) {
      return { issue: { type: "PROFILE.STORED_DATA_INVALID" }, ok: false }
    }
    throw error
  }
  if (
    integrity.algorithm !== "SHA-256" ||
    !isSha256Hex(integrity.payloadHash)
  ) {
    return { issue: { type: "PROFILE.STORED_DATA_INVALID" }, ok: false }
  }

  const computedHash = requireSha256Hex(
    await sha256(decodedData.source.canonical),
  )
  return computedHash === integrity.payloadHash
    ? { data: decodedData.data, ok: true }
    : {
        issue: { type: "PROFILE.STORED_DATA_INTEGRITY_MISMATCH" },
        ok: false,
      }
}
