"use client"

import { animate } from "motion"
import { useReducedMotion } from "motion/react"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import type { MatchPresentationBeat } from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationParticipant } from "@mapachess/match-presentation/match-reaction"
import type {
  ResolvedSpritePresentation,
  SpriteFacing,
} from "@mapachess/match-presentation/presentation-asset-manifest"
import {
  battleSpriteAnchorStyle,
  battleSpriteFrameKeyframes,
  battleSpriteFrameStyle,
  showBattleSpriteFrame,
} from "../../lib/presentation/battleSpriteFrames"
import createPresentationImages from "../../lib/presentation/presentationImages"

const FALLBACK_MOVEMENT_SECONDS = 0.36

export type BattleFighterProps = Readonly<{
  beat: MatchPresentationBeat
  displayName: string
  facing: SpriteFacing
  onAnimationCompleted: (
    participant: MatchPresentationParticipant,
    phaseIndex: number,
    reactionSequence: number,
  ) => void
  opposingPresentation: ResolvedSpritePresentation<string, string>
  participant: MatchPresentationParticipant
  phaseIndex: number
  presentation: ResolvedSpritePresentation<string, string>
  reactionSequence: number
  shouldReportCompletion: boolean
}>

export default function BattleFighter({
  beat,
  displayName,
  facing,
  onAnimationCompleted,
  opposingPresentation,
  participant,
  phaseIndex,
  presentation,
  reactionSequence,
  shouldReportCompletion,
}: BattleFighterProps) {
  const shouldReduceMotion = useReducedMotion() === true
  const displayedFacing =
    beat === "recovery" && presentation.reactionSlot.endsWith("attacker")
      ? facing === "left"
        ? "right"
        : "left"
      : facing
  const spriteRef = useRef<HTMLSpanElement>(null)
  const travelerRef = useRef<HTMLDivElement>(null)
  const visibleSource = useRef<string | null>(null)
  const settledTravelTarget = useRef<"home" | "contact" | "recoil" | null>(
    "home",
  )
  const [images] = useState(() => createPresentationImages())
  const [initialFrameStyle] = useState(() => {
    if (presentation.kind !== "sprite") return undefined
    const steps = presentation.steps.filter((step) => step.beat === beat)
    const initialStep = shouldReduceMotion ? steps.at(-1) : steps[0]
    return battleSpriteFrameStyle(
      initialStep ?? presentation.steps[0],
      shouldReduceMotion,
    )
  })
  const [imageUnavailable, setImageUnavailable] = useState(false)
  const reportCompletion = useEffectEvent(
    (completedPhase: number, completedSequence: number) => {
      if (shouldReportCompletion) {
        onAnimationCompleted(participant, completedPhase, completedSequence)
      }
    },
  )

  useEffect(() => () => images.retain([]), [images])

  useEffect(() => {
    const sprite = spriteRef.current
    const traveler = travelerRef.current
    if (sprite === null || traveler === null) return
    let cancelled = false
    let frames: Animation | null = null
    let movement: ReturnType<typeof animate> | null = null
    const isTransient = beat !== "idle" && beat !== "conclusion"
    const holdFrame = (): void => {
      if (frames === null) return
      sprite.style.backgroundPosition =
        getComputedStyle(sprite).backgroundPosition
      frames.cancel()
      frames = null
    }
    const isAttacker = presentation.reactionSlot.endsWith("attacker")
    const isVictim = presentation.reactionSlot.endsWith("victim")
    const travelTarget = shouldReduceMotion
      ? "home"
      : isAttacker &&
          (beat === "approach" || beat === "strike" || beat === "reaction")
        ? "contact"
        : isVictim && beat === "reaction"
          ? "recoil"
          : "home"
    const allSteps = presentation.kind === "sprite" ? presentation.steps : []
    const sources = allSteps.map((step) => step.animation.sourceId)
    images.retain(
      visibleSource.current === null
        ? sources
        : [...sources, visibleSource.current],
    )
    const preparedSteps = allSteps.map((step) => ({
      step,
      ready: images.prepare([step.animation.sourceId]),
    }))
    const steps = preparedSteps.filter(({ step }) => step.beat === beat)

    const move = async (duration: number): Promise<void> => {
      if (cancelled || settledTravelTarget.current === travelTarget) return
      settledTravelTarget.current = null
      movement = animate(
        traveler,
        {
          "--battle-advance": travelTarget === "contact" ? 1 : 0,
          "--battle-recoil": travelTarget === "recoil" ? 1 : 0,
        },
        {
          duration: shouldReduceMotion ? 0 : duration,
          ease: "linear",
        },
      )
      await movement
      if (!cancelled) settledTravelTarget.current = travelTarget
    }

    const play = async (): Promise<void> => {
      if (document.visibilityState === "hidden" && isTransient) {
        reportCompletion(phaseIndex, reactionSequence)
        return
      }
      if (steps.length === 0) {
        await move(FALLBACK_MOVEMENT_SECONDS)
      } else {
        for (const { step, ready } of shouldReduceMotion
          ? steps.slice(-1)
          : steps) {
          const decoded = await ready
          if (cancelled) return
          if (!decoded) {
            if (visibleSource.current === null) setImageUnavailable(true)
            await move(FALLBACK_MOVEMENT_SECONDS)
            continue
          }
          const { animation, playback } = step
          showBattleSpriteFrame(sprite, step, shouldReduceMotion)
          visibleSource.current = animation.sourceId
          setImageUnavailable(false)
          const duration =
            animation.frameCount * animation.frameDurationMilliseconds
          const travel = move(duration / 1000)
          if (shouldReduceMotion) {
            await travel
            continue
          }
          frames = sprite.animate(
            battleSpriteFrameKeyframes(animation.frameCount),
            {
              duration,
              fill: "forwards",
              iterations: playback === "loop" ? Infinity : 1,
            },
          )
          if (document.visibilityState === "hidden") {
            frames.pause()
            movement?.pause()
          }
          await Promise.all([frames.finished, travel])
          if (cancelled) return
          sprite.style.backgroundPosition = "100% 0"
          frames.cancel()
          frames = null
        }
      }
      if (!cancelled) reportCompletion(phaseIndex, reactionSequence)
    }

    const handleVisibility = (): void => {
      if (document.visibilityState === "hidden") {
        if (isTransient) {
          cancelled = true
          holdFrame()
          movement?.stop()
          reportCompletion(phaseIndex, reactionSequence)
        } else {
          frames?.pause()
          movement?.pause()
        }
      } else {
        frames?.play()
        movement?.play()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    void play().catch(() => {
      if (!cancelled) reportCompletion(phaseIndex, reactionSequence)
    })

    return () => {
      cancelled = true
      holdFrame()
      movement?.stop()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [
    beat,
    images,
    participant,
    phaseIndex,
    presentation,
    reactionSequence,
    shouldReduceMotion,
  ])

  return (
    <div className="relative z-2 row-span-2 grid min-w-0 grid-rows-subgrid justify-items-center">
      <div
        aria-label={`${displayName}: ${presentation.reactionSlot.replaceAll("-", " ")}`}
        className={`relative flex h-32 w-full items-end justify-center [--opponent-width:var(--opponent-mobile-width)] [--sprite-scale:var(--sprite-mobile-scale)] xl:[--opponent-width:var(--opponent-desktop-width)] xl:[--sprite-scale:var(--sprite-desktop-scale)] ${participant === "player" ? "[--battle-direction:1]" : "[--battle-direction:-1]"}`}
        role="img"
        style={battleSpriteAnchorStyle(presentation, opposingPresentation)}
      >
        <div
          ref={travelerRef}
          className="relative h-0 w-full translate-x-[calc(var(--battle-direction)*(var(--battle-advance)*var(--battle-contact-distance)_-_var(--battle-recoil)*min(10px,var(--battle-contact-distance)/4)))] [--battle-advance:0] [--battle-contact-distance:max(0px,calc(100%_+_var(--battle-gap)_-_(var(--sprite-visible-width)*var(--sprite-scale)_+_var(--opponent-width))/2))] [--battle-recoil:0]"
        >
          <span
            aria-hidden="true"
            className={`relative left-1/2 block size-0 ${presentation.kind === "sprite" && displayedFacing !== presentation.sourceFacing ? "-scale-x-100" : ""}`}
          >
            <span
              ref={spriteRef}
              className="absolute block bg-no-repeat [image-rendering:pixelated]"
              style={initialFrameStyle}
            />
          </span>
          {presentation.kind === "authored-fallback" || imageUnavailable ? (
            <span
              aria-hidden="true"
              className={`border-mapachito-charcoal font-display text-mapachito-charcoal absolute bottom-0 left-1/2 grid size-(--battle-fallback-size) -translate-x-1/2 place-items-center border-4 text-4xl font-black ${participant === "player" ? "bg-mapachito-orange" : "bg-mapachito-white"}`}
            >
              {displayName.slice(0, 1)}
            </span>
          ) : null}
        </div>
      </div>
      <span
        className={`border-mapachito-charcoal text-mapachito-white z-1 mt-2 max-w-full border-2 px-2 py-1 text-center font-mono text-xs font-bold [overflow-wrap:anywhere] forced-colors:border-[CanvasText] ${participant === "player" ? "bg-mapachito-violet" : "bg-mapachito-raspberry"}`}
      >
        {displayName}
        {imageUnavailable ? " · Artwork unavailable" : null}
      </span>
    </div>
  )
}
