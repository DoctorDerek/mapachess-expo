import type { PrecacheEntry } from "serwist"

const isOptionalArtwork = (path: string) =>
  path.startsWith("/generated/presentation-assets/") ||
  path.startsWith("/generated/chess-assets/") ||
  path.startsWith("/chess-assets/") ||
  path.startsWith("/input-prompts/") ||
  (path.startsWith("/generated/first-arrival/") &&
    path !== "/generated/first-arrival/ice-cream.png")

export default function partitionOfflineAssets(
  entries: readonly (string | PrecacheEntry)[],
  origin: string,
) {
  const core: (string | PrecacheEntry)[] = []
  const art = new Map<string, string>()
  for (const entry of entries) {
    const url = new URL(typeof entry === "string" ? entry : entry.url, origin)
    if (url.origin !== origin) continue
    if (!isOptionalArtwork(url.pathname)) {
      core.push(entry)
      continue
    }
    if (typeof entry !== "string" && entry.revision)
      url.searchParams.set("revision", entry.revision)
    art.set(url.pathname, url.href)
  }
  return { core, art }
}
