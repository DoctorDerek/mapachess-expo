import { useEffect, useMemo, useRef, useState } from "react"
import { preload } from "react-dom"
import type { StockfishOpponentDefinition } from "@mapachess/match/stockfish-opponent"
import {
  battleSpriteFrameKeyframes,
  battleSpriteFrameStyle,
  showBattleSpriteFrame,
} from "../../lib/presentation/battleSpriteFrames"
import createPresentationImages from "../../lib/presentation/presentationImages"
import resolveWebOpponentPresentation from "../../lib/presentation/webOpponentPresentation"

export default function ChallengeAnimalPortrait({
  opponent,
  active,
}: Readonly<{ opponent: StockfishOpponentDefinition; active: boolean }>) {
  const presentation = useMemo(
    () => resolveWebOpponentPresentation(opponent.id),
    [opponent.id],
  )
  const step = presentation.kind === "sprite" ? presentation.steps[0] : null
  const spriteRef = useRef<HTMLSpanElement>(null)
  const [images] = useState(() => createPresentationImages())
  const [unavailable, setUnavailable] = useState(false)
  if (active && step !== null)
    preload(step.animation.sourceId, { as: "image", fetchPriority: "low" })

  useEffect(() => () => images.retain([]), [images])
  useEffect(() => {
    const sprite = spriteRef.current
    if (step === null || sprite === null) return
    let cancelled = false
    let ready = false
    let frames: Animation | null = null
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    )
    const updatePlayback = (): void => {
      if (motionPreference.matches) {
        frames?.cancel()
        frames = null
        showBattleSpriteFrame(sprite, step, true)
        return
      }
      if (ready && frames === null) {
        showBattleSpriteFrame(sprite, step, false)
        frames = sprite.animate(
          battleSpriteFrameKeyframes(step.animation.frameCount),
          {
            duration:
              step.animation.frameCount *
              step.animation.frameDurationMilliseconds,
            iterations: Infinity,
          },
        )
      }
      if (document.visibilityState === "hidden") frames?.pause()
      else frames?.play()
    }
    if (!active) return
    updatePlayback()
    images.retain([step.animation.sourceId])
    void images.prepare([step.animation.sourceId]).then((decoded) => {
      if (cancelled) return
      ready = decoded
      setUnavailable(!decoded)
      updatePlayback()
    })
    motionPreference.addEventListener("change", updatePlayback)
    document.addEventListener("visibilitychange", updatePlayback)
    return () => {
      cancelled = true
      if (frames !== null) {
        sprite.style.backgroundPosition =
          getComputedStyle(sprite).backgroundPosition
        frames.cancel()
      }
      document.removeEventListener("visibilitychange", updatePlayback)
      motionPreference.removeEventListener("change", updatePlayback)
    }
  }, [active, images, step])

  return (
    <span
      aria-hidden="true"
      className="relative block h-20 w-full overflow-hidden [--sprite-scale:2] motion-safe:transition-transform motion-safe:group-hover:-translate-y-1 motion-safe:group-has-focus-visible:-translate-y-1"
    >
      {step === null || unavailable ? (
        <span className="absolute inset-0 grid place-items-center text-center text-xs font-bold">
          {opponent.displayName}
        </span>
      ) : null}
      <span className="absolute bottom-1 left-1/2 block size-0">
        <span
          ref={spriteRef}
          className="absolute block bg-no-repeat [image-rendering:pixelated]"
          style={
            step === null ? undefined : battleSpriteFrameStyle(step, false)
          }
        />
      </span>
    </span>
  )
}
