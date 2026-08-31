"use client"

import { useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS } from "@mapachess/profile/portable-backup"
import type {
  ProfileImportIssue,
  ProfilePersistenceFailure,
} from "@mapachess/profile/profile-machine"

const MAX_PORTABLE_BACKUP_UTF8_BYTES = MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS * 3

export const primaryProfileButtonClasses =
  "min-h-12 rounded-xl border border-cyan-300/45 bg-cyan-300/15 px-5 py-3 font-bold text-cyan-50 transition-colors hover:bg-cyan-300/25 focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-cyan-300/15"

export const secondaryProfileButtonClasses =
  "min-h-12 rounded-xl border border-white/15 bg-slate-800 px-5 py-3 font-bold text-slate-100 transition-colors hover:bg-slate-700 focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-slate-800"

export const destructiveProfileButtonClasses =
  "min-h-12 rounded-xl border border-rose-300/45 bg-rose-300/10 px-5 py-3 font-bold text-rose-100 transition-colors hover:bg-rose-300/20 focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-rose-300/10"

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
      className="mx-auto w-full max-w-3xl rounded-3xl border border-white/12 bg-slate-950/92 p-[clamp(1.25rem,4vw,2.5rem)] shadow-[0_1.5rem_5rem_rgba(2,6,23,0.5)] backdrop-blur-xl"
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
    <main className="relative isolate grid min-h-dvh place-items-center overflow-x-hidden px-[clamp(1rem,4vw,3rem)] py-[clamp(1.5rem,6vw,5rem)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.13),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.11),transparent_38%),linear-gradient(145deg,#07121e_0%,#0d1726_48%,#171128_100%)]"
      />
      <section
        aria-live={live}
        className="min-h-[min(44rem,calc(100dvh-3rem))] w-full max-w-2xl rounded-3xl border border-white/12 bg-slate-950/80 p-[clamp(1.5rem,5vw,3.5rem)] shadow-[0_1.5rem_5rem_rgba(2,6,23,0.5)] backdrop-blur-xl"
      >
        <p className="font-mono text-xs font-bold tracking-[0.24em] text-cyan-200 uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-[clamp(2rem,7vw,4rem)] leading-[0.95] font-black tracking-[-0.05em] text-white">
          {title}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
          {description}
        </p>
        {children}
      </section>
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
      <button
        className={secondaryProfileButtonClasses}
        disabled={disabled}
        onClick={() => fileInput.current?.click()}
        type="button"
      >
        Import Backup
      </button>
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
        <p className="mt-3 text-sm leading-relaxed text-amber-200" role="alert">
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
