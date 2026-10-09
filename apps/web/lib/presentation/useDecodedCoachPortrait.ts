import { useEffect, useRef, useState } from "react"
import {
  DEFAULT_COACH_COLLECTION,
  NEUTRAL_COACH_PORTRAIT_LABEL,
  type CoachCollectionId,
  type ResolvedCoachPortrait,
} from "@mapachess/match-presentation/coach-portrait"
import createPresentationImages from "./presentationImages"
import { coachPortraitSource } from "./webPresentationAssets"

type VisibleCoachPortrait = Readonly<{
  collection: CoachCollectionId
  label: ResolvedCoachPortrait["label"]
  source: string | null
}>

export default function useDecodedCoachPortrait(
  requested: ResolvedCoachPortrait,
  collection: CoachCollectionId = DEFAULT_COACH_COLLECTION,
): VisibleCoachPortrait &
  Readonly<{
    onImageError: () => void
    unavailable: boolean
    retry: () => void
  }> {
  const [attempt, setAttempt] = useState(0)
  const requestedSource =
    requested.kind === "portrait"
      ? coachPortraitSource(requested.label, collection)
      : null
  const source =
    requestedSource === null || attempt === 0
      ? requestedSource
      : `${requestedSource}?retry=${String(attempt)}`
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const [visible, setVisible] = useState<VisibleCoachPortrait>(() => ({
    collection,
    label: requested.label,
    source: null,
  }))
  const visibleSource = useRef<string | null>(null)
  const [images] = useState(() => createPresentationImages())

  useEffect(() => {
    if (source === null) {
      images.retain([])
      visibleSource.current = null
      return
    }
    let cancelled = false
    images.retain(
      visibleSource.current === null
        ? [source]
        : [visibleSource.current, source],
    )
    void images.prepare([source]).then((ready) => {
      if (cancelled) return
      if (ready) {
        visibleSource.current = source
        setVisible({ collection, label: requested.label, source })
        setFailedSource(null)
        images.retain([source])
      } else {
        setFailedSource(source)
      }
    })
    return () => {
      cancelled = true
    }
  }, [images, requested.label, source, collection, attempt])
  useEffect(() => () => images.retain([]), [images])

  return {
    ...(source === null
      ? { collection, label: NEUTRAL_COACH_PORTRAIT_LABEL, source: null }
      : visible),
    unavailable: source !== null && failedSource === source,
    retry: () => {
      images.retain([])
      setAttempt((current) => current + 1)
    },
    onImageError: () => {
      if (visibleSource.current !== visible.source) return
      visibleSource.current = null
      setFailedSource(visible.source)
      setVisible({
        collection: visible.collection,
        label: NEUTRAL_COACH_PORTRAIT_LABEL,
        source: null,
      })
    },
  }
}
