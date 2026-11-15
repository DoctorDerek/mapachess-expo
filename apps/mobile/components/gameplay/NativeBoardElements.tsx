import cx from "classix"
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { AccessibilityInfo, Pressable, View } from "react-native"
import Svg, { G, Line, Path, Rect } from "react-native-svg"
import { useCSSVariable } from "uniwind"
import {
  boardShapeGeometry,
  type BoardElements,
  type BoardGroupProps,
  type BoardShapeProps,
  type BoardSurfaceProps,
} from "@mapachess/application-ui/board-elements"
import { CHESS_BOARDS } from "@mapachess/match-presentation/chess-appearance-catalog"
import CHESS_BOARD_PALETTES, {
  type ChessBoardPalette,
} from "@mapachess/match-presentation/chess-board-palettes"
import type { ChessAppearanceSettings } from "@mapachess/profile/chess-appearance-settings"
import NativeChessPiece from "@/components/gameplay/NativeChessPiece"
import { useNativeInputControl } from "@/components/input/NativeInputProvider"
import NativeButton from "@/components/presentation/NativeButton"
import NativeImage from "@/components/presentation/NativeImage"
import NativePanel from "@/components/presentation/NativePanel"
import NativeText from "@/components/presentation/NativeText"
import assets from "@/lib/presentation/nativeAssetManifest"

const Appearance = createContext<Readonly<{
  appearance: ChessAppearanceSettings
  source: string | null
  onError: () => void
}> | null>(null)
export function NativeBoardAppearance({
  appearance,
  children,
}: Readonly<{
  appearance: ChessAppearanceSettings
  children: (palette: ChessBoardPalette) => ReactNode
}>) {
  const [failedBoard, setFailedBoard] = useState<string | null>(null)
  const board = CHESS_BOARDS.find(({ id }) => id === appearance.boardId)
  const requested =
    board === undefined || board.kind === "colors"
      ? null
      : `${board.delivery === "public" ? "/chess-assets" : "/generated/chess-assets"}/${board.image.path}`
  const source =
    requested !== null &&
    requested !== failedBoard &&
    assets.images[requested] !== undefined
      ? requested
      : null
  return (
    <Appearance
      value={{ appearance, source, onError: () => setFailedBoard(requested) }}
    >
      {children(
        CHESS_BOARD_PALETTES[source === null ? "current" : appearance.boardId],
      )}
    </Appearance>
  )
}
function Group({ children, className, decorative }: BoardGroupProps) {
  return (
    <View
      className={className}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      pointerEvents={decorative ? "none" : "auto"}
    >
      {children}
    </View>
  )
}
function ActiveSurface({
  children,
  className,
  label,
  input,
}: BoardSurfaceProps) {
  const ref = useRef<View>(null)
  const focused = useNativeInputControl(
    ref,
    () => input?.onAction("confirm"),
    input?.enabled ?? false,
    (action) => input?.onAction(action) ?? false,
  )
  const actor = input?.actor
  useEffect(() => {
    const subscription = actor?.on("BOARD.FOCUS_REQUESTED", ({ reason }) => {
      if (reason === "return" && ref.current !== null)
        AccessibilityInfo.sendAccessibilityEvent(ref.current, "focus")
    })
    return () => subscription?.unsubscribe()
  }, [actor])
  return (
    <View ref={ref} focusable accessibilityLabel={label} className={className}>
      {children(focused)}
    </View>
  )
}
function useShape(props: BoardShapeProps) {
  const [fill, stroke] = useCSSVariable([
    props.fill ?? "--color-board-neutral",
    props.stroke ?? "--color-board-neutral",
  ])
  return {
    ...boardShapeGeometry(props),
    fill:
      props.fill === "none"
        ? "none"
        : props.fill === undefined
          ? undefined
          : typeof fill === "string"
            ? fill
            : undefined,
    stroke:
      props.stroke === "none"
        ? "none"
        : props.stroke === undefined
          ? undefined
          : typeof stroke === "string"
            ? stroke
            : undefined,
  }
}
function NativeRect(props: BoardShapeProps) {
  return <Rect {...useShape(props)} />
}
function NativePath(props: BoardShapeProps) {
  return <Path {...useShape(props)} />
}
function NativeLine(props: BoardShapeProps) {
  return <Line {...useShape(props)} />
}

const nativeBoardElements: BoardElements = {
  Group,
  Surface: (props) =>
    props.input === null ? (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={props.label}
        className={props.className}
      >
        {props.children(false)}
      </View>
    ) : (
      <ActiveSurface {...props} />
    ),
  Square: ({
    children,
    className,
    label,
    square,
    selected,
    disabled,
    input,
  }) => (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      onPress={() => {
        input.onFocus(square)
        input.onChoose(square)
      }}
      onFocus={() => input.onFocus(square)}
      className={className}
    >
      {children}
    </Pressable>
  ),
  Text: ({ children, className }) => (
    <NativeText
      accessible={false}
      importantForAccessibility="no"
      className={className}
    >
      {children}
    </NativeText>
  ),
  Artwork: function Artwork({ orientation, children }) {
    const appearance = useContext(Appearance)
    return (
      <>
        {children}
        {appearance?.source === null || appearance === null ? null : (
          <View
            pointerEvents="none"
            className={cx(
              "absolute inset-0",
              orientation === "black" && "rotate-180",
            )}
          >
            <NativeImage
              sourceId={appearance.source}
              className="size-full"
              onError={appearance.onError}
            />
          </View>
        )}
      </>
    )
  },
  Piece: function Piece({ color, role }) {
    const appearance = useContext(Appearance)
    return appearance === null ? null : (
      <NativeChessPiece
        color={color}
        role={role}
        pieceSetId={appearance.appearance.pieceSetId}
      />
    )
  },
  Focus: ({ children, className, focused, controller }) =>
    focused && controller ? (
      <View pointerEvents="none" className={className}>
        {children}
      </View>
    ) : null,
  Svg: ({ children, className, viewBox, opacity }) => (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={className}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        preserveAspectRatio="none"
        opacity={opacity}
      >
        {children}
      </Svg>
    </View>
  ),
  VectorGroup: ({ children, opacity, transform }) => (
    <G opacity={opacity} transform={transform}>
      {children}
    </G>
  ),
  Rect: NativeRect,
  Path: NativePath,
  Line: NativeLine,
  Choice: ({ children, actions, title, onCancel }) => (
    <NativePanel title={title} onBack={onCancel} actions={actions}>
      {children}
    </NativePanel>
  ),
  ChoiceAction: ({
    children,
    className,
    label,
    disabled,
    first,
    onActivate,
  }) => (
    <NativeButton
      variant="secondary"
      accessibilityLabel={label}
      className={className}
      disabled={disabled}
      focusRequested={first}
      onPress={onActivate}
    >
      {children}
    </NativeButton>
  ),
}
export default nativeBoardElements
