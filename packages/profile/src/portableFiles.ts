import { MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS } from "./portableBackup.js"

export const MAPACHESS_GDD_REVISION = "v5.5" as const
export const MAPACHESS_PLAYER_DATA_BACKUP_FILE_NAME =
  "mapachess-player-data.json" as const
export const MAPACHESS_UNREADABLE_DATA_FILE_NAME =
  "mapachess-unreadable-player-data.txt" as const

export const MAX_PORTABLE_BACKUP_UTF8_BYTES =
  MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS * 3
