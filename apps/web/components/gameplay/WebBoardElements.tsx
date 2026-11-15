"use client"

import cx from "classix"
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ComponentProps,
  type KeyboardEvent,
} from "react"
import {
  boardShapeGeometry,
  type BoardElements,
  type BoardGroupProps,
  type BoardPaint,
  type BoardShapeProps,
  type BoardSquareProps,
  type BoardSurfaceProps,
  type BoardVectorMetadata,
} from "@mapachess/application-ui/board-elements"
import type { BoardNavigationKey } from "@mapachess/match-presentation/board-presentation"
import type { MatchSquare } from "@mapachess/match/match-position"
import { actionForKeyboardCode } from "@mapachess/match/player-input"
import {
  ChessBoardArtwork,
  ChessPiece,
} from "@/components/gameplay/ChessArtwork"
import {
  usePlayerInput,
  usePlayerInputScope,
} from "@/components/input/PlayerInputProvider"
import MapachessButton from "@/components/presentation/MapachessButton"
import MapachessDialog from "@/components/presentation/MapachessDialog"
import ScrollActions from "@/components/presentation/ScrollActions"

const Squares = createContext<Map<MatchSquare, HTMLButtonElement> | null>(null)
const vectorMetadata = (props: BoardVectorMetadata) => ({
  "data-destination-x": props.destinationX,
  "data-destination-y": props.destinationY,
  "data-hint-kind": props.hintKind,
  "data-hint-owner": props.owner,
  "data-hint-pattern": props.pattern,
  "data-hint-stroke": props.strokePart,
  "data-source-x": props.sourceX,
  "data-source-y": props.sourceY,
  "data-last-move":
    props.annotation === "history-origin"
      ? "origin"
      : props.annotation === "history-destination"
        ? "destination"
        : undefined,
  "data-checked-king": props.annotation === "check" ? true : undefined,
  "data-board-selection": props.annotation === "selection" ? true : undefined,
  "data-board-focus": props.annotation === "focus" ? true : undefined,
  "data-legal-destination-shape":
    props.annotation === "legal" ? "corners" : undefined,
})
const paint = (token: BoardPaint | undefined): string | undefined =>
  token === undefined || token === "none" ? token : `var(${token})`
const shapeProps = (props: BoardShapeProps) => ({
  ...vectorMetadata(props),
  ...boardShapeGeometry(props),
  fill: paint(props.fill),
  stroke: paint(props.stroke),
})

function Group({ children, className, kind, decorative }: BoardGroupProps) {
  return (
    <div
      className={cx(
        className,
        kind === "frame" && "[container-type:inline-size]",
      )}
      role={kind === "row" && !decorative ? "row" : undefined}
      aria-hidden={decorative}
    >
      {children}
    </div>
  )
}
function Surface({ children, className, label, input }: BoardSurfaceProps) {
  const root = useRef<HTMLDivElement>(null)
  const squares = useRef(new Map<MatchSquare, HTMLButtonElement>())
  const device = usePlayerInput()
  const actor = input?.actor
  useEffect(() => {
    const subscription = actor?.on("BOARD.FOCUS_REQUESTED", ({ square }) =>
      squares.current.get(square)?.focus(),
    )
    return () => subscription?.unsubscribe()
  }, [actor])
  usePlayerInputScope({
    root,
    focused: true,
    enabled: input?.enabled ?? false,
    handle: (action) => input?.onAction(action) ?? false,
  })
  return (
    <Squares value={squares.current}>
      <div
        ref={root}
        role={input === null ? "img" : "grid"}
        aria-label={label}
        className={className}
      >
        {children(device?.device.method === "controller")}
      </div>
    </Squares>
  )
}
const isNavigationKey = (key: string): key is BoardNavigationKey =>
  key === "ArrowDown" ||
  key === "ArrowLeft" ||
  key === "ArrowRight" ||
  key === "ArrowUp" ||
  key === "End" ||
  key === "Home"
function Square({
  children,
  className,
  label,
  square,
  selected,
  disabled,
  input,
}: BoardSquareProps) {
  const squares = useContext(Squares)
  const device = usePlayerInput()
  const navigate = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (
      !isNavigationKey(event.key) ||
      (device !== null &&
        ((event.key !== "Home" && event.key !== "End") ||
          actionForKeyboardCode(device.bindings, event.code) !== undefined))
    )
      return
    event.preventDefault()
    input.onNavigate(event.key)
  }
  return (
    <button
      type="button"
      role="gridcell"
      aria-label={label}
      aria-selected={selected}
      aria-disabled={disabled}
      data-square={square}
      tabIndex={input.focusedSquare === square ? 0 : -1}
      ref={(element) => {
        if (element === null) squares?.delete(square)
        else squares?.set(square, element)
      }}
      onClick={() => input.onChoose(square)}
      onFocus={() => input.onFocus(square)}
      onKeyDown={navigate}
      className={cx(
        "text-mapachito-charcoal flex cursor-pointer border-0 bg-transparent text-[clamp(1rem,8cqw,4.75rem)] leading-none outline-none! aria-disabled:cursor-default",
        className,
      )}
    >
      {children}
    </button>
  )
}
function ChoiceAction({
  children,
  className,
  label,
  disabled,
  first,
  onActivate,
}: ComponentProps<BoardElements["ChoiceAction"]>) {
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (first) button.current?.focus()
  }, [first])
  return (
    <MapachessButton
      ref={button}
      type="button"
      variant="secondary"
      className={className}
      aria-label={label}
      disabled={disabled}
      onClick={onActivate}
    >
      {children}
    </MapachessButton>
  )
}

const webBoardElements: BoardElements = {
  Group,
  Surface,
  Square,
  Text: ({ children, className }) => (
    <span aria-hidden="true" className={className}>
      {children}
    </span>
  ),
  Artwork: ({ orientation, children }) => (
    <ChessBoardArtwork orientation={orientation} fallback={children} />
  ),
  Piece: ChessPiece,
  Focus: ({ children, className, controller }) => (
    <span
      aria-hidden="true"
      className={cx(
        className,
        "hidden group-focus-visible:block",
        controller && "group-focus:block",
      )}
    >
      {children}
    </span>
  ),
  Svg: (props) => (
    <svg
      {...vectorMetadata(props)}
      aria-hidden="true"
      className={props.className}
      preserveAspectRatio="none"
      viewBox={props.viewBox}
      opacity={props.opacity}
    >
      {props.children}
    </svg>
  ),
  VectorGroup: (props) => (
    <g
      {...vectorMetadata(props)}
      opacity={props.opacity}
      transform={props.transform}
    >
      {props.children}
    </g>
  ),
  Rect: (props) => <rect {...shapeProps(props)} />,
  Line: (props) => <line {...shapeProps(props)} />,
  Path: (props) => <path {...shapeProps(props)} />,
  Choice: ({ children, actions, title, onCancel }) => (
    <MapachessDialog
      label={title}
      onClose={onCancel}
      fixedContent
      placement="bottom"
    >
      <ScrollActions actions={actions}>
        <h2 className="font-display text-xl leading-tight font-black">
          {title}
        </h2>
        {children}
      </ScrollActions>
    </MapachessDialog>
  ),
  ChoiceAction,
}
export default webBoardElements
