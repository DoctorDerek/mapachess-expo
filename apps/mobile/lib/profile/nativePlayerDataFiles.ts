import { getDocumentAsync } from "expo-document-picker"
import { File, Paths } from "expo-file-system"
import { isAvailableAsync, shareAsync } from "expo-sharing"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import {
  createMapachessPortableBackup,
  MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS,
} from "@mapachess/profile/portable-backup"
import {
  MAPACHESS_GDD_REVISION,
  MAPACHESS_PLAYER_DATA_BACKUP_FILE_NAME,
  MAX_PORTABLE_BACKUP_UTF8_BYTES,
} from "@mapachess/profile/portable-files"
import mobilePackage from "../../package.json"
import expoSha256 from "./expoSha256"

export type NativeBackupReadResult =
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "too-large" }>
  | Readonly<{ status: "ready"; contents: string }>

export async function readNativePlayerDataBackup(
  signal: AbortSignal,
): Promise<NativeBackupReadResult> {
  const selection = await getDocumentAsync({
    type: ["application/json", "text/plain", "application/octet-stream"],
    multiple: false,
    copyToCacheDirectory: true,
  })
  if (selection.canceled) return { status: "cancelled" }
  const selected = selection.assets[0]
  if (selected === undefined) return { status: "cancelled" }
  const file = new File(selected.uri)
  const ownedCacheCopy = file.uri.startsWith(
    `${Paths.cache.uri.replace(/\/$/, "")}/`,
  )
  try {
    if (signal.aborted) return { status: "cancelled" }
    if ((selected.size ?? file.size) > MAX_PORTABLE_BACKUP_UTF8_BYTES)
      return { status: "too-large" }
    const contents = await file.text()
    if (signal.aborted) return { status: "cancelled" }
    return contents.length > MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS
      ? { status: "too-large" }
      : { status: "ready", contents }
  } finally {
    if (ownedCacheCopy && file.exists) file.delete()
  }
}

export async function shareNativeTextFile(
  contents: string,
  name: string,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return
  if (!(await isAvailableAsync()))
    throw new Error("Native file sharing is unavailable.")
  if (signal.aborted) return
  const file = new File(Paths.cache, name)
  file.create({ overwrite: true })
  try {
    file.write(contents)
    if (!signal.aborted)
      await shareAsync(file.uri, {
        mimeType: name.endsWith(".json") ? "application/json" : "text/plain",
      })
  } finally {
    if (file.exists) file.delete()
  }
}

export async function exportNativePlayerData(
  data: MapachessPlayerData,
  signal: AbortSignal,
): Promise<void> {
  const contents = await createMapachessPortableBackup({
    applicationVersion: mobilePackage.version,
    gddRevision: MAPACHESS_GDD_REVISION,
    playerData: data,
    sha256: expoSha256,
  })
  await shareNativeTextFile(
    contents,
    MAPACHESS_PLAYER_DATA_BACKUP_FILE_NAME,
    signal,
  )
}
