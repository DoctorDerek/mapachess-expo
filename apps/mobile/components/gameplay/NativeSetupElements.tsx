import cx from "classix"
import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react"
import { Modal, Pressable, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { Defs, Image, Mask, Rect } from "react-native-svg"
import { withUniwind } from "uniwind"
import type {
  SetupChoiceProps,
  SetupElements,
  SetupGroupProps,
  SetupTextProps,
} from "@mapachess/application-ui/setup-elements"
import resolveOpponentPresentation from "@mapachess/match-presentation/opponent-presentation"
import {
  CHESS960_POSITION_COUNT,
  parseChess960PositionId,
} from "@mapachess/match/chess960-position"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import type { ChessAppearanceSettings } from "@mapachess/profile/chess-appearance-settings"
import {
  NativeEloInput,
  NativeEloSlider,
} from "@/components/gameplay/NativeChallengeDifficulty"
import NativeChessboard from "@/components/gameplay/NativeChessboard"
import {
  NativeInputSurface,
  useNativeInputControl,
} from "@/components/input/NativeInputProvider"
import NativeAnimal from "@/components/presentation/NativeAnimal"
import NativeButton from "@/components/presentation/NativeButton"
import NativeMedal from "@/components/presentation/NativeMedal"
import { NativeScrollActions } from "@/components/presentation/NativePanel"
import NativeText from "@/components/presentation/NativeText"
import { useNativeLocale } from "@/components/profile/NativeLocaleProvider"
import assets from "@/lib/presentation/nativeAssetManifest"
import useNativePresentationActivity from "@/lib/presentation/useNativePresentationActivity"

const SafeArea = withUniwind(SafeAreaView)
const ExactInput = createContext<RefObject<TextInput | null> | null>(null)
const Appearance = createContext<ChessAppearanceSettings | null>(null)
export function NativeSetupInput({
  children,
  exactInput,
  appearance = null,
}: Readonly<{
  children: ReactNode
  exactInput: RefObject<TextInput | null>
  appearance?: ChessAppearanceSettings | null
}>) {
  return (
    <ExactInput value={exactInput}>
      <Appearance value={appearance}>{children}</Appearance>
    </ExactInput>
  )
}
function Group({ children, className, label, hidden }: SetupGroupProps) {
  return (
    <View
      className={cx("flex", className)}
      accessibilityLabel={label}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
    >
      {children}
    </View>
  )
}
function Text({ children, className, kind, role, decorative }: SetupTextProps) {
  return (
    <NativeText
      className={className}
      accessibilityRole={
        kind === "heading" || kind === "legend"
          ? "header"
          : role === "alert"
            ? "alert"
            : undefined
      }
      accessibilityLiveRegion={role === "status" ? "polite" : undefined}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no" : "auto"}
    >
      {children}
    </NativeText>
  )
}
function Choice({
  children,
  className,
  selected,
  disabled,
  onSelected,
  label,
  concealed,
}: SetupChoiceProps) {
  const ref = useRef<View>(null)
  const [attended, setAttended] = useState(false)
  const focused = useNativeInputControl(
    ref,
    () => onSelected?.(),
    !disabled && onSelected !== undefined,
  )
  if (onSelected === undefined)
    return <View className={className}>{children({ attended: false })}</View>
  return (
    <Pressable
      ref={ref}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onSelected}
      onFocus={() => setAttended(true)}
      onBlur={() => setAttended(false)}
      onHoverIn={() => setAttended(true)}
      onHoverOut={() => setAttended(false)}
      className={cx(
        className,
        selected && "border-mapachito-violet bg-mapachito-violet/10",
        focused && "outline-mapachito-orange outline-3 outline-offset-2",
        disabled && "opacity-60",
      )}
    >
      {concealed ? null : (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="border-mapachito-charcoal mt-1 size-5 shrink-0 items-center justify-center rounded-full border-2"
        >
          {selected ? (
            <View className="bg-mapachito-violet size-3 rounded-full" />
          ) : null}
        </View>
      )}
      {children({ attended: !disabled && (attended || focused) })}
    </Pressable>
  )
}
function Animal({
  opponent,
  active,
  attention,
  locked,
}: ComponentProps<SetupElements["Animal"]>) {
  const motion = useNativePresentationActivity()
  const maskId = useId()
  const presentation = resolveOpponentPresentation(opponent.id)
  const animation =
    presentation.kind === "sprite" ? presentation.steps[0].animation : null
  const source =
    animation === null ? undefined : assets.images[animation.sourceId]
  return (
    <View
      className="size-16 shrink-0"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {locked && animation !== null && source !== undefined ? (
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${animation.geometry.frameWidth} ${animation.geometry.frameHeight}`}
        >
          <Defs>
            <Mask id={maskId} maskType="alpha">
              <Image
                href={source}
                width={animation.geometry.frameWidth * animation.frameCount}
                height={animation.geometry.frameHeight}
              />
            </Mask>
          </Defs>
          <Rect
            width="100%"
            height="100%"
            fill="black"
            mask={`url(#${maskId})`}
          />
        </Svg>
      ) : (
        <NativeAnimal
          animal={opponent.id}
          motion={
            locked
              ? undefined
              : { ...motion, active: motion.active && active, attention }
          }
        />
      )}
    </View>
  )
}
function Editor({
  children,
  actions,
  title,
  active,
  onCancel,
}: ComponentProps<SetupElements["Editor"]>) {
  return (
    <Modal
      visible={active}
      animationType="none"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
    >
      <SafeArea
        accessibilityViewIsModal
        className="bg-mapachito-white flex-1"
        edges={["top", "bottom", "left", "right"]}
      >
        <NativeInputSurface
          modal
          onAction={(action) => {
            if (action !== "cancel" && action !== "menu") return false
            onCancel()
            return true
          }}
        >
          <NativeScrollActions actions={actions}>
            <NativeText
              accessibilityRole="header"
              className="font-native text-mapachito-charcoal text-2xl"
            >
              {title}
            </NativeText>
            {children}
          </NativeScrollActions>
        </NativeInputSurface>
      </SafeArea>
    </Modal>
  )
}
function PositionPreview({
  value,
  orientation,
}: ComponentProps<SetupElements["PositionPreview"]>) {
  const { copy } = useNativeLocale()
  const appearance = useContext(Appearance)
  const parsed = parseChess960PositionId(
    value.trim() === "" ? NaN : Number(value),
  )
  if (!parsed.ok) return null
  if (appearance === null) return null
  return (
    <View
      className="mx-auto mt-3 aspect-square w-full max-w-64"
      accessible
      accessibilityRole="image"
      accessibilityLabel={copy.setup.positionPreview(parsed.positionId)}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <NativeChessboard
          position={createInitialMatchPosition({
            variant: "chess960",
            chess960PositionId: parsed.positionId,
          })}
          orientation={orientation}
          legalMoves={[]}
          disabled
          appearance={appearance}
          hints={null}
          showMoveHints={false}
          lastMove={null}
          onMove={() => undefined}
        />
      </View>
    </View>
  )
}
const nativeSetupElements: SetupElements = {
  Group,
  Text,
  Choice,
  Animal,
  Editor,
  Medal: NativeMedal,
  Surface: ({ children, actions, className }) => (
    <View className={cx("flex-1", className)}>
      <NativeScrollActions actions={actions}>{children}</NativeScrollActions>
    </View>
  ),
  Action: ({
    children,
    className,
    disabled,
    onActivate,
    secondary,
    label,
    busy,
  }) => (
    <NativeButton
      className={className}
      disabled={disabled || busy}
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      variant={secondary ? "secondary" : "primary"}
      onPress={onActivate}
    >
      {children}
    </NativeButton>
  ),
  ExactElo: (props) => (
    <NativeEloInput {...props} exactInput={useContext(ExactInput)} />
  ),
  Slider: NativeEloSlider,
  PositionInput: ({ disabled, value, onChanged }) => (
    <TextInput
      accessibilityLabel={useNativeLocale().copy.setup.positionNumber(
        CHESS960_POSITION_COUNT - 1,
      )}
      editable={!disabled}
      keyboardType="number-pad"
      className="border-mapachito-charcoal bg-mapachito-white font-native text-mapachito-charcoal min-h-12 min-w-0 flex-1 basis-24 rounded-lg border-2 px-3 text-base"
      value={value}
      onChangeText={onChanged}
    />
  ),
  PositionPreview,
}
export default nativeSetupElements
