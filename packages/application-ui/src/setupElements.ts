import type { ComponentType, ReactNode } from "react"
import type {
  ChallengeDifficultyControlState,
  ChallengeDifficultyEdit,
} from "@mapachess/gameplay/challenge-difficulty"
import type { MatchColor } from "@mapachess/match/match-position"
import type { StockfishOpponentDefinition } from "@mapachess/match/stockfish-opponent"
import type { MatchMedal } from "@mapachess/profile/match-medal"

export type SetupGroupProps = Readonly<{
  children: ReactNode
  className: string
  kind?: "fieldset" | "list" | "ordered-list" | "item" | "section" | "group"
  label?: string
  id?: string
  disabled?: boolean
  hidden?: boolean
  scroll?: boolean
}>
export type SetupTextProps = Readonly<{
  children: ReactNode
  className?: string
  kind?: "heading" | "legend" | "text"
  id?: string
  role?: "alert" | "status"
  decorative?: boolean
}>
export type SetupActionProps = Readonly<{
  children: ReactNode
  className?: string
  disabled: boolean
  onActivate: () => void
  secondary?: boolean
  label?: string
  opensEditor?: boolean
  busy?: boolean
  busyLabel?: string
  submit?: boolean
}>
export type SetupChoiceProps = Readonly<{
  children: (state: Readonly<{ attended: boolean }>) => ReactNode
  className: string
  name: string
  value: string
  selected: boolean
  disabled: boolean
  onSelected?: (() => void) | undefined
  label?: string
  concealed?: boolean
}>
export type SetupInputProps = Readonly<{
  control: ChallengeDifficultyControlState
  disabled: boolean
  onEdit: (edit: ChallengeDifficultyEdit) => void
  inputId: string
  errorId: string
}>
export type SetupPositionProps = Readonly<{
  disabled: boolean
  value: string
  orientation: MatchColor
  onChanged: (value: string) => void
}>
export type SetupElements = Readonly<{
  Surface: ComponentType<
    Readonly<{
      children: ReactNode
      actions: ReactNode
      className: string
      onSubmit: () => void
    }>
  >
  Editor: ComponentType<
    Readonly<{
      children: ReactNode
      actions: ReactNode
      title: string
      active: boolean
      fitContent: boolean
      focusSelection: boolean
      onCancel: () => void
    }>
  >
  Group: ComponentType<SetupGroupProps>
  Text: ComponentType<SetupTextProps>
  Action: ComponentType<SetupActionProps>
  Choice: ComponentType<SetupChoiceProps>
  Animal: ComponentType<
    Readonly<{
      opponent: StockfishOpponentDefinition
      active: boolean
      attention?: boolean
      locked?: boolean
      framed?: boolean
      silhouette?: boolean
      prepare?: boolean
    }>
  >
  Medal: ComponentType<Readonly<{ medal: MatchMedal }>>
  ExactElo: ComponentType<SetupInputProps>
  Slider: ComponentType<SetupInputProps>
  PositionInput: ComponentType<SetupPositionProps>
  PositionPreview: ComponentType<
    Pick<SetupPositionProps, "value" | "orientation">
  >
}>
