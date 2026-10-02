import { levelProgress, xpAtLevel } from "./globalXp.js"

const MINIMUM_PROGRESSION_MS = 3700
const FULL_LEVEL_BAR_MS = 900

export type LevelProgressionSpan = Readonly<{
  level: number
  fromXp: number
  toXp: number
  fromFraction: number
  toFraction: number
  durationMs: number
}>

export const easeOutQuad = (elapsedFraction: number): number =>
  1 - (1 - elapsedFraction) ** 2

export function levelProgressionTiming(
  beforeXp: number,
  afterXp: number,
): Readonly<{ distance: number; durationMs: number }> {
  const before = levelProgress(beforeXp)
  const after = levelProgress(afterXp)
  const distance = Math.abs(
    after.level -
      before.level +
      (after.current / after.required - before.current / before.required),
  )
  return Object.freeze({
    distance,
    durationMs:
      distance === 0
        ? 0
        : Math.max(MINIMUM_PROGRESSION_MS, FULL_LEVEL_BAR_MS * distance),
  })
}

export default function* levelProgressionSpans(
  beforeXp: number,
  afterXp: number,
): Generator<LevelProgressionSpan, void, unknown> {
  const timing = levelProgressionTiming(beforeXp, afterXp)
  const ascending = afterXp > beforeXp
  let fromXp = beforeXp

  while (fromXp !== afterXp) {
    let level = levelProgress(fromXp).level
    if (!ascending && fromXp === xpAtLevel(level)) level -= 1
    const start = xpAtLevel(level)
    const end = xpAtLevel(level + 1)
    const toXp = ascending ? Math.min(end, afterXp) : Math.max(start, afterXp)
    const fromFraction = (fromXp - start) / (end - start)
    const toFraction = (toXp - start) / (end - start)
    yield Object.freeze({
      level,
      fromXp,
      toXp,
      fromFraction,
      toFraction,
      durationMs:
        (timing.durationMs * Math.abs(toFraction - fromFraction)) /
        timing.distance,
    })
    fromXp = toXp
  }
}
