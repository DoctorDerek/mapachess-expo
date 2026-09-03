import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import createInitialMapachessPlayerData from "@mapachess/profile/player-data"
import type { MapachessPortableBackup } from "@mapachess/profile/portable-backup"
import ProfileImportPreviewPanel from "./ProfileImportPreviewPanel"
import ProfilePersistenceFailurePanel from "./ProfilePersistenceFailurePanel"
import ProfileRecoveryPanel from "./ProfileRecoveryPanel"
import ProfileSettingsPanel from "./ProfileSettingsPanel"

const playerData = createInitialMapachessPlayerData()

const backup = Object.freeze({
  applicationVersion: "0.0.0",
  format: "mapachess-portable-backup",
  formatVersion: 1,
  gddRevision: "v2.1",
  integrity: Object.freeze({
    algorithm: "SHA-256" as const,
    payloadHash: "0".repeat(64),
  }),
  payload: playerData,
  saveSchemaVersion: 2,
}) satisfies MapachessPortableBackup

describe("web player-data controls", () => {
  it("names every applicable corrupt-data recovery action", () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileRecoveryPanel, {
        downloadFailed: false,
        hasLastKnownGood: true,
        importIssue: null,
        onBackupRead: vi.fn(),
        onExportUnreadable: vi.fn(),
        onResetConfirmed: vi.fn(),
        onRestoreLastKnownGood: vi.fn(),
        onTryAgain: vi.fn(),
      }),
    )

    expect(markup).toContain("nothing has been reset")
    expect(markup).toContain("Try Again")
    expect(markup).toContain("Export Unreadable Data")
    expect(markup).toContain("Import Backup")
    expect(markup).toContain("Restore Last Known-Good Save")
    expect(markup).toContain("Review Full Local Reset")
  })

  it("omits last-known-good recovery when no valid copy exists", () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileRecoveryPanel, {
        downloadFailed: false,
        hasLastKnownGood: false,
        importIssue: null,
        onBackupRead: vi.fn(),
        onExportUnreadable: vi.fn(),
        onResetConfirmed: vi.fn(),
        onRestoreLastKnownGood: vi.fn(),
        onTryAgain: vi.fn(),
      }),
    )

    expect(markup).not.toContain("Restore Last Known-Good Save")
  })

  it("offers all three automatic hint modes for new matches", () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileSettingsPanel, {
        activityMessage: null,
        importIssue: null,
        onAutoHintModeChanged: vi.fn(),
        onBackupRead: vi.fn(),
        onClose: vi.fn(),
        onExportPlayerData: vi.fn(),
        playerData,
      }),
    )

    expect(markup).toContain("Auto Move Hints")
    expect(markup).toContain("Auto Piece Hints")
    expect(markup).toContain("No Auto Hints")
    expect(markup).toContain("automatic help used by new matches")
    expect(markup).toContain("Export Player Data")
    expect(markup).toContain("non-destructive preview")
  })

  it("previews replacement data and defaults focus to cancellation", () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileImportPreviewPanel, {
        backup,
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
      }),
    )

    expect(markup).toContain("Nothing has been replaced yet")
    expect(markup).toContain("Cancel Import")
    expect(markup).toContain('autofocus=""')
    expect(markup).toContain("Replace Local Player Data")
    expect(markup).toContain("Standard Story Elo")
  })

  it("keeps retry and export visible after a failed verified write", () => {
    const markup = renderToStaticMarkup(
      createElement(ProfilePersistenceFailurePanel, {
        exportablePlayerData: playerData,
        failure: { type: "PROFILE.STORAGE_VERIFICATION_FAILED" },
        onExportPlayerData: vi.fn(),
        onExportUnreadable: vi.fn(),
        onRetry: vi.fn(),
      }),
    )

    expect(markup).toContain("not marked saved")
    expect(markup).toContain("Retry Save")
    expect(markup).toContain("Export Pending Player Data")
    expect(markup).toContain("Export Unreadable Data")
  })
})
