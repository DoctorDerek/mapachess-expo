// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import { SHIPPED_LOCALES } from "@mapachess/localization/locale"
import { MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS } from "@mapachess/profile/portable-backup"
import type {
  ProfileImportIssue,
  ProfilePersistenceFailure,
} from "@mapachess/profile/profile-machine"
import ApplicationError from "@/app/error"
import MapachessDialog from "@/components/presentation/MapachessDialog"
import {
  ImportBackupButton,
  importIssueMessage,
  persistenceFailureMessage,
} from "@/components/profile/ProfileFoundation"
import { installDomHarness } from "@/test/domHarness"

installDomHarness()
const copy = loadCatalog("en")

function importing() {
  const onBackupRead = vi.fn()
  const view = render(
    <ImportBackupButton disabled={false} onBackupRead={onBackupRead} />,
  )
  const input = view.container.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement))
    throw new Error("The import control must own its file input.")
  return { ...view, input, onBackupRead }
}

describe("recovery controls and modal focus ownership", () => {
  it("uses the shared import label while retaining the browser's owned file-reading control", async () => {
    const onBackupRead = vi.fn()
    const view = render(
      <ImportBackupButton disabled={false} onBackupRead={onBackupRead}>
        Choose recovery backup
      </ImportBackupButton>,
    )
    expect(
      screen.getByRole("button", { name: "Choose recovery backup" }),
    ).toBeTruthy()
    const input = view.container.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement))
      throw new Error("Recovery must own its browser file input")
    const file = new File([], "backup.json")
    Object.defineProperty(file, "text", {
      value: async () => "selected recovery backup",
    })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() =>
      expect(onBackupRead).toHaveBeenCalledExactlyOnceWith(
        "selected recovery backup",
      ),
    )
  })
  it.each(SHIPPED_LOCALES)(
    "gives actionable %s messages for each backup and persistence failure without leaking diagnostics",
    (locale) => {
      const profileCopy = loadCatalog(locale).profile
      const diagnostic = {
        cause: new Error("Private storage details"),
        message: "Private storage details",
      }
      const issues: readonly (readonly [ProfileImportIssue, string])[] = [
        [
          { type: "PROFILE.BACKUP_INTEGRITY_MISMATCH", path: "$" },
          profileCopy.importIssue.integrity,
        ],
        [
          { type: "PROFILE.BACKUP_TOO_LARGE", path: "$" },
          profileCopy.importIssue.size,
        ],
        [
          { type: "PROFILE.BACKUP_VERSION_UNSUPPORTED", receivedVersion: 999 },
          profileCopy.importIssue.version,
        ],
        [
          { type: "PROFILE.SCHEMA_VERSION_UNSUPPORTED", receivedVersion: 999 },
          profileCopy.importIssue.version,
        ],
        [
          { type: "PROFILE.BACKUP_READ_FAILED", path: "$", diagnostic },
          profileCopy.importIssue.read,
        ],
        [
          { type: "PROFILE.BACKUP_INVALID", path: "$" },
          profileCopy.importIssue.invalid,
        ],
      ]
      for (const [issue, expected] of issues)
        expect(importIssueMessage(issue, profileCopy)).toBe(expected)
      const failures: readonly (readonly [
        ProfilePersistenceFailure,
        string,
      ])[] = [
        [
          { type: "PROFILE.STORAGE_CONFLICT" },
          profileCopy.persistenceFailure.conflict,
        ],
        [
          { type: "PROFILE.STORAGE_VERIFICATION_FAILED" },
          profileCopy.persistenceFailure.verification,
        ],
        [
          { type: "PROFILE.STORAGE_REQUEST_FAILED", diagnostic },
          profileCopy.persistenceFailure.request,
        ],
        [
          { type: "PROFILE.CURRENT_DATA_INVALID" },
          profileCopy.persistenceFailure.unsafe,
        ],
      ]
      for (const [failure, expected] of failures)
        expect(persistenceFailureMessage(failure, profileCopy)).toBe(expected)
    },
  )

  it("opens its owned file picker only when enabled and ignores a read rejected after unmount", async () => {
    const view = importing()
    const open = vi.spyOn(view.input, "click")
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileFoundation.importBackup,
      }),
    )
    expect(open).toHaveBeenCalledOnce()
    view.rerender(
      <ImportBackupButton disabled onBackupRead={view.onBackupRead} />,
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.interface.profileFoundation.importBackup,
      }),
    )
    expect(open).toHaveBeenCalledOnce()
    view.rerender(
      <ImportBackupButton disabled={false} onBackupRead={view.onBackupRead} />,
    )
    const pending = Promise.withResolvers<string>()
    const file = new File([], "abandoned.json")
    Object.defineProperty(file, "text", { value: () => pending.promise })
    fireEvent.change(view.input, { target: { files: [file] } })
    view.unmount()
    await act(async () =>
      pending.reject(new Error("Canceled read failed late")),
    )
    expect(view.onBackupRead).not.toHaveBeenCalled()
  })
  it("offers a real page retry without resetting player data", () => {
    const retry = vi.fn()
    render(<ApplicationError retry={retry} />)
    expect(
      screen.getByText(copy.interface.error.yourSavedPlayerDataHasNotBeen),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: copy.interface.error.tryAgain }),
    )
    expect(retry).toHaveBeenCalledOnce()
  })

  it("rejects oversized and unreadable files, then accepts a later readable selection", async () => {
    const view = importing()
    const huge = new File([], "too-large.json")
    Object.defineProperty(huge, "size", {
      value: MAX_PORTABLE_BACKUP_UTF16_CODE_UNITS * 3 + 1,
    })
    fireEvent.change(view.input, { target: { files: [huge] } })
    expect(screen.getByRole("alert").textContent).toBe(
      copy.profile.fileTooLarge,
    )
    const broken = new File([], "unreadable.json")
    Object.defineProperty(broken, "text", {
      value: () => Promise.reject(new Error("Reader unavailable")),
    })
    fireEvent.change(view.input, { target: { files: [broken] } })
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        copy.profile.fileUnreadable,
      ),
    )
    const valid = new File([], "valid.json")
    Object.defineProperty(valid, "text", {
      value: async () => '{"owned":"fixture"}',
    })
    fireEvent.change(view.input, { target: { files: [valid] } })
    await waitFor(() =>
      expect(view.onBackupRead).toHaveBeenCalledExactlyOnceWith(
        '{"owned":"fixture"}',
      ),
    )
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("ignores empty, overlapping, and late-unmounted file reads", async () => {
    const view = importing()
    fireEvent.change(view.input, { target: { files: [] } })
    const pending = Promise.withResolvers<string>()
    const first = new File([], "pending.json")
    Object.defineProperty(first, "text", { value: () => pending.promise })
    fireEvent.change(view.input, { target: { files: [first] } })
    const nextRead = vi.fn(async () => "ignored")
    const second = new File([], "other.json")
    Object.defineProperty(second, "text", { value: nextRead })
    fireEvent.change(view.input, { target: { files: [second] } })
    expect(nextRead).not.toHaveBeenCalled()
    view.unmount()
    await act(async () => pending.resolve("abandoned backup"))
    expect(view.onBackupRead).not.toHaveBeenCalled()
  })

  it("opens nested dialogs ancestor-first, cancels only the top owner, and restores the original trigger", () => {
    const trigger = document.createElement("button")
    trigger.textContent = "Original trigger"
    document.body.append(trigger)
    trigger.focus()
    const parentClose = vi.fn()
    const childClose = vi.fn()
    const opened = vi.spyOn(HTMLDialogElement.prototype, "showModal")
    const view = render(
      <MapachessDialog label="Parent" onClose={parentClose}>
        <MapachessDialog
          label="Child"
          onClose={childClose}
          fixedContent="fit"
          placement="bottom"
        >
          <button>Child action</button>
        </MapachessDialog>
      </MapachessDialog>,
    )
    expect(
      opened.mock.instances.map((dialog) => {
        if (!(dialog instanceof HTMLDialogElement))
          throw new Error("Modal opening must own a dialog element.")
        return dialog.getAttribute("aria-label")
      }),
    ).toEqual(["Parent", "Child"])
    const event = new Event("cancel", { cancelable: true })
    fireEvent(screen.getByRole("dialog", { name: "Child" }), event)
    expect(event.defaultPrevented).toBe(true)
    expect(childClose).toHaveBeenCalledOnce()
    expect(parentClose).not.toHaveBeenCalled()
    view.unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
