export const CHESS_APPEARANCE_PACK_ROOT = "/generated/chess-appearance"
export const CHESS_APPEARANCE_BOOT = "boot.json"

export function chessMemberMediaType(path: string) {
  if (
    !/^[a-z0-9_-]+\/(?:boards|pieces)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:png|svg)$/.test(
      path,
    )
  )
    return undefined
  return path.endsWith(".svg")
    ? ("image/svg+xml" as const)
    : ("image/png" as const)
}
