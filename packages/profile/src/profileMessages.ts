import loadCatalog, {
  type MapachessCatalog,
} from "@mapachess/localization/catalog"
import type {
  ProfileImportIssue,
  ProfilePersistenceFailure,
} from "./profileMachineTypes.js"

export const importIssueMessage = (
  issue: ProfileImportIssue,
  copy: MapachessCatalog["profile"] = loadCatalog("en").profile,
): string => {
  switch (issue.type) {
    case "PROFILE.BACKUP_INTEGRITY_MISMATCH":
      return copy.importIssue.integrity
    case "PROFILE.BACKUP_TOO_LARGE":
      return copy.importIssue.size
    case "PROFILE.BACKUP_VERSION_UNSUPPORTED":
    case "PROFILE.SCHEMA_VERSION_UNSUPPORTED":
      return copy.importIssue.version
    case "PROFILE.BACKUP_READ_FAILED":
      return copy.importIssue.read
    default:
      return copy.importIssue.invalid
  }
}

export const persistenceFailureMessage = (
  failure: ProfilePersistenceFailure,
  copy: MapachessCatalog["profile"] = loadCatalog("en").profile,
): string => {
  switch (failure.type) {
    case "PROFILE.STORAGE_CONFLICT":
      return copy.persistenceFailure.conflict
    case "PROFILE.STORAGE_VERIFICATION_FAILED":
      return copy.persistenceFailure.verification
    case "PROFILE.STORAGE_REQUEST_FAILED":
      return copy.persistenceFailure.request
    default:
      return copy.persistenceFailure.unsafe
  }
}
