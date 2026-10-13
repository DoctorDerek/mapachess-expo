import loadCatalog from "@mapachess/localization/catalog"
import { MOVE_CLASSIFICATION_THRESHOLDS } from "./moveClassification.js"

export const MOVE_CLASSIFICATION_TABLE = loadCatalog("en").classification.table(
  MOVE_CLASSIFICATION_THRESHOLDS,
)
export const MOVE_MATE_CLASSIFICATION_TABLE = loadCatalog(
  "en",
).classification.mateTable(MOVE_CLASSIFICATION_THRESHOLDS)
