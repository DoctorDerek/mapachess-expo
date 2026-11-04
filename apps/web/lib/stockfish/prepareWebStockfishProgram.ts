import {
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
  type StockfishWebRuntimeArtifact,
} from "@mapachess/stockfish/web-runtime-identity"

const cacheName = "mapachess-stockfish-program"
let pending: Promise<readonly [Blob, Blob]> | null = null

async function readProgram(
  artifact: StockfishWebRuntimeArtifact,
  cache: Cache | null,
) {
  const url = "/stockfish-runtime/" + artifact.fileName
  const key = url + "?sha256=" + artifact.sha256
  const cached = await cache?.match(key).catch(() => undefined)
  if (cached) {
    const blob = await cached.blob()
    if (blob.size === artifact.byteLength) return blob
  }
  const digest = Uint8Array.from(artifact.sha256.match(/../g) ?? [], (pair) =>
    parseInt(pair, 16),
  )
  const response = await fetch(url, {
    integrity: "sha256-" + btoa(String.fromCharCode(...digest)),
  })
  if (!response.ok) throw Error("Unable to load " + artifact.fileName)
  const blob = await response.blob()
  if (blob.size !== artifact.byteLength)
    throw Error("Incomplete " + artifact.fileName)
  // Storage can be disabled or full. The downloaded program can still play online.
  await cache?.put(key, new Response(blob)).catch(() => undefined)
  return blob
}

export function loadWebStockfishBytes(): Promise<readonly [Blob, Blob]> {
  if (!pending) {
    pending = (async () => {
      const cache = await globalThis.caches?.open(cacheName).catch(() => null)
      return Promise.all([
        readProgram(STOCKFISH_18_WEB_LOADER_ARTIFACT, cache ?? null),
        readProgram(STOCKFISH_18_WEB_WASM_ARTIFACT, cache ?? null),
      ] as const)
    })().finally(() => {
      pending = null
    })
  }
  return pending
}

export default async function prepareWebStockfishProgram(
  signal?: AbortSignal,
): Promise<Readonly<{ url: string; release: () => void }>> {
  signal?.throwIfAborted()
  // Fetch from the page. WebKit's dedicated workers can bypass a service worker.
  const [loader, binary] = await loadWebStockfishBytes()
  signal?.throwIfAborted()
  const loaderUrl = URL.createObjectURL(
    new Blob([loader], { type: "text/javascript" }),
  )
  let wasmUrl: string
  try {
    wasmUrl = URL.createObjectURL(
      new Blob([binary], { type: "application/wasm" }),
    )
  } catch (error) {
    URL.revokeObjectURL(loaderUrl)
    throw error
  }
  return {
    // Stockfish.js accepts an explicit WASM URL in its worker fragment.
    url: loaderUrl + "#" + encodeURIComponent(wasmUrl),
    release: () => {
      URL.revokeObjectURL(loaderUrl)
      URL.revokeObjectURL(wasmUrl)
    },
  }
}
