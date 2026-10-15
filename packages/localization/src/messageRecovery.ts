export const UNAVAILABLE_TEXT = "Text unavailable"

export const unavailableText = (): string => UNAVAILABLE_TEXT
export const unavailableRows = (): readonly (readonly [string, string])[] =>
  Object.freeze([])

export type MessageFailure = "missing" | "invalid" | "threw"
export type MessageRead =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ ok: false; reason: MessageFailure }>

export function readMessage(read: () => unknown): MessageRead {
  try {
    const value: unknown = read()
    if (
      typeof value === "object" &&
      value !== null &&
      typeof Reflect.get(value, "then") === "function"
    ) {
      void Promise.resolve(value).catch(() => undefined)
      return { ok: false, reason: "invalid" }
    }
    return value === undefined || value === null
      ? { ok: false, reason: "missing" }
      : { ok: true, value }
  } catch {
    return { ok: false, reason: "threw" }
  }
}

export function readMember(parent: MessageRead, key: string): MessageRead {
  if (!parent.ok) return parent
  return readMessage(() => {
    const value = parent.value
    return typeof value === "object" &&
      value !== null &&
      Object.hasOwn(value, key)
      ? Reflect.get(value, key)
      : undefined
  })
}

export function isMessageText(
  value: unknown,
  optional = false,
): value is string {
  return typeof value === "string" && (optional || value.trim().length > 0)
}

export function isMessageRows(
  value: unknown,
): value is readonly (readonly [string, string])[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (row: unknown) =>
        Array.isArray(row) &&
        row.length === 2 &&
        isMessageText(row[0]) &&
        isMessageText(row[1]),
    )
  )
}

export function messageMatches(contract: unknown, value: unknown): boolean {
  if (typeof contract === "string") return isMessageText(value, contract === "")
  if (typeof contract === "function") return typeof value === "function"
  if (
    typeof contract !== "object" ||
    contract === null ||
    typeof value !== "object" ||
    value === null
  )
    return false
  if (Array.isArray(contract) !== Array.isArray(value)) return false
  if (
    Array.isArray(contract) &&
    Array.isArray(value) &&
    contract.length !== value.length
  )
    return false
  return Object.entries(contract).every(([key, child]: [string, unknown]) => {
    const member = readMember({ ok: true, value }, key)
    return member.ok && messageMatches(child, member.value)
  })
}
