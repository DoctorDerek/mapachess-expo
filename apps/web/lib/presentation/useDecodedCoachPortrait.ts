import { useEffect, useRef, useState } from "react"
import {
  NEUTRAL_COACH_PORTRAIT_LABEL,
  type ResolvedCoachPortrait,
} from "@mapachess/match-presentation/coach-portrait"
import createPresentationImages from "./presentationImages"
import { coachPortraitSource } from "./webPresentationAssets"

type VisibleCoachPortrait = Readonly<{
  label: ResolvedCoachPortrait["label"]
  source: string | null
}>

export default function useDecodedCoachPortrait(
  requested: ResolvedCoachPortrait,
): VisibleCoachPortrait & Readonly<{ onImageError: () => void }> {
  const source =
    requested.kind === "portrait" ? coachPortraitSource(requested.label) : null
  const [visible, setVisible] = useState<VisibleCoachPortrait>(() => ({
    label: requested.label,
    source,
  }))
  const visibleSource = useRef(source)
  const [images] = useState(() => createPresentationImages())

  useEffect(() => {
    if (source === null) return
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
        setVisible({ label: requested.label, source })
        images.retain([source])
      } else if (visibleSource.current === source) {
        visibleSource.current = null
        setVisible({ label: NEUTRAL_COACH_PORTRAIT_LABEL, source: null })
      }
    })
    return () => {
      cancelled = true
    }
  }, [images, requested.label, source])
  useEffect(() => () => images.retain([]), [images])

  return {
    ...visible,
    onImageError: () => {
      if (visibleSource.current !== visible.source) return
      visibleSource.current = null
      setVisible({ label: NEUTRAL_COACH_PORTRAIT_LABEL, source: null })
    },
  }
}
