import {
  createChess960InitialFen,
  parseChess960PositionId,
} from "@mapachess/match/chess960-position"
import createCalibrationPlan, {
  CALIBRATION_PLAN_SCHEMA_VERSION,
} from "./calibrationPlan.js"
import { calibrationSmokePolicy } from "./standardCalibrationSmokePlan.js"

const parsed = parseChess960PositionId(0)
if (!parsed.ok) throw new Error("The Chess960 smoke position must be valid.")

const chess960CalibrationSmokePlan = createCalibrationPlan({
  schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
  seed: 42,
  variant: "chess960",
  openings: [
    {
      id: "chess960-0",
      fen: createChess960InitialFen(parsed.positionId),
      chess960PositionId: parsed.positionId,
    },
  ],
  edges: [
    {
      id: "nodes-1000-vs-2000",
      pairsPerOpening: 1,
      policyA: calibrationSmokePolicy(1_000, "chess960"),
      policyB: calibrationSmokePolicy(2_000, "chess960"),
    },
  ],
})

export default chess960CalibrationSmokePlan
