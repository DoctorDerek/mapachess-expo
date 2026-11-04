import {
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
  type StockfishWebRuntimeArtifact,
} from "@mapachess/stockfish/web-runtime-identity"

const cacheName = "mapachess-stockfish-program"
let pending: Promise<readonly [Blob, Blob]> | null = null

async function downloadProgram(
  artifact: StockfishWebRuntimeArtifact,
  url: string,
) {
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
  return blob
}

function programFile(artifact: StockfishWebRuntimeArtifact) {
  const url = "/stockfish-runtime/" + artifact.fileName
  const key = url + "?sha256=" + artifact.sha256
  let inFlight: Promise<Blob> | undefined
  let unpersisted: Blob | undefined

  async function read(cache: Cache | undefined) {
    if (!unpersisted) {
      const cached = await cache
        ?.match(key)
        .then((response) => response?.blob())
        .catch(() => undefined)
      if (cached?.size === artifact.byteLength) return cached
      unpersisted = await downloadProgram(artifact, url)
    }
    const blob = unpersisted
    if (cache) {
      try {
        await cache.put(key, new Response(blob))
        unpersisted = undefined
      } catch {
        // ONE-TIME EXCEPTION: Keep verified bytes when persistent storage is full.
      }
    }
    return blob
  }

  return (cache: Cache | undefined) => {
    inFlight ??= read(cache).finally(() => {
      inFlight = undefined
    })
    return inFlight
  }
}

const readLoader = programFile(STOCKFISH_18_WEB_LOADER_ARTIFACT)
const readBinary = programFile(STOCKFISH_18_WEB_WASM_ARTIFACT)

export function loadWebStockfishBytes(): Promise<readonly [Blob, Blob]> {
  if (!pending) {
    pending = (async () => {
      let cache: Cache | undefined
      try {
        cache = await globalThis.caches?.open(cacheName)
      } catch {
        // ONE-TIME EXCEPTION: Online chess can use memory when storage is denied.
      }
      return Promise.all([readLoader(cache), readBinary(cache)] as const)
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
