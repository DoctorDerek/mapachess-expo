import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import { createMapachessPortableBackup } from "@mapachess/profile/portable-backup"
import { MAPACHESS_GDD_REVISION } from "@mapachess/profile/portable-files"
import webPackage from "../../package.json"
import webSha256, { type Sha256SubtleCrypto } from "./webSha256"

export {
  MAPACHESS_GDD_REVISION,
  MAPACHESS_PLAYER_DATA_BACKUP_FILE_NAME,
  MAPACHESS_UNREADABLE_DATA_FILE_NAME,
} from "@mapachess/profile/portable-files"

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
