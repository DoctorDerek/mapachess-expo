import { useMemo } from "react"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import {
  boardDestinationMoves,
  createBoardSquareRows,
  hintDescriptionsForSquare,
} from "@mapachess/match-presentation/board-presentation"
import type { ChessBoardPalette } from "@mapachess/match-presentation/chess-board-palettes"
import lastMoveHighlight, {
  type LastMoveHighlight,
} from "@mapachess/match-presentation/last-move-highlight"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import type {
  AppliedMatchMove,
  LegalMatchMove,
} from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  type MatchColor,
  type MatchPosition,
  type MatchSquare,
} from "@mapachess/match/match-position"
import BetterHints from "./BetterHints.js"
import type { BoardElements, BoardInput, BoardPaint } from "./boardElements.js"

const LEGAL_CORNERS = "M0 24V0H24 M76 0H100V24 M100 76V100H76 M24 100H0V76"

export function BoardBackground({
  elements,
  orientation,
}: Readonly<{ elements: BoardElements; orientation: MatchColor }>) {
  const { Group } = elements
  return (
    <Group decorative className="absolute inset-0 flex flex-col">
      {createBoardSquareRows(orientation).map((row, rowIndex) => (
        <Group kind="row" key={row[0]} className="flex flex-1 flex-row">
          {row.map((square, column) => (
            <Group
              key={square}
              className={
                (rowIndex + column) % 2 === 0
                  ? "bg-mapachito-white flex-1"
                  : "bg-mapachito-blue flex-1"
              }
            >
              {null}
            </Group>
          ))}
        </Group>
      ))}
    </Group>
  )
}

export function BoardHistory({
  history,
  palette,
  elements,
}: Readonly<{
  history: LastMoveHighlight
  palette: ChessBoardPalette
  elements: BoardElements
}>) {
  const { Svg, Rect } = elements
  const fill: BoardPaint =
    history === "origin"
      ? palette === "dark"
        ? "--color-board-history-origin-on-dark"
        : "--color-board-history-origin"
      : palette === "dark"
        ? "--color-board-history-destination-on-dark"
        : "--color-board-history-destination"
  return (
    <Svg
      annotation={
        history === "origin" ? "history-origin" : "history-destination"
      }
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 1 1"
      opacity={0.94}
    >
      <Rect width={1} height={1} fill={fill} />
    </Svg>
  )
}

export function BoardSquareAnnotations({
  checked,
  controller,
  focused,
  legal,
  selected,
  elements,
}: Readonly<{
  checked: boolean
  controller: boolean
  focused: boolean
  legal: boolean
  selected: boolean
  elements: BoardElements
}>) {
  const { Svg, Rect, Path, Focus } = elements
  return (
    <>
      {checked ? (
        <Svg
          annotation="check"
          className="pointer-events-none absolute inset-[7%] z-1 size-[86%]"
          viewBox="0 0 100 100"
        >
          <Rect
            x={2}
            y={2}
            width={96}
            height={96}
            fill="--color-board-check"
            opacity={0.3}
          />
          <Rect
            x={2}
            y={2}
            width={96}
            height={96}
            fill="none"
            stroke="--color-board-check"
            strokeWidth={3}
          />
          <Rect
            x={7}
            y={7}
            width={86}
            height={86}
            fill="none"
            stroke="--color-board-check"
            strokeWidth={1}
          />
        </Svg>
      ) : null}
      {legal ? (
        <Svg
          annotation="legal"
          className="pointer-events-none absolute inset-[18%] z-5 size-[64%] overflow-visible"
          viewBox="0 0 100 100"
          opacity={0.84}
        >
          <Path
            d={LEGAL_CORNERS}
            fill="none"
            stroke="--color-board-neutral-edge"
            strokeWidth={10}
          />
          <Path
            d={LEGAL_CORNERS}
            fill="none"
            stroke="--color-board-neutral"
            strokeWidth={5}
          />
        </Svg>
      ) : null}
      {selected ? (
        <Svg
          annotation="selection"
          className="pointer-events-none absolute inset-[3%] z-12 size-[94%]"
          viewBox="0 0 100 100"
        >
          <Rect
            x={2}
            y={2}
            width={96}
            height={96}
            fill="none"
            stroke="--color-board-neutral-edge"
            strokeWidth={6}
          />
          <Rect
            x={2}
            y={2}
            width={96}
            height={96}
            fill="none"
            stroke="--color-board-neutral"
            strokeWidth={3}
          />
        </Svg>
      ) : null}
      {focused ? (
        <Focus
          className="pointer-events-none absolute inset-[4%] z-13"
          focused={focused}
          controller={controller}
        >
          <Svg annotation="focus" className="size-full" viewBox="0 0 100 100">
            <Rect
              x={3}
              y={3}
              width={94}
              height={94}
              fill="none"
              stroke="--color-board-neutral-edge"
              strokeWidth={6}
            />
            <Rect
              x={3}
              y={3}
              width={94}
              height={94}
              fill="none"
              stroke="--color-board-neutral"
              strokeWidth={3}
              strokeDasharray="8 5"
            />
          </Svg>
        </Focus>
      ) : null}
    </>
  )
}

export default function BoardGrid({
  position,
  orientation,
  legalMoves,
  selectedSquare,
  disabled,
  hints,
  showMoveHints,
  lastMove,
  palette,
  copy,
  elements,
  input,
  label,
}: Readonly<{
  position: MatchPosition
  orientation: MatchColor
  legalMoves: readonly LegalMatchMove[]
  selectedSquare: MatchSquare | null
  disabled: boolean
  hints: BetterHintsResult | null
  showMoveHints: boolean
  lastMove: AppliedMatchMove | null
  palette: ChessBoardPalette
  copy: MapachessCatalog["board"]
  elements: BoardElements
  input: BoardInput | null
  label?: string
}>) {
  const { Surface, Group, Square, Artwork, Piece, Text } = elements
  const rows = useMemo(() => createBoardSquareRows(orientation), [orientation])
  const selectedMoves = legalMoves.filter(
    (move) => move.from === selectedSquare,
  )
  return (
    <Surface
      label={label ?? copy.orientation(orientation)}
      input={input}
      className={
        input === null
          ? "border-mapachito-charcoal relative aspect-square w-full min-w-0 overflow-hidden rounded-lg border-2"
          : "border-mapachito-charcoal relative aspect-square w-full min-w-0 overflow-hidden border"
      }
    >
      {(controller) => (
        <>
          <Artwork orientation={orientation}>
            <BoardBackground elements={elements} orientation={orientation} />
          </Artwork>
          {lastMove === null ? null : (
            <Group
              decorative
              kind="layer"
              className="pointer-events-none absolute inset-0 z-0 flex flex-col"
            >
              {rows.map((row) => (
                <Group kind="row" key={row[0]} className="flex flex-1 flex-row">
                  {row.map((square) => {
                    const history = lastMoveHighlight(lastMove, square)
                    return (
                      <Group key={square} className="relative min-w-0 flex-1">
                        {history === null ? null : (
                          <BoardHistory
                            history={history}
                            palette={palette}
                            elements={elements}
                          />
                        )}
                      </Group>
                    )
                  })}
                </Group>
              ))}
            </Group>
          )}
          {hints === null ? null : (
            <BetterHints
              hints={hints}
              orientation={orientation}
              showMoves={showMoveHints}
              palette={palette}
              elements={elements}
            />
          )}
          <Group
            kind="rowgroup"
            decorative={input === null}
            className="absolute inset-0 z-10 flex flex-col"
          >
            {rows.map((row, rowIndex) => (
              <Group
                kind="row"
                key={row[0]}
                className="flex min-h-0 flex-1 flex-row"
              >
                {row.map((square, columnIndex) => {
                  const piece = position.pieces.find(
                    (entry) => entry.square === square,
                  )
                  const selected = selectedSquare === square
                  const legal =
                    boardDestinationMoves(selectedMoves, square).length > 0
                  const content = (
                    <>
                      {input === null ? null : (
                        <BoardSquareAnnotations
                          checked={
                            position.inCheck &&
                            piece?.color === position.turn &&
                            piece.role === "king"
                          }
                          controller={controller}
                          focused={input.focusedSquare === square}
                          legal={legal}
                          selected={selected}
                          elements={elements}
                        />
                      )}
                      {piece === undefined ? null : (
                        <Group
                          decorative
                          kind="piece"
                          className="pointer-events-none relative z-10 size-full select-none"
                        >
                          <Piece
                            color={piece.color}
                            role={piece.role}
                            fitToSquare={input === null}
                          />
                        </Group>
                      )}
                      {input !== null && columnIndex === 0 ? (
                        <Text className="text-mapachito-charcoal bg-mapachito-white/90 pointer-events-none absolute top-0.5 left-0.5 z-10 rounded-sm px-0.5 font-mono text-[clamp(0.55rem,1.4vw,0.75rem)] font-black">
                          {square.slice(1)}
                        </Text>
                      ) : null}
                      {input !== null && rowIndex === rows.length - 1 ? (
                        <Text className="text-mapachito-charcoal bg-mapachito-white/90 pointer-events-none absolute right-0.5 bottom-0.5 z-10 rounded-sm px-0.5 font-mono text-[clamp(0.55rem,1.4vw,0.75rem)] font-black">
                          {square[0]}
                        </Text>
                      ) : null}
                    </>
                  )
                  const className =
                    "group relative aspect-square min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-0"
                  return input === null ? (
                    <Group className={className} key={square}>
                      {content}
                    </Group>
                  ) : (
                    <Square
                      key={square}
                      className={className}
                      square={square}
                      selected={selected}
                      disabled={disabled}
                      input={input}
                      label={copy.square(
                        square,
                        piece,
                        selected,
                        legal,
                        disabled,
                        hintDescriptionsForSquare(
                          hints,
                          showMoveHints,
                          square,
                          copy,
                        ),
                      )}
                    >
                      {content}
                    </Square>
                  )
                })}
              </Group>
            ))}
          </Group>
        </>
      )}
    </Surface>
  )
}

export function Chess960BoardPreview({
  value,
  orientation,
  copy,
  palette,
  elements,
}: Readonly<{
  value: string
  orientation: MatchColor
  copy: MapachessCatalog
  palette: ChessBoardPalette
  elements: BoardElements
}>) {
  const preview = useMemo(() => {
    const parsed = parseChess960PositionId(
      value.trim() === "" ? NaN : Number(value),
    )
    return parsed.ok
      ? {
          id: parsed.positionId,
          position: createInitialMatchPosition({
            variant: "chess960",
            chess960PositionId: parsed.positionId,
          }),
        }
      : null
  }, [value])
  const { Group } = elements
  return preview === null ? null : (
    <Group className="mx-auto mt-3 aspect-square w-full max-w-64 xl:mx-0">
      <BoardGrid
        position={preview.position}
        orientation={orientation}
        legalMoves={[]}
        selectedSquare={null}
        disabled
        hints={null}
        showMoveHints={false}
        lastMove={null}
        palette={palette}
        copy={copy.board}
        elements={elements}
        input={null}
        label={copy.setup.positionPreview(preview.id)}
      />
    </Group>
  )
}
