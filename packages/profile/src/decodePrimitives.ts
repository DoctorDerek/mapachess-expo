export type JsonObject = Record<string, unknown>

export type PlayerDataDecodeIssue =
  | Readonly<{
      path: string
      type: "PROFILE.DATA_INVALID"
    }>
  | Readonly<{
      receivedVersion: number
      type: "PROFILE.SCHEMA_VERSION_UNSUPPORTED"
    }>

export class PlayerDataDecodeProblem extends Error {
  constructor(readonly issue: PlayerDataDecodeIssue) {
    super(issue.type)
  }
}

export const failData = (path: string): never => {
  throw new PlayerDataDecodeProblem({ path, type: "PROFILE.DATA_INVALID" })
}

export const requireObject = (received: unknown, path: string): JsonObject => {
  if (
    typeof received !== "object" ||
    received === null ||
    Array.isArray(received)
  ) {
    return failData(path)
  }
  return received as JsonObject
}

export const requireExactKeys = (
  object: JsonObject,
  expectedKeys: readonly string[],
  path: string,
): void => {
  const receivedKeys = Object.keys(object).sort()
  const canonicalKeys = [...expectedKeys].sort()
  if (
    receivedKeys.length !== canonicalKeys.length ||
    receivedKeys.some((key, index) => key !== canonicalKeys[index])
  ) {
    failData(path)
  }
}

export const requireBoolean = (received: unknown, path: string): boolean => {
  if (typeof received !== "boolean") return failData(path)
  return received
}

export const requireString = (
  received: unknown,
  path: string,
  maximumLength = 256,
): string => {
  if (
    typeof received !== "string" ||
    received.length === 0 ||
    received.length > maximumLength ||
    received !== received.trim()
  ) {
    return failData(path)
  }
  return received
}

export const requireSafeRevision = (
  received: unknown,
  path: string,
): number => {
  if (
    typeof received !== "number" ||
    !Number.isSafeInteger(received) ||
    received < 0
  ) {
    return failData(path)
  }
  return received
}

export const requirePlayerElo = (received: unknown, path: string): number => {
  if (
    typeof received !== "number" ||
    !Number.isFinite(received) ||
    received < 100
  ) {
    return failData(path)
  }
  return received
}

export const requireEnumValue = <Value extends string>(
  received: unknown,
  values: readonly Value[],
  path: string,
): Value => {
  const value = values.find((candidate) => candidate === received)
  return value ?? failData(path)
}
