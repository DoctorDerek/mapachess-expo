import cx from "classix"
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react"
import type {
  SetupChoiceProps,
  SetupElements,
  SetupGroupProps,
  SetupInputProps,
  SetupTextProps,
} from "@mapachess/application-ui/setup-elements"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import ChallengeAnimalPortrait from "@/components/gameplay/ChallengeAnimalPortrait"
import {
  PositionNumberInput,
  PositionPreview,
} from "@/components/gameplay/Chess960PositionChoice"
import StoryOpponentPortrait from "@/components/gameplay/StoryOpponentPortrait"
import { usePlayerInputScope } from "@/components/input/PlayerInputProvider"
import MapachessButton from "@/components/presentation/MapachessButton"
import MapachessDialog from "@/components/presentation/MapachessDialog"
import MedalSymbol from "@/components/presentation/MedalSymbol"
import ScrollActions from "@/components/presentation/ScrollActions"
import { useMapachessCopy } from "@/components/profile/MapachessLocaleProvider"
import usePreparedMatchImages from "@/lib/presentation/usePreparedMatchImages"

const ExactInput = createContext<RefObject<HTMLInputElement | null> | null>(
  null,
)
const PreparedPlayer = createContext<StockfishOpponentId>("raccoon-stockfish")
export function WebSetupInput({
  children,
  exactInput,
  playerAnimal = "raccoon-stockfish",
}: Readonly<{
  children: ReactNode
  exactInput: RefObject<HTMLInputElement | null>
  playerAnimal?: StockfishOpponentId | undefined
}>) {
  return (
    <ExactInput value={exactInput}>
      <PreparedPlayer value={playerAnimal}>{children}</PreparedPlayer>
    </ExactInput>
  )
}
function Group({
  children,
  className,
  kind = "group",
  label,
  id,
  disabled,
  hidden,
  scroll,
}: SetupGroupProps) {
  const Tag =
    kind === "fieldset"
      ? "fieldset"
      : kind === "list"
        ? "ul"
        : kind === "ordered-list"
          ? "ol"
          : kind === "item"
            ? "li"
            : kind === "section"
              ? "section"
              : "div"
  return (
    <Tag
      aria-label={label}
      className={className}
      role={kind === "group" && label !== undefined ? "region" : undefined}
      id={id}
      disabled={disabled}
      hidden={hidden}
      tabIndex={scroll ? 0 : undefined}
    >
      {children}
    </Tag>
  )
}
function Text({
  children,
  className,
  kind,
  id,
  role,
  decorative,
}: SetupTextProps) {
  const Tag = kind === "heading" ? "h2" : kind === "legend" ? "legend" : "span"
  return (
    <Tag
      className={cx(kind === undefined && "block", className)}
      tabIndex={kind === "heading" ? -1 : undefined}
      id={id}
      role={role}
      aria-hidden={decorative}
    >
      {children}
    </Tag>
  )
}
function Choice({
  children,
  className,
  name,
  value,
  selected,
  disabled,
  onSelected,
  label,
  concealed,
}: SetupChoiceProps) {
  const [attended, setAttended] = useState(false)
  const Tag = onSelected === undefined ? "div" : "label"
  return (
    <Tag
      className={cx(
        "has-focus-visible:outline-mapachito-violet has-focus-visible:outline-3 has-focus-visible:outline-offset-2",
        className,
        onSelected !== undefined && "cursor-pointer",
        selected && "border-mapachito-violet bg-mapachito-violet/10",
        disabled && "cursor-not-allowed",
      )}
      onPointerEnter={(event) => {
        if (!disabled && event.pointerType !== "touch") setAttended(true)
      }}
      onPointerLeave={() => setAttended(false)}
    >
      {onSelected === undefined ? null : (
        <input
          checked={selected}
          disabled={disabled}
          aria-label={label}
          type="radio"
          name={name}
          value={value}
          className={
            concealed
              ? "sr-only"
              : "accent-mapachito-violet mt-1 size-5 shrink-0"
          }
          onChange={onSelected}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) setAttended(true)
          }}
          onBlur={() => setAttended(false)}
        />
      )}
      {children({ attended: !disabled && attended })}
    </Tag>
  )
}
function ExactElo({
  control,
  disabled,
  onEdit,
  inputId,
  errorId,
}: SetupInputProps) {
  const exactInput = useContext(ExactInput)
  const copy = useMapachessCopy().setup
  return (
    <input
      aria-label={copy.opponentElo}
      aria-describedby={control.showError ? errorId : undefined}
      aria-invalid={control.showError || undefined}
      autoComplete="off"
      className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal focus-visible:outline-mapachito-violet aria-invalid:border-mapachito-raspberry min-h-12 w-24 max-w-full min-w-0 rounded-lg border-2 px-2 text-center text-lg font-bold tabular-nums focus-visible:outline-3 focus-visible:outline-offset-2 disabled:opacity-60"
      disabled={disabled}
      id={inputId}
      inputMode="numeric"
      onBlur={() => onEdit({ type: "committed" })}
      onChange={(event) =>
        onEdit({ type: "typed", text: event.currentTarget.value })
      }
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          onEdit({ type: "committed" })
        }
      }}
      ref={exactInput}
      spellCheck={false}
      type="text"
      value={control.exactText}
    />
  )
}
function Slider({ control, disabled, onEdit }: SetupInputProps) {
  const range = useRef<HTMLInputElement>(null)
  const copy = useMapachessCopy().setup
  const { minimum, maximum, step } = control.grid
  const select = (targetElo: number): void =>
    onEdit({ type: "selected", targetElo })
  const confirm = (input: HTMLInputElement): void => {
    if (!disabled && control.hasPendingText) select(input.valueAsNumber)
  }
  usePlayerInputScope({
    root: range,
    focused: true,
    enabled: !disabled,
    handle: (action, device) => {
      if (
        device.method !== "controller" ||
        document.activeElement !== range.current ||
        (action !== "left" && action !== "right")
      )
        return false
      onEdit({ type: "stepped", direction: action === "left" ? -1 : 1 })
      return true
    },
  })
  return (
    <input
      aria-label={copy.adjustOpponentElo}
      aria-valuetext={copy.elo(String(control.rangeValue))}
      className="accent-mapachito-violet focus-visible:outline-mapachito-violet min-h-12 w-full min-w-0 cursor-pointer rounded-lg focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-60"
      disabled={disabled}
      min={minimum}
      max={maximum}
      step={step}
      type="range"
      ref={range}
      value={control.rangeValue}
      onChange={(event) => select(event.currentTarget.valueAsNumber)}
      onClick={(event) => confirm(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === "Home" || event.key === "End") {
          event.preventDefault()
          select(event.key === "Home" ? minimum : maximum)
        }
      }}
      onPointerUp={(event) => {
        if (event.pointerType === "touch" && event.isPrimary)
          confirm(event.currentTarget)
      }}
    />
  )
}
function Surface({
  children,
  actions,
  className,
  onSubmit,
}: ComponentProps<SetupElements["Surface"]>) {
  const root = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    root.current
      ?.querySelector<HTMLElement>("h2")
      ?.focus({ preventScroll: true })
  }, [])
  return (
    <section ref={root} className={className}>
      <form
        className="h-full min-h-0 min-w-0 text-base"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <ScrollActions actions={actions}>{children}</ScrollActions>
      </form>
    </section>
  )
}
function Editor({
  children,
  actions,
  title,
  active,
  fitContent,
  focusSelection,
  onCancel,
}: ComponentProps<SetupElements["Editor"]>) {
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    if (!active) return
    const selected =
      focusSelection &&
      heading.current
        ?.closest("dialog")
        ?.querySelector<HTMLInputElement>(
          'input[type="radio"]:checked:not(:disabled)',
        )
    if (selected) {
      selected.focus({ preventScroll: true })
      selected
        .closest("label")
        ?.scrollIntoView({ block: "nearest", inline: "nearest" })
    } else heading.current?.focus({ preventScroll: true })
  }, [active, focusSelection])
  if (!active) return null
  return (
    <MapachessDialog
      label={title}
      onClose={onCancel}
      fixedContent={fitContent ? "fit" : true}
    >
      <ScrollActions
        className={fitContent ? "xl:h-auto xl:max-h-[calc(90dvh-3rem)]" : ""}
        actions={actions}
      >
        <h2
          className="font-display mb-4 text-2xl font-black"
          ref={heading}
          tabIndex={-1}
        >
          {title}
        </h2>
        {children}
      </ScrollActions>
    </MapachessDialog>
  )
}
function Animal({
  opponent,
  active,
  attention = false,
  locked,
  silhouette,
  framed = true,
  prepare = false,
}: ComponentProps<SetupElements["Animal"]>) {
  usePreparedMatchImages(
    prepare ? opponent.id : null,
    useContext(PreparedPlayer),
  )
  return silhouette ? (
    <StoryOpponentPortrait
      opponent={opponent}
      locked={Boolean(locked)}
      framed={framed}
    />
  ) : (
    <span
      className={cx(
        "pointer-events-none block shrink-0",
        locked && "grayscale",
      )}
    >
      <ChallengeAnimalPortrait
        active={active}
        attention={attention}
        opponent={opponent}
      />
    </span>
  )
}

const webSetupElements: SetupElements = {
  Surface,
  Editor,
  Group,
  Text,
  Choice,
  ExactElo,
  Slider,
  PositionInput: PositionNumberInput,
  PositionPreview,
  Action: ({
    children,
    className,
    disabled,
    onActivate,
    secondary,
    label,
    opensEditor,
    busy,
    busyLabel,
    submit,
  }) => (
    <MapachessButton
      className={className}
      disabled={disabled}
      aria-label={label}
      aria-haspopup={opensEditor ? "dialog" : undefined}
      aria-busy={busy}
      {...(busyLabel === undefined ? {} : { busyLabel })}
      type={submit ? "submit" : "button"}
      variant={secondary ? "secondary" : "primary"}
      onClick={
        submit
          ? undefined
          : (event) => {
              if (opensEditor)
                event.currentTarget.focus({ preventScroll: true })
              onActivate()
            }
      }
    >
      {children}
    </MapachessButton>
  ),
  Animal,
  Medal: MedalSymbol,
}
export default webSetupElements
