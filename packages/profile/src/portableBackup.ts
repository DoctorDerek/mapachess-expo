import {
  PlayerDataDecodeProblem,
  requireExactKeys,
  requireObject,
  requireString,
  type JsonObject,
} from "./decodePrimitives.js"
import {
  MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  type MapachessPlayerData,
} from "./playerData.js"
import {
  canonicalPlayerData,
  decodeMapachessPlayerData,
  type PlayerDataDecodeIssue,
} from "./playerDataCodec.js"

export const MAPACHESS_PORTABLE_BACKUP_FORMAT =
  "mapachess-portable-backup" as const
export const MAPACHESS_PORTABLE_BACKUP_FORMAT_VERSION = 1 as const
export const MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS = 5_242_880 as const

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/u

export type Sha256HexDigest = (canonicalValue: string) => Promise<string>

export type MapachessPortableBackup = Readonly<{
  applicationVersion: string
  format: typeof MAPACHESS_PORTABLE_BACKUP_FORMAT
  formatVersion: typeof MAPACHESS_PORTABLE_BACKUP_FORMAT_VERSION
  gddRevision: string
  integrity: Readonly<{
    algorithm: "SHA-256"
    payloadHash: string
  }>
  payload: MapachessPlayerData
  saveSchemaVersion: typeof MAPACHESS_PLAYER_DATA_SCHEMA_VERSION
}>

export type PortableBackupDecodeIssue =
  | PlayerDataDecodeIssue
  | Readonly<{
      path: string
      type:
        | "PROFILE.BACKUP_INVALID"
        | "PROFILE.BACKUP_INTEGRITY_MISMATCH"
        | "PROFILE.BACKUP_TOO_LARGE"
    }>
  | Readonly<{
      receivedVersion: number
      type: "PROFILE.BACKUP_VERSION_UNSUPPORTED"
    }>

export type PortableBackupDecodeResult =
  | Readonly<{ backup: MapachessPortableBackup; ok: true }>
  | Readonly<{ issue: PortableBackupDecodeIssue; ok: false }>

export type CreatePortableBackupInput = Readonly<{
  applicationVersion: string
  gddRevision: string
  playerData: MapachessPlayerData
  sha256: Sha256HexDigest
}>

const requireSha256Hex = (received: string): string => {
  const normalized = received.toLowerCase()
  if (!SHA256_HEX_PATTERN.test(normalized)) {
    throw new TypeError(
      "SHA-256 adapter returned a noncanonical hexadecimal digest.",
    )
  }
  return normalized
}

const requireBackupIdentity = (received: unknown, path: string): string =>
  requireString(received, path)

export const createMapachessPortableBackup = async (
  input: CreatePortableBackupInput,
): Promise<string> => {
  const decodedData = decodeMapachessPlayerData(input.playerData)
  if (!decodedData.ok) {
    throw new TypeError("Cannot export invalid Mapachess player data.")
  }

  const backup: MapachessPortableBackup = Object.freeze({
    applicationVersion: requireBackupIdentity(
      input.applicationVersion,
      "$.applicationVersion",
    ),
    format: MAPACHESS_PORTABLE_BACKUP_FORMAT,
    formatVersion: MAPACHESS_PORTABLE_BACKUP_FORMAT_VERSION,
    gddRevision: requireBackupIdentity(input.gddRevision, "$.gddRevision"),
    integrity: Object.freeze({
      algorithm: "SHA-256",
      payloadHash: requireSha256Hex(
        await input.sha256(canonicalPlayerData(decodedData.data)),
      ),
    }),
    payload: decodedData.data,
    saveSchemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
  })

  return JSON.stringify(backup, null, 2)
}

const backupFailure = (
  path: string,
  type: Extract<PortableBackupDecodeIssue, { path: string }>["type"],
): Extract<PortableBackupDecodeResult, { ok: false }> => ({
  issue: { path, type },
  ok: false,
})

const decodeBackupObject = (
  received: unknown,
):
  | Readonly<{ object: JsonObject; ok: true }>
  | Extract<PortableBackupDecodeResult, { ok: false }> => {
  try {
    const object = requireObject(received, "$")
    requireExactKeys(
      object,
      [
        "applicationVersion",
        "format",
        "formatVersion",
        "gddRevision",
        "integrity",
        "payload",
        "saveSchemaVersion",
      ],
      "$",
    )
    return { object, ok: true }
  } catch (error) {
    if (error instanceof PlayerDataDecodeProblem) {
      return backupFailure("$", "PROFILE.BACKUP_INVALID")
    }
    throw error
  }
}

export const decodeMapachessPortableBackup = async (
  rawBackup: string,
  sha256: Sha256HexDigest,
): Promise<PortableBackupDecodeResult> => {
  if (rawBackup.length > MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS) {
    return backupFailure("$", "PROFILE.BACKUP_TOO_LARGE")
  }

  let received: unknown
  try {
    received = JSON.parse(rawBackup) as unknown
  } catch {
    return backupFailure("$", "PROFILE.BACKUP_INVALID")
  }

  const decodedObject = decodeBackupObject(received)
  if (!decodedObject.ok) return decodedObject
  const object = decodedObject.object

  if (object.format !== MAPACHESS_PORTABLE_BACKUP_FORMAT) {
    return backupFailure("$.format", "PROFILE.BACKUP_INVALID")
  }
  if (
    typeof object.formatVersion === "number" &&
    object.formatVersion > MAPACHESS_PORTABLE_BACKUP_FORMAT_VERSION
  ) {
    return {
      issue: {
        receivedVersion: object.formatVersion,
        type: "PROFILE.BACKUP_VERSION_UNSUPPORTED",
      },
      ok: false,
    }
  }
  if (object.formatVersion !== MAPACHESS_PORTABLE_BACKUP_FORMAT_VERSION) {
    return backupFailure("$.formatVersion", "PROFILE.BACKUP_INVALID")
  }

  const decodedData = decodeMapachessPlayerData(object.payload)
  if (!decodedData.ok) return decodedData
  if (object.saveSchemaVersion !== decodedData.data.schemaVersion) {
    return backupFailure("$.saveSchemaVersion", "PROFILE.BACKUP_INVALID")
  }

  let applicationVersion: string
  let gddRevision: string
  let integrity: JsonObject
  try {
    applicationVersion = requireBackupIdentity(
      object.applicationVersion,
      "$.applicationVersion",
    )
    gddRevision = requireBackupIdentity(object.gddRevision, "$.gddRevision")
    integrity = requireObject(object.integrity, "$.integrity")
    requireExactKeys(integrity, ["algorithm", "payloadHash"], "$.integrity")
  } catch (error) {
    if (error instanceof PlayerDataDecodeProblem) {
      return backupFailure("$", "PROFILE.BACKUP_INVALID")
    }
    throw error
  }
  if (
    integrity.algorithm !== "SHA-256" ||
    typeof integrity.payloadHash !== "string" ||
    !SHA256_HEX_PATTERN.test(integrity.payloadHash)
  ) {
    return backupFailure("$.integrity", "PROFILE.BACKUP_INVALID")
  }

  const computedHash = requireSha256Hex(
    await sha256(canonicalPlayerData(decodedData.data)),
  )
  if (computedHash !== integrity.payloadHash) {
    return backupFailure(
      "$.integrity.payloadHash",
      "PROFILE.BACKUP_INTEGRITY_MISMATCH",
    )
  }

  return {
    backup: Object.freeze({
      applicationVersion,
      format: MAPACHESS_PORTABLE_BACKUP_FORMAT,
      formatVersion: MAPACHESS_PORTABLE_BACKUP_FORMAT_VERSION,
      gddRevision,
      integrity: Object.freeze({
        algorithm: "SHA-256",
        payloadHash: integrity.payloadHash,
      }),
      payload: decodedData.data,
      saveSchemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
    }),
    ok: true,
  }
}
