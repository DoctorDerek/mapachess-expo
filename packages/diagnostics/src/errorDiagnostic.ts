export const MAX_DIAGNOSTIC_CHARACTERS = 4_096

export type ErrorDiagnostic = Readonly<{
  message: string
  cause: unknown
}>

const UNKNOWN_ERROR_MESSAGE = "Unknown error."

function stringifyError(error: unknown): string {
  try {
    return String(error).trim() || UNKNOWN_ERROR_MESSAGE
  } catch {
    return UNKNOWN_ERROR_MESSAGE
  }
}

export function getErrorMessage(error: unknown): string {
  try {
    if (typeof error === "string") {
      return error.trim() || UNKNOWN_ERROR_MESSAGE
    }
    if (typeof error === "object" && error !== null && "message" in error) {
      const message = error.message
      if (typeof message === "string" && message.trim().length > 0) {
        return message.trim()
      }
    }
    return JSON.stringify(error) ?? stringifyError(error)
  } catch {
    return stringifyError(error)
  }
}

export default function captureError(error: unknown): ErrorDiagnostic {
  return Object.freeze({
    message: getErrorMessage(error).slice(0, MAX_DIAGNOSTIC_CHARACTERS),
    cause: error,
  })
}
