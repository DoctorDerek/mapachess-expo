"use client"

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react"
import loadCatalog, {
  type MapachessCatalog,
} from "@mapachess/localization/catalog"
import { MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS } from "@mapachess/profile/portable-backup"
import type {
  ProfileImportIssue,
  ProfilePersistenceFailure,
} from "@mapachess/profile/profile-machine"
import MapachessButton from "../presentation/MapachessButton"
import MapachessNotice from "../presentation/MapachessNotice"
import MapachessShell from "../presentation/MapachessShell"
import MapachessWordmark from "../presentation/MapachessWordmark"
import { useMapachessCopy } from "./MapachessLocaleProvider"

const MAX_PORTABLE_BACKUP_UTF8_BYTES = MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS * 3

export type FullPageProfilePanelProps = Readonly<{
  children?: ReactNode
  description: string
  eyebrow: string
  live?: "assertive" | "off" | "polite"
  title: string
}>

export type ProfileCardProps = Readonly<{
  children: ReactNode
  labelledBy: string
}>

export function ProfileCard({ children, labelledBy }: ProfileCardProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal shadow-mapachito-charcoal mx-auto w-full max-w-3xl rounded-[1.5rem_0.5rem_1.5rem_0.5rem] border-3 p-[clamp(1.25rem,4vw,2.5rem)] shadow-[0.625rem_0.625rem_0] forced-colors:border-[CanvasText] forced-colors:shadow-none"
    >
      {children}
    </section>
  )
}

export default function FullPageProfilePanel({
  children,
  description,
  eyebrow,
  live = "off",
  title,
}: FullPageProfilePanelProps) {
  return (
    <MapachessShell as="main" className="grid place-items-center">
      <div className="w-full max-w-3xl">
        <div className="mb-5 pl-1">
          <MapachessWordmark />
        </div>
        <section
          aria-live={live}
          className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal shadow-mapachito-charcoal min-h-[min(42rem,calc(100dvh-8rem))] rounded-[1.5rem_0.5rem_1.5rem_0.5rem] border-3 p-[clamp(1.5rem,5vw,3.5rem)] shadow-[0.625rem_0.625rem_0] forced-colors:border-[CanvasText] forced-colors:shadow-none"
        >
          <p className="text-mapachito-violet font-mono text-xs leading-[1.3] font-black tracking-[0.18em] uppercase">
            {eyebrow}
          </p>
          <h1 className="font-display text-mapachito-charcoal mt-4 text-[clamp(2.5rem,8vw,5.5rem)] leading-[0.86] font-black tracking-[-0.035em] text-balance uppercase font-stretch-condensed">
            {title}
          </h1>
          <p className="text-mapachito-charcoal mt-6 max-w-xl text-base leading-[1.65] font-semibold opacity-82">
            {description}
          </p>
          {children}
        </section>
      </div>
    </MapachessShell>
  )
}

export type ImportBackupButtonProps = Readonly<{
  disabled: boolean
  onBackupRead: (rawBackup: string) => void
}>

export function ImportBackupButton({
  disabled,
  onBackupRead,
}: ImportBackupButtonProps) {
  const copy = useMapachessCopy()
  const messages = copy.interface.profileFoundation

  const fileInput = useRef<HTMLInputElement>(null)
  const readOperation = useRef<AbortController | null>(null)
  const [reading, setReading] = useState(false)
  useEffect(
    () => () => {
      readOperation.current?.abort()
      readOperation.current = null
    },
    [],
  )
  const [fileIssue, setFileIssue] = useState<"read" | "too-large" | null>(null)

  const readSelectedBackup = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ""
    if (disabled || readOperation.current !== null) return
    if (file === undefined) return
    if (file.size > MAX_PORTABLE_BACKUP_UTF8_BYTES) {
      setFileIssue("too-large")
      return
    }

    const operation = new AbortController()
    readOperation.current = operation
    setReading(true)
    try {
      const rawBackup = await file.text()
      if (operation.signal.aborted) return
      setFileIssue(null)
      onBackupRead(rawBackup)
    } catch {
      if (!operation.signal.aborted) setFileIssue("read")
    } finally {
      if (readOperation.current === operation) {
        readOperation.current = null
        setReading(false)
      }
    }
  }

  return (
    <div>
      <MapachessButton
        aria-busy={reading}
        busyLabel={messages.readingBackup}
        variant="secondary"
        disabled={disabled}
        onClick={() => {
          if (!disabled && readOperation.current === null)
            fileInput.current?.click()
        }}
        type="button"
      >
        {messages.importBackup}
      </MapachessButton>
      <input
        accept=".json,application/json"
        disabled={disabled || reading}
        hidden
        onChange={(event) => void readSelectedBackup(event)}
        ref={fileInput}
        tabIndex={-1}
        type="file"
      />
      {fileIssue === null ? null : (
        <MapachessNotice tone="warning" className="mt-4 text-sm" role="alert">
          {fileIssue === "too-large"
            ? copy.profile.fileTooLarge
            : copy.profile.fileUnreadable}
        </MapachessNotice>
      )}
    </div>
  )
}

export const importIssueMessage = (
  issue: ProfileImportIssue,
  copy: MapachessCatalog["profile"] = loadCatalog("en").profile,
): string => {
  switch (issue.type) {
    case "PROFILE.BACKUP_INTEGRITY_MISMATCH":
      return copy.importIssue.integrity
    case "PROFILE.BACKUP_TOO_LARGE":
      return copy.importIssue.size
    case "PROFILE.BACKUP_VERSION_UNSUPPORTED":
    case "PROFILE.SCHEMA_VERSION_UNSUPPORTED":
      return copy.importIssue.version
    case "PROFILE.BACKUP_READ_FAILED":
      return copy.importIssue.read
    default:
      return copy.importIssue.invalid
  }
}

export const persistenceFailureMessage = (
  failure: ProfilePersistenceFailure,
  copy: MapachessCatalog["profile"] = loadCatalog("en").profile,
): string => {
  switch (failure.type) {
    case "PROFILE.STORAGE_CONFLICT":
      return copy.persistenceFailure.conflict
    case "PROFILE.STORAGE_VERIFICATION_FAILED":
      return copy.persistenceFailure.verification
    case "PROFILE.STORAGE_REQUEST_FAILED":
      return copy.persistenceFailure.request
    default:
      return copy.persistenceFailure.unsafe
  }
}
