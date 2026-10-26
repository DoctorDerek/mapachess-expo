import type { BetterHint } from "@mapachess/match/better-hints"
import type { MatchColor, MatchSquare } from "@mapachess/match/match-position"

const BOARD_SIDE = 8
const FRAME_INSET = 0.1

export const BETTER_HINT_FRAME = Object.freeze({
  inset: FRAME_INSET,
  size: 1 - 2 * FRAME_INSET,
  radius: 0.12,
  width: 0.11,
  outlineWidth: 0.16,
  opponentDash: "0.35 0.14",
})

export const BETTER_HINT_RIBBON = Object.freeze({
  width: 0.26,
  outlineWidth: 0.04,
  headWidth: 0.86,
  headLength: 0.52,
  sourceOffset: 0.28,
  sharedDestinationInset: 0.29,
  minimumShaftLength: 0.12,
  shaftHeadOverlap: 0.05,
  opponentDashLength: 0.65,
  opponentGapLength: 0.24,
  opacity: 0.94,
})

export const BETTER_HINT_VIEW_BOX = `0 0 ${BOARD_SIDE} ${BOARD_SIDE}`

type BoardPoint = Readonly<{
  x: number
  y: number
}>

export type BetterHintGeometry = Readonly<{
  piece: BoardPoint
  source: BoardPoint
  destination: BoardPoint
  rotationDegrees: number
  shaftEnd: number
  opponentDash: string
  ribbonPath: string
  headPath: string
}>

const pointForSquare = (
  square: MatchSquare,
  orientation: MatchColor,
): BoardPoint => {
  const file = square.charCodeAt(0) - "a".charCodeAt(0)
  const rank = Number(square.slice(1)) - 1
  const farCenter = BOARD_SIDE - 0.5

  return orientation === "white"
    ? { x: file + 0.5, y: farCenter - rank }
    : { x: farCenter - file, y: rank + 0.5 }
}

const ribbonTravel = (hint: BetterHint): Pick<BetterHint, "from" | "to"> => {
  const rookMovement = hint.from === hint.to ? hint.castling : undefined
  return {
    from: rookMovement?.rookFrom ?? hint.from,
    to: rookMovement?.rookTo ?? hint.to,
  }
}

export default function createBetterHintGeometry(
  hint: BetterHint,
  orientation: MatchColor,
  visibleHints: readonly BetterHint[] = [hint],
): BetterHintGeometry {
  const travel = ribbonTravel(hint)
  const piece = pointForSquare(hint.from, orientation)
  const source = pointForSquare(travel.from, orientation)
  const destination = pointForSquare(travel.to, orientation)
  const deltaX = destination.x - source.x
  const deltaY = destination.y - source.y
  const distance = Math.hypot(deltaX, deltaY)
  const sharesDestination =
    visibleHints.filter((visible) => ribbonTravel(visible).to === travel.to)
      .length > 1
  const destinationInset = sharesDestination
    ? Math.min(
        BETTER_HINT_RIBBON.sharedDestinationInset,
        Math.max(
          0,
          distance -
            BETTER_HINT_RIBBON.headLength -
            BETTER_HINT_RIBBON.sourceOffset -
            BETTER_HINT_RIBBON.minimumShaftLength,
        ),
      )
    : 0
  const length = distance - destinationInset
  const neck = length - BETTER_HINT_RIBBON.headLength
  const halfWidth = BETTER_HINT_RIBBON.width / 2
  const halfHead = BETTER_HINT_RIBBON.headWidth / 2
  const start = BETTER_HINT_RIBBON.sourceOffset
  const shaftLength = neck - start
  const gap = Math.min(BETTER_HINT_RIBBON.opponentGapLength, shaftLength / 3)
  const dash = Math.min(
    BETTER_HINT_RIBBON.opponentDashLength,
    (shaftLength - gap) / 2,
  )

  return {
    piece,
    source,
    destination,
    rotationDegrees: (Math.atan2(deltaY, deltaX) * 180) / Math.PI,
    shaftEnd: neck + BETTER_HINT_RIBBON.shaftHeadOverlap,
    opponentDash: `${dash} ${gap}`,
    ribbonPath: [
      `M ${start} ${-halfWidth}`,
      `L ${neck} ${-halfWidth}`,
      `L ${neck} ${-halfHead}`,
      `L ${length} 0`,
      `L ${neck} ${halfHead}`,
      `L ${neck} ${halfWidth}`,
      `L ${start} ${halfWidth}`,
      `Q ${start - halfWidth} ${halfWidth} ${start - halfWidth} 0`,
      `Q ${start - halfWidth} ${-halfWidth} ${start} ${-halfWidth}`,
      "Z",
    ].join(" "),
    headPath: [
      `M ${neck} ${-halfWidth}`,
      `L ${neck} ${-halfHead}`,
      `L ${length} 0`,
      `L ${neck} ${halfHead}`,
      `L ${neck} ${halfWidth}`,
    ].join(" "),
  }
}
