import { MOVE_CLASSIFICATION_THRESHOLDS as thresholds } from "./moveClassification.js"

export const MOVE_CLASSIFICATION_TABLE = [
  [
    "Brilliant !!",
    `An unusually large verified favorable improvement. In an ordinary position, the mover-relative outcome estimate improves by ${thresholds.brilliantGain} or more percentage points. In a retained forced-mate position, the mover saves two or more full mating moves beyond the normalized expected countdown.`,
  ],
  [
    "Genius !",
    `A large verified favorable improvement. In an ordinary position, the mover-relative outcome estimate improves by at least ${thresholds.geniusGain} but less than ${thresholds.brilliantGain} percentage points. In a retained forced-mate position, the mover saves one full mating move beyond the normalized expected countdown.`,
  ],
  [
    "Best ★",
    "The engine’s recommended move when no stronger positive or negative classification applies. Best is not required for a move to be Good, Genius, or Brilliant.",
  ],
  [
    "Good ✓",
    `A sound move that does not meet a stronger positive threshold or an error threshold. This includes an ordinary outcome change below ${thresholds.geniusGain} points, preservation of the position, a forced mate that remains on schedule, or a forced mate that takes one additional full move while remaining forced.`,
  ],
  [
    "Inaccuracy ?!",
    `An ordinary mover-relative outcome loss of at least ${thresholds.inaccuracyLoss} but less than ${thresholds.mistakeLoss} points; two additional full mating moves while the mover’s forced mate remains; or loss of a verified forced mate with an outcome-scale loss below ${thresholds.mistakeLoss} points. The latter displays the reason Lost forced mate.`,
  ],
  [
    "Mistake ?",
    `An ordinary mover-relative outcome loss of at least ${thresholds.mistakeLoss} but less than ${thresholds.blunderLoss} points; three or more additional full mating moves while the mover’s forced mate remains; or loss of a verified forced mate with an outcome-scale loss of at least ${thresholds.mistakeLoss} but less than ${thresholds.blunderLoss} points. The latter displays the reason Lost forced mate.`,
  ],
  [
    "Blunder ??",
    `An ordinary mover-relative outcome loss of ${thresholds.blunderLoss} or more points; or loss of a verified forced mate with an outcome-scale loss of ${thresholds.blunderLoss} or more points. The latter displays the reason Lost forced mate.`,
  ],
] as const

export const MOVE_MATE_CLASSIFICATION_TABLE = [
  [
    "Mover’s forced mate is two or more full moves faster than the normalized expected countdown",
    "Brilliant !!",
  ],
  ["Mover’s forced mate is one full move faster", "Genius !"],
  [
    "Mover’s forced mate is on schedule",
    "Best ★ when engine-recommended; otherwise Good ✓",
  ],
  ["Mover’s forced mate is one full move slower but remains forced", "Good ✓"],
  [
    "Mover’s forced mate is two full moves slower but remains forced",
    "Inaccuracy ?!",
  ],
  [
    "Mover’s forced mate is three or more full moves slower but remains forced",
    "Mistake ?",
  ],
  [
    `Mover loses a verified forced mate and the remaining mover-relative outcome loss is below ${thresholds.mistakeLoss} points`,
    "Inaccuracy ?! with reason Lost forced mate",
  ],
  [
    `Mover loses a verified forced mate and the remaining outcome loss is at least ${thresholds.mistakeLoss} but less than ${thresholds.blunderLoss} points`,
    "Mistake ? with reason Lost forced mate",
  ],
  [
    `Mover loses a verified forced mate and the remaining outcome loss is ${thresholds.blunderLoss} or more points`,
    "Blunder ?? with reason Lost forced mate",
  ],
] as const
