import { SELECTED_ART_CACHE } from "@/lib/offline/partitionOfflineAssets"
import waitForFirstContentfulPaint from "@/lib/presentation/waitForFirstContentfulPaint"

type Descriptor = Readonly<{ url: string; integrity: string; count: number }>
type Lookup = (source: string) => string | undefined
type Acquisition = "idle" | "ready" | "failed"

export function readArtDescriptor(value: unknown, root: string): Descriptor {
  if (
    typeof value !== "object" ||
    value === null ||
    !("url" in value) ||
    typeof value.url !== "string" ||
    !value.url.startsWith(root + "/") ||
    !/^\/[a-f\d]{64}\.pack$/.test(value.url.slice(root.length)) ||
    !("integrity" in value) ||
    typeof value.integrity !== "string" ||
    !/^sha256-[A-Za-z0-9+/]{43}=$/.test(value.integrity) ||
    !("count" in value) ||
    typeof value.count !== "number" ||
    !Number.isSafeInteger(value.count) ||
    value.count < 1
  )
    throw new Error("Invalid art pack build descriptor.")
  const digest = Array.from(atob(value.integrity.slice(7)), (byte) =>
    byte.charCodeAt(0).toString(16).padStart(2, "0"),
  ).join("")
  if (value.url !== `${root}/${digest}.pack`)
    throw new Error("Art pack URL and integrity disagree.")
  return { url: value.url, integrity: value.integrity, count: value.count }
}

export default function createArtPackAcquisition(
  descriptor: Descriptor | undefined,
  read: (bytes: ArrayBuffer, count: number) => Lookup,
  durable?: Readonly<{
    read: (url: string) => Promise<ArrayBuffer | undefined>
    write: (url: string, bytes: ArrayBuffer) => Promise<void>
    remove: (url: string) => Promise<void>
  }>,
) {
  let lookup: Lookup | undefined
  let pending: Promise<void> | undefined
  let state: Acquisition = "idle"
  const listeners = new Set<() => void>()
  const report = (next: Acquisition) => {
    if (state === next) return
    state = next
    for (const listener of listeners) listener()
  }

  function publish(bytes: ArrayBuffer, count: number) {
    lookup = read(bytes, count)
    report("ready")
  }

  async function publishRetained(bytes: ArrayBuffer, build: Descriptor) {
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
    if ("sha256-" + btoa(String.fromCharCode(...hash)) !== build.integrity)
      throw new Error("Retained art integrity changed.")
    publish(bytes, build.count)
  }

  async function acquire(build: Descriptor) {
    await waitForFirstContentfulPaint()
    const cache =
      typeof caches === "undefined"
        ? undefined
        : await caches.open(SELECTED_ART_CACHE).catch(() => undefined)
    const retained = await cache?.match(build.url).catch(() => undefined)
    if (retained) {
      try {
        await publishRetained(await retained.arrayBuffer(), build)
        return
      } catch {
        await cache?.delete(build.url).catch(() => false)
      }
    }
    const saved = await durable?.read(build.url).catch(() => undefined)
    if (saved) {
      try {
        await publishRetained(saved, build)
        return
      } catch {
        await durable?.remove(build.url).catch(() => undefined)
      }
    }
    const response = await fetch(build.url, {
      integrity: build.integrity,
      cache: retained || saved ? "reload" : "force-cache",
    })
    if (!response.ok) throw new Error("Could not acquire the art pack.")
    const copy = cache ? response.clone() : undefined
    const bytes = await response.arrayBuffer()
    publish(bytes, build.count)
    void durable?.write(build.url, bytes).catch(() => undefined)
    if (copy) void cache?.put(build.url, copy).catch(() => undefined)
  }

  function prepare(): Promise<void> {
    if (lookup || !descriptor) return Promise.resolve()
    pending ??= acquire(descriptor)
      .catch((error: unknown) => {
        report("failed")
        throw error
      })
      .finally(() => {
        pending = undefined
      })
    return pending
  }
  return {
    prepare,
    status: () => state,
    member: (source: string) => lookup?.(source),
    retryOnReconnect: (needed: () => boolean) =>
      pending
        ? pending.catch(() => (needed() ? prepare() : undefined))
        : prepare(),
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
