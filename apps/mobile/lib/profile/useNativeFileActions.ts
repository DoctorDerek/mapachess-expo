import { useEffect, useRef, useState } from "react"
import captureError, {
  type ErrorDiagnostic,
} from "@mapachess/diagnostics/error-diagnostic"
import { MAPACHESS_UNREADABLE_DATA_FILE_NAME } from "@mapachess/profile/portable-files"
import {
  selectCurrentPlayerData,
  selectPendingPlayerData,
  selectUnreadablePlayerData,
} from "@mapachess/profile/profile-machine"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import {
  exportNativePlayerData,
  readNativePlayerDataBackup,
  shareNativeTextFile,
} from "./nativePlayerDataFiles"

export default function useNativeFileActions(actor: ProfileActor) {
  const [status, setStatus] = useState<
    "idle" | "busy" | "failed" | "too-large"
  >("idle")
  const [failure, setFailure] = useState<ErrorDiagnostic | null>(null)
  const operation = useRef<AbortController | null>(null)
  useEffect(() => () => operation.current?.abort(), [])
  const run = async (
    action: (signal: AbortSignal) => Promise<"idle" | "too-large">,
  ): Promise<void> => {
    if (operation.current !== null) return
    const controller = new AbortController()
    operation.current = controller
    setStatus("busy")
    setFailure(null)
    try {
      const outcome = await action(controller.signal)
      if (!controller.signal.aborted) setStatus(outcome)
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setFailure(captureError(error))
        setStatus("failed")
      }
    } finally {
      if (operation.current === controller) operation.current = null
    }
  }
  return {
    status,
    failure,
    exportData: () =>
      run(async (signal) => {
        const snapshot = actor.getSnapshot()
        const data =
          selectPendingPlayerData(snapshot) ?? selectCurrentPlayerData(snapshot)
        if (data === null)
          throw new Error("There is no accepted or pending profile to export.")
        await exportNativePlayerData(data, signal)
        return "idle"
      }),
    exportUnreadable: () =>
      run(async (signal) => {
        const contents = selectUnreadablePlayerData(actor.getSnapshot())
        if (contents === null)
          throw new Error("There is no unreadable save to export.")
        await shareNativeTextFile(
          contents,
          MAPACHESS_UNREADABLE_DATA_FILE_NAME,
          signal,
        )
        return "idle"
      }),
    importData: () =>
      run(async (signal) => {
        const result = await readNativePlayerDataBackup(signal)
        if (result.status === "ready" && !signal.aborted)
          actor.send({
            type: "PROFILE.IMPORT_PREVIEW_REQUESTED",
            rawBackup: result.contents,
          })
        return result.status === "too-large" ? "too-large" : "idle"
      }),
  }
}
