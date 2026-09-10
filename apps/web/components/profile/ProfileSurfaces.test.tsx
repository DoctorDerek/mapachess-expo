import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import createInitialMapachessPlayerData, {
  MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
} from "@mapachess/profile/player-data"
import type { MapachessPortableBackup } from "@mapachess/profile/portable-backup"
import { STOCKFISH_18_WEB_WASM_ARTIFACT } from "@mapachess/stockfish/web-runtime-identity"
import ProfileImportPreviewPanel from "./ProfileImportPreviewPanel"
import ProfilePersistenceFailurePanel from "./ProfilePersistenceFailurePanel"
import ProfileRecoveryPanel from "./ProfileRecoveryPanel"
import ProfileSettingsPanel from "./ProfileSettingsPanel"
import WebMapachessApplication from "./WebMapachessApplication"

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
  saveSchemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
}) satisfies MapachessPortableBackup

describe("web player-data controls", () => {
  it("emits the canonical engine preload during the first application render", () => {
    const markup = renderToStaticMarkup(createElement(WebMapachessApplication))
    expect(markup).toContain(
      `href="/stockfish-runtime/${STOCKFISH_18_WEB_WASM_ARTIFACT.fileName}"`,
    )
    expect(markup).toMatch(/<link[^>]*rel="preload"[^>]*as="fetch"/)
    expect(markup).toContain('crossorigin=""')
    expect(markup).toContain("Loading Mapachess.")
    expect(markup).not.toContain("Saving player data")
    expect(markup).not.toContain("Opening local storage")
  })

  it("keeps hint choices and closing available while a standalone preference saves", () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileSettingsPanel, {
        activityMessage: "Saving your hint preference…",
        hintChangesDisabled: false,
        autoHintMode: "no-auto-hints",
        importIssue: null,
        onAutoHintModeChanged: vi.fn(),
        onBackupRead: vi.fn(),
        onClose: vi.fn(),
        onExportPlayerData: vi.fn(),
      }),
    )
    const hintChoices = markup.match(/<input[^>]*type="radio"[^>]*>/g)
    expect(hintChoices).toHaveLength(3)
    expect(markup).not.toMatch(/<fieldset[^>]* disabled=""/)
    for (const choice of hintChoices ?? [])
      expect(choice).not.toContain(' disabled=""')
    expect(markup).not.toMatch(/<button[^>]* disabled=""[^>]*>Close Settings/)
    expect(markup).toContain('class="sr-only" role="status"')
    expect(markup).toContain("Saving your hint preference…")
  })

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

  it("offers all three automatic hint modes during play", () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileSettingsPanel, {
        activityMessage: null,
        autoHintMode: playerData.settings.autoHintMode,
        importIssue: null,
        onAutoHintModeChanged: vi.fn(),
        onBackupRead: vi.fn(),
        onClose: vi.fn(),
        onExportPlayerData: vi.fn(),
      }),
    )

    expect(markup).toContain("Auto Move Hints")
    expect(markup).toContain("Auto Piece Hints")
    expect(markup).toContain("No Auto Hints")
    expect(markup).toContain("Bronze if you win after using Move Hints.")
    expect(markup).toContain(
      "Silver if you win with Piece Hints but no Move Hints.",
    )
    expect(markup).toContain("Gold if you win without using any hints.")
    for (const symbol of ["🥉", "🥈", "🥇"])
      expect(markup).toMatch(
        new RegExp(`<span[^>]*aria-hidden="true"[^>]*>${symbol}</span>`),
      )
    expect(markup).toContain(
      "Changing this setting never erases earlier hint use.",
    )
    expect(markup).toContain("changes take effect immediately")
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
    expect(markup).toContain("Standard Story completion")
    expect(markup).toContain("Chess960 Story completion")
    expect(markup).toContain("Overall Story completion")
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
