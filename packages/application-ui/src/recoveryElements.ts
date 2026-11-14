import type { ComponentType, ReactNode } from "react"

export type RecoverySurfaceProps = Readonly<{
  kind:
    | "recovery"
    | "load-failure"
    | "verification"
    | "preview"
    | "reset"
    | "save-failure"
  title: string
  description?: string | undefined
  eyebrow?: string
  children?: ReactNode
  actions: ReactNode
  onCancel?: () => void
}>

export type RecoveryActionProps = Readonly<{
  children: ReactNode
  className?: string
  variant?: "primary" | "secondary" | "destructive"
  disabled?: boolean
  busy?: boolean
  busyLabel?: string
  focusRequested?: boolean
  onActivate: () => void
}>

export type RecoveryImportProps = Readonly<{
  children: ReactNode
  className: string
  disabled: boolean
  onBackupRead: (rawBackup: string) => void
  onActivate?: (() => void) | undefined
}>

export type RecoveryElements = Readonly<{
  Surface: ComponentType<RecoverySurfaceProps>
  Group: ComponentType<
    Readonly<{
      children: ReactNode
      className: string
      kind?: "facts" | "row"
    }>
  >
  Text: ComponentType<
    Readonly<{
      children: ReactNode
      className: string
      kind: "label" | "value" | "notice"
    }>
  >
  Action: ComponentType<RecoveryActionProps>
  Import: ComponentType<RecoveryImportProps>
}>
