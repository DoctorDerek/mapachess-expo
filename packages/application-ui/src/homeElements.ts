import type { ComponentType, ReactNode } from "react"
import type { MatchMedal } from "@mapachess/profile/match-medal"
import type { CardInput } from "@mapachess/profile/profile-card-model"

export const HOME_WORDMARK_CLASS_NAME =
  "font-home text-mapachito-white text-3xl leading-tight font-black tracking-tight wrap-anywhere"

export type HomeGroupProps = Readonly<{
  children: ReactNode
  className: string
  region:
    "header" | "columns" | "profile" | "profile-actions" | "play" | "mode-label"
}>

export type HomeTextProps = Readonly<{
  children: ReactNode
  className: string
  emphasis?: boolean
  decorative?: boolean
}>

export type HomeActionProps = Readonly<{
  children: ReactNode
  className: string
  disabled: boolean
  onActivate: () => void
  label?: string
  kind: "customize" | "share" | "resume" | "mode"
}>

export type HomeSettingsProps<FocusTarget> = Readonly<{
  children: ReactNode
  disabled: boolean
  expanded: boolean
  focusTarget: FocusTarget
  onActivate: () => void
}>

export type ProfileCardGroupProps = Readonly<{
  children: ReactNode
  className: string
  region: "card" | "body" | "facts" | "row" | "label" | "context" | "artwork"
  description?: string
  rating?: boolean
}>

export type ProfileCardTextProps = Readonly<{
  children: ReactNode
  className: string
  kind: "label" | "value" | "context"
}>

export type ProfileCardElements = Readonly<{
  Group: ComponentType<ProfileCardGroupProps>
  Text: ComponentType<ProfileCardTextProps>
  Medal: ComponentType<Readonly<{ medal: MatchMedal; className: string }>>
  Artwork: ComponentType<Readonly<{ input: CardInput }>>
}>

export type HomeElements<FocusTarget> = Readonly<{
  Surface: ComponentType<Readonly<{ children: ReactNode; className: string }>>
  Group: ComponentType<HomeGroupProps>
  Title: ComponentType<Readonly<{ label: string }>>
  Text: ComponentType<HomeTextProps>
  Action: ComponentType<HomeActionProps>
  Settings: ComponentType<HomeSettingsProps<FocusTarget>>
  card: ProfileCardElements
}>
