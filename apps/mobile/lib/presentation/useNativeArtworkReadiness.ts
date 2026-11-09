import { useState } from "react"
import assets from "./nativeAssetManifest"

type ArtworkRequest = Readonly<{ sourceId: string; source: number }>
type ArtworkStatus = "pending" | "ready" | "failed"

export type NativeArtworkLayer = Readonly<{
  request: ArtworkRequest
  status: ArtworkStatus
}>

export const hasNativeArtwork = (sourceId: string): boolean =>
  assets.images[sourceId] !== undefined

function requestedArtwork(sourceIds: readonly string[]): ArtworkRequest[] {
  return [...new Set(sourceIds)].flatMap((sourceId) => {
    const source = assets.images[sourceId]
    return source === undefined ? [] : [{ sourceId, source }]
  })
}

function retainArtwork(
  requests: readonly ArtworkRequest[],
  previous: readonly NativeArtworkLayer[],
): readonly NativeArtworkLayer[] {
  if (
    requests.length === previous.length &&
    requests.every(
      ({ sourceId, source }, index) =>
        previous[index]?.request.sourceId === sourceId &&
        previous[index]?.request.source === source,
    )
  )
    return previous

  return requests.map(
    (request) =>
      previous.find(
        (layer) =>
          layer.request.sourceId === request.sourceId &&
          layer.request.source === request.source,
      ) ?? { request, status: "pending" },
  )
}

export default function useNativeArtworkReadiness(
  sourceIds: readonly string[],
) {
  const requests = requestedArtwork(sourceIds)
  const [retained, setRetained] = useState<readonly NativeArtworkLayer[]>(() =>
    retainArtwork(requests, []),
  )
  const layers = retainArtwork(requests, retained)
  if (layers !== retained) setRetained(layers)

  const settle = (request: ArtworkRequest, status: "ready" | "failed") =>
    setRetained((current) =>
      current.some(
        (layer) => layer.request === request && layer.status !== status,
      )
        ? current.map((layer) =>
            layer.request === request ? { request, status } : layer,
          )
        : current,
    )
  const status = (sourceId: string): ArtworkStatus | "missing" =>
    layers.find((layer) => layer.request.sourceId === sourceId)?.status ??
    "missing"
  return { layers, settle, status }
}
