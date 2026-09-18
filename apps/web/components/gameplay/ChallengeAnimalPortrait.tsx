import { useActorRef, useSelector } from "@xstate/react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { preload } from "react-dom"
import animalAttentionMachine from "@mapachess/match-presentation/animal-attention-machine"
import type { StockfishOpponentDefinition } from "@mapachess/match/stockfish-opponent"
import {
  battleSpriteFrameKeyframes,
  battleSpriteFrameStyle,
  showBattleSpriteFrame,
  type BattleSpriteStep,
} from "../../lib/presentation/battleSpriteFrames"
import createPresentationImages from "../../lib/presentation/presentationImages"
import resolveWebOpponentPresentation, {
  resolveWebOpponentAttention,
} from "../../lib/presentation/webOpponentPresentation"

export default function ChallengeAnimalPortrait({
  opponent,
  active,
  attention = false,
}: Readonly<{
  opponent: StockfishOpponentDefinition
  active: boolean
  attention?: boolean
}>) {
  const attentionActor = useActorRef(animalAttentionMachine)
  const attentionOrdinal = useSelector(attentionActor, (snapshot) =>
    snapshot.matches("attention") ? snapshot.context.ordinal : null,
  )
  useEffect(() => {
    attentionActor.send({
      type: "ANIMAL_ATTENTION.INPUT_CHANGED",
      active,
      attention,
    })
  }, [active, attention, attentionActor])
  const presentation = useMemo(
    () => resolveWebOpponentPresentation(opponent.id),
    [opponent.id],
  )
  const step = presentation.kind === "sprite" ? presentation.steps[0] : null
  const attentionStep = useMemo(
    () => resolveWebOpponentAttention(opponent.id, attentionOrdinal ?? 0),
    [opponent.id, attentionOrdinal],
  )
  const spriteRef = useRef<HTMLSpanElement>(null)
  const hasVisiblePose = useRef(false)
  const [images] = useState(() => createPresentationImages())
  const [unavailable, setUnavailable] = useState(false)
  if (active && step !== null)
    preload(step.animation.sourceId, { as: "image", fetchPriority: "low" })

  useEffect(() => () => images.retain([]), [images])
  useEffect(() => {
    const sprite = spriteRef.current
    if (step === null || sprite === null) return
    let cancelled = false
    let readyStep: BattleSpriteStep | null = null
    let playingStep: BattleSpriteStep | null = null
    let frames: Animation | null = null
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    )
    const finishAttention = (): void => {
      if (!cancelled && attentionOrdinal !== null)
        attentionActor.send({
          type: "ANIMAL_ATTENTION.COMPLETED",
          ordinal: attentionOrdinal,
        })
    }
    const updatePlayback = (): void => {
      if (readyStep === null) return
      if (motionPreference.matches) {
        frames?.cancel()
        frames = null
        playingStep = null
        showBattleSpriteFrame(sprite, step, true)
        finishAttention()
        return
      }
      if (playingStep !== readyStep || frames === null) {
        frames?.cancel()
        const next = readyStep
        playingStep = next
        showBattleSpriteFrame(sprite, next, false)
        frames = sprite.animate(
          battleSpriteFrameKeyframes(next.animation.frameCount),
          {
            duration:
              next.animation.frameCount *
              next.animation.frameDurationMilliseconds,
            iterations: next.playback === "loop" ? Infinity : 1,
            fill: "forwards",
          },
        )
        if (next.playback !== "loop") {
          frames.onfinish = () => {
            if (cancelled || playingStep !== next) return
            readyStep = step
            updatePlayback()
            finishAttention()
          }
        }
      }
      if (document.visibilityState === "hidden") frames?.pause()
      else frames?.play()
    }
    if (!active) {
      images.retain([])
      return
    }
    const sources = [
      step.animation.sourceId,
      ...(attentionStep === null ? [] : [attentionStep.animation.sourceId]),
    ]
    images.retain(sources)
    const attentionReady =
      attentionStep === null
        ? Promise.resolve(false)
        : images.prepare([attentionStep.animation.sourceId])
    void images.prepare([step.animation.sourceId]).then(async (decoded) => {
      if (cancelled) return
      setUnavailable(!decoded && !hasVisiblePose.current)
      if (!decoded) return
      hasVisiblePose.current = true
      readyStep = step
      updatePlayback()
      if (
        attentionOrdinal !== null &&
        attentionStep !== null &&
        (await attentionReady) &&
        !cancelled
      ) {
        readyStep = attentionStep
        updatePlayback()
      } else {
        finishAttention()
      }
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
  }, [active, attentionOrdinal, attentionActor, attentionStep, images, step])

  const portraitStyle: CSSProperties & { "--sprite-scale": number } = {
    "--sprite-scale": presentation.layout.standaloneScale ?? 2,
  }
  return (
    <span
      aria-hidden="true"
      className="relative block h-full w-full"
      style={portraitStyle}
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
