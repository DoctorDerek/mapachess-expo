import { CHARACTER_PACK_ROOT } from "../../assets/characterArtPaths"
import { SELECTED_ART_CACHE } from "../offline/partitionOfflineAssets"
import {
  isCharacterArtSource,
  readCharacterArtPack,
} from "./characterArtFormat"
import waitForFirstContentfulPaint from "./waitForFirstContentfulPaint"

type CharacterArtBoot = Readonly<{
  url: string
  integrity: string
  count: number
  seed: ReadonlyMap<string, string>
}>

function readBoot(json: string | undefined): CharacterArtBoot | undefined {
  if (!json) return undefined
  const boot: unknown = JSON.parse(json)
  if (
    typeof boot !== "object" ||
    boot === null ||
    !("url" in boot) ||
    typeof boot.url !== "string" ||
    !boot.url.startsWith(CHARACTER_PACK_ROOT + "/") ||
    !("integrity" in boot) ||
    typeof boot.integrity !== "string" ||
    !("count" in boot) ||
    typeof boot.count !== "number" ||
    !Number.isSafeInteger(boot.count) ||
    boot.count < 1 ||
    !("seed" in boot) ||
    !Array.isArray(boot.seed)
  )
    throw new Error("Invalid character art build descriptor.")
  const seed = new Map<string, string>()
  for (const entry of boot.seed) {
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
  return { url: boot.url, integrity: boot.integrity, count: boot.count, seed }
}

const boot = readBoot(process.env.MAPACHESS_CHARACTER_ART)
let packed: ReturnType<typeof readCharacterArtPack> | undefined
let pending: Promise<void> | undefined
const listeners = new Set<() => void>()

function prepareObservedArt(): void {
  if (listeners.size > 0) void prepareCharacterArtPack().catch(() => undefined)
}

function retryOnReconnect(): void {
  if (pending) void pending.catch(prepareObservedArt)
  else prepareObservedArt()
}

export function subscribeCharacterArt(listener: () => void): () => void {
  listeners.add(listener)
  if (boot && !packed) {
    if (listeners.size === 1)
      window.addEventListener("online", retryOnReconnect)
    prepareObservedArt()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0)
      window.removeEventListener("online", retryOnReconnect)
  }
}
export const hasCharacterArtPack = (): boolean => packed !== undefined

export function preparedArtSource(source: string): string | undefined {
  if (!isCharacterArtSource(source)) return source
  return boot?.seed.get(source) ?? packed?.(source)
}

async function loadPack(descriptor: CharacterArtBoot): Promise<void> {
  await waitForFirstContentfulPaint()
  const cache =
    typeof caches === "undefined"
      ? undefined
      : await caches.open(SELECTED_ART_CACHE).catch(() => undefined)
  const retained = await cache?.match(descriptor.url).catch(() => undefined)
  if (retained) {
    try {
      const bytes = await retained.arrayBuffer()
      const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", bytes),
      )
      if (
        "sha256-" + btoa(String.fromCharCode(...digest)) !==
        descriptor.integrity
      )
        throw new Error("Character art digest changed.")
      packed = readCharacterArtPack(bytes, descriptor.count)
      return
    } catch {
      await cache?.delete(descriptor.url).catch(() => false)
    }
  }
  const response = await fetch(descriptor.url, {
    integrity: descriptor.integrity,
    cache: retained ? "reload" : "force-cache",
  })
  if (!response.ok) throw new Error("Could not load character art.")
  const copy = cache ? response.clone() : undefined
  packed = readCharacterArtPack(await response.arrayBuffer(), descriptor.count)
  if (copy) void cache?.put(descriptor.url, copy).catch(() => undefined)
}

export function prepareCharacterArtPack(): Promise<void> {
  if (packed || !boot) return Promise.resolve()
  pending ??= loadPack(boot)
    .then(() => {
      if (listeners.size > 0)
        window.removeEventListener("online", retryOnReconnect)
      for (const listener of listeners) listener()
    })
    .finally(() => {
      pending = undefined
    })
  return pending
}

export async function resolveArtSource(source: string): Promise<string> {
  const available = preparedArtSource(source)
  if (available !== undefined) return available
  await prepareCharacterArtPack()
  const loaded = preparedArtSource(source)
  if (loaded === undefined)
    throw new Error("The requested character artwork is unavailable.")
  return loaded
}
