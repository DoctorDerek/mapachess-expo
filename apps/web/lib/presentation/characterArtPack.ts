import { CHARACTER_PACK_ROOT } from "@/assets/characterArtPaths"
import {
  isCharacterArtSource,
  readCharacterArtPack,
} from "@/lib/presentation/characterArtFormat"
import createArtPackAcquisition, {
  readArtDescriptor,
} from "@/lib/presentation/createArtPackAcquisition"

function readBoot(json: string | undefined) {
  if (!json) return undefined
  const value: unknown = JSON.parse(json)
  const descriptor = readArtDescriptor(value, CHARACTER_PACK_ROOT)
  if (
    typeof value !== "object" ||
    value === null ||
    !("seed" in value) ||
    !Array.isArray(value.seed)
  )
    throw new Error("Invalid character art first pose.")
  const seed = new Map<string, string>()
  for (const entry of value.seed) {
    if (
      !Array.isArray(entry) ||
      typeof entry[0] !== "string" ||
      !isCharacterArtSource(entry[0]) ||
      typeof entry[1] !== "string" ||
      !entry[1].startsWith("data:image/webp;base64,")
    )
      throw new Error("Invalid character art first pose.")
    seed.set(entry[0], entry[1])
  }
  return { ...descriptor, seed }
}

const boot = readBoot(process.env.MAPACHESS_CHARACTER_ART)
const pack = createArtPackAcquisition(boot, readCharacterArtPack)
const listeners = new Set<() => void>()

function retryOnReconnect(): void {
  void pack.retryOnReconnect(() => listeners.size > 0).catch(() => undefined)
}

pack.subscribe(() => {
  if (pack.status() !== "ready") return
  if (listeners.size > 0) window.removeEventListener("online", retryOnReconnect)
  for (const listener of listeners) listener()
})

export function subscribeCharacterArt(listener: () => void): () => void {
  listeners.add(listener)
  if (boot && pack.status() !== "ready") {
    if (listeners.size === 1)
      window.addEventListener("online", retryOnReconnect)
    void pack.prepare().catch(() => undefined)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0)
      window.removeEventListener("online", retryOnReconnect)
  }
}
export const prepareCharacterArtPack = pack.prepare
export const hasCharacterArtPack = () => pack.status() === "ready"

export function preparedArtSource(source: string): string | undefined {
  if (!isCharacterArtSource(source)) return source
  return boot?.seed.get(source) ?? pack.member(source)
}

export async function resolveArtSource(source: string): Promise<string> {
  const available = preparedArtSource(source)
  if (available !== undefined) return available
  await pack.prepare()
  const loaded = preparedArtSource(source)
  if (loaded === undefined)
    throw new Error("The requested character artwork is unavailable.")
  return loaded
}
