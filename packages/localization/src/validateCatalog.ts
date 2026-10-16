import emergencyCatalog from "./emergencyCatalog.js"
import {
  isMessageText,
  readMember,
  readMessage,
  type MessageFailure,
  type MessageRead,
} from "./messageRecovery.js"

export type CatalogDefect = Readonly<{
  path: string
  reason: MessageFailure | "extra"
}>

export default function validateCatalog(
  load: () => unknown,
): readonly CatalogDefect[] {
  const defects: CatalogDefect[] = []

  function inspect(contract: unknown, input: MessageRead, path: string): void {
    if (!input.ok) {
      defects.push({ path, reason: input.reason })
      return
    }
    const value = input.value
    if (typeof contract === "string" || typeof contract === "function") {
      if (
        typeof contract === "string"
          ? !isMessageText(value, contract === "")
          : typeof value !== "function"
      ) {
        defects.push({ path, reason: "invalid" })
      }
      return
    }
    if (typeof contract !== "object" || contract === null) return
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) !== Array.isArray(contract)
    ) {
      defects.push({ path, reason: "invalid" })
      return
    }
    const keys = readMessage(() => Object.keys(value))
    if (!keys.ok || !Array.isArray(keys.value)) {
      defects.push({ path, reason: "threw" })
      return
    }
    for (const key of keys.value) {
      if (typeof key === "string" && !Object.hasOwn(contract, key)) {
        defects.push({ path: `${path}.${key}`, reason: "extra" })
      }
    }
    for (const [key, child] of Object.entries(contract)) {
      inspect(
        child,
        readMember(input, key),
        path === "$" ? key : `${path}.${key}`,
      )
    }
  }

  inspect(emergencyCatalog, readMessage(load), "$")
  return Object.freeze(defects.map((defect) => Object.freeze(defect)))
}
