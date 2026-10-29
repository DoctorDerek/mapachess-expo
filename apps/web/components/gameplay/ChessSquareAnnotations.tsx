import cx from "classix"
import type { ChessBoardPalette } from "@mapachess/match-presentation/chess-board-palettes"
import type { LastMoveHighlight } from "@mapachess/match-presentation/last-move-highlight"

const LEGAL_CORNERS = "M0 24V0H24 M76 0H100V24 M100 76V100H76 M24 100H0V76"

export default function ChessSquareAnnotations({
  checked,
  controller,
  history,
  legal,
  palette,
  selected,
}: Readonly<{
  checked: boolean
  controller: boolean
  history: LastMoveHighlight | null
  legal: boolean
  palette: ChessBoardPalette
  selected: boolean
}>) {
  return (
    <>
      {history === null ? null : (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full opacity-94"
          data-last-move={history}
          preserveAspectRatio="none"
          viewBox="0 0 1 1"
        >
          <rect fill={palette.history[history]} width="1" height="1" />
        </svg>
      )}
      {checked ? (
        <span
          aria-hidden="true"
          className="border-board-check bg-board-check/30 pointer-events-none absolute inset-[7%] z-1 rounded-xs border-3 border-double"
          data-checked-king="true"
        />
      ) : null}
      {legal ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-[18%] z-5 size-[64%] overflow-visible opacity-84"
          data-legal-destination-shape="corners"
          fill="none"
          viewBox="0 0 100 100"
        >
          <path
            className="stroke-board-neutral-edge"
            d={LEGAL_CORNERS}
            strokeWidth="10"
          />
          <path
            className="stroke-board-neutral"
            d={LEGAL_CORNERS}
            strokeWidth="5"
          />
        </svg>
      ) : null}
      {selected ? (
        <span
          aria-hidden="true"
          className="border-board-neutral ring-board-neutral-edge pointer-events-none absolute inset-[3%] z-12 rounded-xs border-2 ring"
          data-board-selection="true"
        />
      ) : null}
      <span
        aria-hidden="true"
        className={cx(
          "border-board-neutral ring-board-neutral-edge inset-ring-board-neutral-edge pointer-events-none absolute inset-[4%] z-13 hidden border-2 border-dashed ring inset-ring group-focus-visible:block",
          controller && "group-focus:block",
        )}
        data-board-focus="true"
      />
    </>
  )
}
