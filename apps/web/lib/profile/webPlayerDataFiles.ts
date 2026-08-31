import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import { createMapachessPortableBackup } from "@mapachess/profile/portable-backup"
import webPackage from "../../package.json"
import webSha256, { type Sha256SubtleCrypto } from "./webSha256"

export const MAPACHESS_GDD_REVISION = "v2.1" as const
export const MAPACHESS_PLAYER_DATA_BACKUP_FILE_NAME =
  "mapachess-player-data.json" as const
export const MAPACHESS_UNREADABLE_DATA_FILE_NAME =
  "mapachess-unreadable-player-data.txt" as const

export const createWebPlayerDataBackup = (
  playerData: MapachessPlayerData,
  subtleCrypto: Sha256SubtleCrypto,
): Promise<string> =>
  createMapachessPortableBackup({
    applicationVersion: webPackage.version,
    gddRevision: MAPACHESS_GDD_REVISION,
    playerData,
    sha256: (canonicalValue) => webSha256(canonicalValue, subtleCrypto),
  })

export const downloadTextFile = (
  contents: string,
  fileName: string,
  mediaType = "application/json;charset=utf-8",
): void => {
  const objectUrl = URL.createObjectURL(
    new Blob([contents], { type: mediaType }),
  )
  const link = document.createElement("a")
  link.download = fileName
  link.href = objectUrl
  try {
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }
}
