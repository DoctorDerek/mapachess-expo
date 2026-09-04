"use client"

import { useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS } from "@mapachess/profile/portable-backup"
import type {
  ProfileImportIssue,
  ProfilePersistenceFailure,
} from "@mapachess/profile/profile-machine"
import MapachessButton from "../presentation/MapachessButton"
import MapachessWordmark from "../presentation/MapachessWordmark"

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
      className="mapachess-surface mx-auto w-full max-w-3xl p-[clamp(1.25rem,4vw,2.5rem)]"
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
    <main className="mapachess-shell grid place-items-center">
      <div className="w-full max-w-3xl">
        <div className="mb-5 pl-1">
          <MapachessWordmark />
        </div>
        <section
          aria-live={live}
          className="mapachess-surface min-h-[min(42rem,calc(100dvh-8rem))] p-[clamp(1.5rem,5vw,3.5rem)]"
        >
          <p className="mapachess-eyebrow">{eyebrow}</p>
          <h1 className="mapachess-display mt-4">{title}</h1>
          <p className="mapachess-copy mt-6 max-w-xl">{description}</p>
          {children}
        </section>
      </div>
    </main>
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
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileIssue, setFileIssue] = useState<"read" | "too-large" | null>(null)

  const readSelectedBackup = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ""
    if (file === undefined) return
    if (file.size > MAX_PORTABLE_BACKUP_UTF8_BYTES) {
      setFileIssue("too-large")
      return
    }

    try {
      const rawBackup = await file.text()
      setFileIssue(null)
      onBackupRead(rawBackup)
    } catch {
      setFileIssue("read")
    }
  }

  return (
    <div>
      <MapachessButton
        variant="secondary"
        disabled={disabled}
        onClick={() => fileInput.current?.click()}
        type="button"
      >
        Import Backup
      </MapachessButton>
      <input
        accept=".json,application/json"
        disabled={disabled}
        hidden
        onChange={(event) => void readSelectedBackup(event)}
        ref={fileInput}
        tabIndex={-1}
        type="file"
      />
      {fileIssue === null ? null : (
        <p
          className="mapachess-notice mapachess-notice--warning mt-4 text-sm"
          role="alert"
        >
          {fileIssue === "too-large"
            ? "That file is larger than Mapachess can safely inspect. Your saved data is unchanged."
            : "That file could not be read. Your saved data is unchanged. Choose the file again or select another backup."}
        </p>
      )}
    </div>
  )
}

export const importIssueMessage = (issue: ProfileImportIssue): string => {
  switch (issue.type) {
    case "PROFILE.BACKUP_INTEGRITY_MISMATCH":
      return "The backup did not pass its integrity check. Your saved data is unchanged."
    case "PROFILE.BACKUP_TOO_LARGE":
      return "The selected backup is larger than Mapachess can safely inspect. Your saved data is unchanged."
    case "PROFILE.BACKUP_VERSION_UNSUPPORTED":
    case "PROFILE.SCHEMA_VERSION_UNSUPPORTED":
      return "This backup was created by a newer, unsupported Mapachess data version. Your saved data is unchanged."
    case "PROFILE.BACKUP_READ_FAILED":
      return "The selected backup could not be read. Your saved data is unchanged."
    default:
      return "The selected file is not a valid Mapachess backup. Your saved data is unchanged."
  }
}

export const persistenceFailureMessage = (
  failure: ProfilePersistenceFailure,
): string => {
  switch (failure.type) {
    case "PROFILE.STORAGE_CONFLICT":
      return "Another Mapachess tab changed local data first. Your pending change is still held here and has not overwritten it."
    case "PROFILE.STORAGE_VERIFICATION_FAILED":
      return "Mapachess could not verify the saved copy. Your pending change is still held here."
    case "PROFILE.STORAGE_REQUEST_FAILED":
      return "Browser storage did not finish the request. Your pending change is still held here."
    default:
      return "Mapachess could not safely save this change. Your pending change is still held here."
  }
}
